import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import ms from 'ms';
import { env } from '../config/env.js';
import { hashToken } from './hash.js';

export function signAccessToken(user) {
    const payload = { sub: user._id.toString(), role: user.role };
    return jwt.sign(payload, env.accessSecret, { expiresIn: env.accessTtl });
}

export function signRefreshToken(user) {
    const jti = uuidv4();
    const token = jwt.sign({ sub: user._id.toString(), jti }, env.refreshSecret, { expiresIn: env.refreshTtl });
    return { token, jti };
}

export function verifyAccess(token) {
    return jwt.verify(token, env.accessSecret);
}

export function verifyRefresh(token) {
    return jwt.verify(token, env.refreshSecret);
}

export async function buildRefreshRecord(token, jti) {
    const expiresAt = new Date(Date.now() + ms(env.refreshTtl));
    return {
        jti,
        tokenHash: await hashToken(token),
        expiresAt
    };
}
