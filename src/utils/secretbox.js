// src/utils/secretbox.js
import crypto from "crypto";
const KEY = crypto.createHash("sha256").update(String(process.env.SECRET_KEY || "changeme")).digest();

export function seal(plaintext) {
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv("aes-256-gcm", KEY, iv);
    const enc = Buffer.concat([c.update(String(plaintext), "utf8"), c.final()]);
    const tag = c.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString("base64");
}
export function open(box) {
    if (!box) return null;
    const raw = Buffer.from(box, "base64");
    const iv = raw.subarray(0, 12), tag = raw.subarray(12, 28), data = raw.subarray(28);
    const d = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(data), d.final()]).toString("utf8");
}
