// src/utils/suppressions.js
import crypto from "node:crypto";
import Suppression from "../models/Suppression.js";
import { env } from "../config/env.js";

/** ───────── helpers ───────── */
export function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
}
function escapeRegExp(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function b64url(buf) {
    return Buffer.from(buf).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function fromB64url(s) {
    s = s.replace(/-/g, "+").replace(/_/g, "/");
    // pad
    while (s.length % 4) s += "=";
    return Buffer.from(s, "base64");
}
function hmacSHA256(data, key) {
    return crypto.createHmac("sha256", key).update(data).digest();
}
function domainFromUrl(u) {
    try {
        const { host } = new URL(u);
        return host.replace(/:\d+$/, "");
    } catch {
        return "example.com";
    }
}

/** ───────── core CRUD ───────── */
export async function addSuppression({ userId, email, reason = "manual", meta = {} }) {
    const addr = normalizeEmail(email);
    if (!addr) throw new Error("email required");

    const doc = await Suppression.findOneAndUpdate(
        { userId, email: addr },
        { $set: { reason, meta } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return doc.toObject ? doc.toObject() : doc;
}

export async function removeSuppression({ userId, email }) {
    const addr = normalizeEmail(email);
    if (!addr) return { ok: false };
    await Suppression.deleteOne({ userId, email: addr });
    return { ok: true };
}

export async function isSuppressed({ userId, email }) {
    const addr = normalizeEmail(email);
    if (!addr) return false;
    const hit = await Suppression.findOne({ userId, email: addr }).lean();
    return !!hit;
}

export async function listSuppressions({ userId, q = "", page = 1, limit = 50 }) {
    const filter = { userId };
    if (q) filter.email = new RegExp(escapeRegExp(q.trim()), "i");
    const skip = Math.max(0, (Number(page) - 1) * Number(limit));
    const [rows, total] = await Promise.all([
        Suppression.find(filter).sort("-createdAt").skip(skip).limit(Number(limit)).lean(),
        Suppression.countDocuments(filter),
    ]);
    return { rows, total, page: Number(page), limit: Number(limit) };
}

/** ───────── unsubscribe token + headers ─────────
 * Stateless HMAC token for unsubscribe links and one-click (RFC 8058).
 * Encodes: userId, email, listId, campaignId, exp
 */
const UNSUB_SECRET = env.UNSUB_SECRET || env.JWT_SECRET || process.env.UNSUB_SECRET || "change-me";
const APP_URL = (env.APP_URL || env.PUBLIC_APP_URL || process.env.APP_URL || "https://app.example.com").replace(/\/$/, "");
const DEFAULT_UNSUB_MAILBOX =
    env.UNSUB_ADDRESS || process.env.UNSUB_ADDRESS || `unsubscribe@${domainFromUrl(APP_URL)}`;

export function issueUnsubToken({
    userId,
    email,
    listId = null,
    campaignId = null,
    // default 30 days
    expiresInSeconds = 60 * 60 * 24 * 30,
}) {
    const payload = {
        u: String(userId),
        e: normalizeEmail(email),
        l: listId ? String(listId) : null,
        c: campaignId ? String(campaignId) : null,
        exp: Math.floor(Date.now() / 1000) + Number(expiresInSeconds),
    };
    const json = JSON.stringify(payload);
    const sig = hmacSHA256(json, UNSUB_SECRET);
    return `${b64url(Buffer.from(json))}.${b64url(sig)}`;
}

export function verifyUnsubToken(token) {
    try {
        const [p, s] = String(token).split(".");
        if (!p || !s) return { ok: false };
        const jsonBuf = fromB64url(p);
        const want = fromB64url(s);
        const got = hmacSHA256(jsonBuf, UNSUB_SECRET);
        if (!crypto.timingSafeEqual(got, want)) return { ok: false };
        const payload = JSON.parse(jsonBuf.toString("utf8"));
        if (!payload?.exp || payload.exp < Math.floor(Date.now() / 1000)) {
            return { ok: false, expired: true };
        }
        return { ok: true, payload };
    } catch {
        return { ok: false };
    }
}

/**
 * Build List-Unsubscribe headers.
 * Returns an object you can merge into your outbound email headers.
 */
export function buildListUnsubscribeHeaders({
    userId,
    email,
    listId = null,
    campaignId = null,
    appUrl = APP_URL,
    mailtoAddress = DEFAULT_UNSUB_MAILBOX,
    includeMailto = true,
    oneClick = true, // adds RFC 8058 one-click
} = {}) {
    const token = issueUnsubToken({ userId, email, listId, campaignId });
    // One-click URL endpoint (HTTP POST per RFC 8058, but many MTAs GET it too)
    const ocUrl = `${appUrl}/u/one-click?token=${encodeURIComponent(token)}`;
    const httpUrl = `${appUrl}/u/unsubscribe?token=${encodeURIComponent(token)}`; // human landing page

    const parts = [`<${ocUrl}>`]; // prefer one-click URL first
    if (includeMailto && mailtoAddress) {
        parts.push(`<mailto:${mailtoAddress}>`);
    }
    // Some clients only parse the first URL; including both increases compatibility.
    // The human page is useful for browsers if they open the header link.
    parts.push(`<${httpUrl}>`);

    const headers = {
        "List-Unsubscribe": parts.join(", "),
    };
    if (oneClick) {
        headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
    }
    return headers;
}
