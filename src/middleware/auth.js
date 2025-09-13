import { verifyAccess } from '../utils/tokens.js';
import { User } from '../models/User.js';
import { env } from '../config/env.js';

export async function requireAuth(req, res, next) {
    try {
        const hdr = req.headers.authorization || '';
        const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
        if (!token) return res.status(401).json({ message: 'Missing token' });
        const decoded = verifyAccess(token);
        const user = await User.findById(decoded.sub).select('-passwordHash -refreshTokens.tokenHash');
        if (!user) return res.status(401).json({ message: 'User not found' });
        req.user = user;
        next();
    } catch (e) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
}

export function auth(req, res, next) {
    const h = req.headers.authorization || "";
    const m = h.match(/^Bearer\s+(.+)$/i);
    if (!m) return res.status(401).json({ message: "Unauthorized" });

    try {
        const payload = jwt.verify(m[1], env.accessSecret);
        req.user = { id: payload?.sub || payload?.id || payload?._id || null, ...payload };
        next();
    } catch (e) {
        return res.status(401).json({ message: "Invalid token" });
    }
}