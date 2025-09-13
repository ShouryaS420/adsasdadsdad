import { body } from 'express-validator';
import { User } from '../models/User.js';
import { hashPassword, comparePassword } from '../utils/hash.js';
import { signAccessToken, signRefreshToken, verifyRefresh, buildRefreshRecord } from '../utils/tokens.js';
import bcrypt from 'bcryptjs';
import ms from 'ms';
import { env } from '../config/env.js';
import { ALLOWED_CATEGORIES, isValidCategory, isValidSubcategory } from '../config/business.js';

/* ---------- helpers ---------- */
function serializeUser(u) {
  return {
    id: String(u._id),
    email: u.email,
    name: u.name,
    businessName: u.businessName,
    industry: u.industry,
    subcategory: u.subcategory,
    role: u.role,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

function setRefreshCookie(res, token) {
  res.cookie('refresh_token', token, {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: 'lax',
    path: '/api/auth/refresh',
    maxAge: ms(env.refreshTtl),
  });
}

/* ---------- validators ---------- */
export const validateRegister = [
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8 }).withMessage('Password min 8 chars'),
  body('businessName').optional({ nullable: true }).isLength({ min: 2 }).withMessage('Business name too short'),
  body('industry')
    .isString().withMessage('industry required')
    .custom(v => isValidCategory(v)).withMessage('Unknown industry'),
  body('subcategory')
    .isString().withMessage('subcategory required')
    .custom((sub, { req }) => isValidSubcategory(req.body.industry, sub))
    .withMessage('Invalid subcategory for given industry'),
];

export async function register(req, res) {
  const { email, password, businessName, industry, subcategory, name } = req.body;
  const exists = await User.findOne({ email });
  if (exists) return res.status(409).json({ message: 'Email already in use' });

  const user = await User.create({
    email,
    passwordHash: await hashPassword(password),
    businessName,
    industry,
    subcategory, // NEW
    name,
  });

  // Issue tokens on signup (so client doesn’t need immediate /login)
  const accessToken = signAccessToken(user);
  const { token: refreshToken, jti } = signRefreshToken(user);
  const record = await buildRefreshRecord(refreshToken, jti);
  record.userAgent = req.get('user-agent');
  record.ip = req.ip;

  user.refreshTokens.push(record);
  await user.save();

  setRefreshCookie(res, refreshToken);
  const workspaceId = String(user._id); // simple default; replace with real Workspace later

  return res.status(201).json({
    message: 'Registered',
    accessToken,
    user: serializeUser(user),
    workspaceId,
  });
}

export const validateLogin = [
  body('email').isEmail(),
  body('password').isString(),
];

export async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });
  const ok = await comparePassword(password, user.passwordHash);
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

  const accessToken = signAccessToken(user);
  const { token: refreshToken, jti } = signRefreshToken(user);
  const record = await buildRefreshRecord(refreshToken, jti);
  record.userAgent = req.get('user-agent');
  record.ip = req.ip;

  user.refreshTokens.push(record);
  await user.save();

  setRefreshCookie(res, refreshToken);
  return res.json({ accessToken, user: serializeUser(user), workspaceId: String(user._id) });
}

export async function me(req, res) {
  // ensure req.user is populated by requireAuth; return safe fields
  return res.json({ user: serializeUser(req.user) });
}

export async function refresh(req, res) {
  try {
    const token = req.cookies?.refresh_token;
    if (!token) return res.status(401).json({ message: 'Missing refresh token' });

    const decoded = verifyRefresh(token);
    const user = await User.findById(decoded.sub);
    if (!user) return res.status(401).json({ message: 'User not found' });

    const rec = user.refreshTokens.find(r => r.jti === decoded.jti && !r.revoked);
    if (!rec) return res.status(401).json({ message: 'Refresh not recognized' });

    const match = await bcrypt.compare(token, rec.tokenHash);
    if (!match) return res.status(401).json({ message: 'Refresh mismatch' });
    if (rec.expiresAt < new Date()) return res.status(401).json({ message: 'Refresh expired' });

    // rotate
    rec.revoked = true;

    const accessToken = signAccessToken(user);
    const { token: newRt, jti } = signRefreshToken(user);
    const record = await buildRefreshRecord(newRt, jti);
    user.refreshTokens.push(record);
    await user.save();

    setRefreshCookie(res, newRt);
    return res.json({ accessToken });
  } catch {
    return res.status(401).json({ message: 'Invalid refresh token' });
  }
}

export async function logout(req, res) {
  const token = req.cookies?.refresh_token;
  if (token) {
    try {
      const decoded = verifyRefresh(token);
      await User.updateOne(
        { _id: decoded.sub, 'refreshTokens.jti': decoded.jti },
        { $set: { 'refreshTokens.$.revoked': true } }
      );
    } catch {}
  }
  res.clearCookie('refresh_token', { path: '/api/auth/refresh' });
  return res.json({ message: 'Logged out' });
}
