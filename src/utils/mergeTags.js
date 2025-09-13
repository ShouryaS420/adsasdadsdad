import { env } from "../config/env.js";
import crypto from "crypto";

// very small {{field}} with optional default: {{field|default:"there"}}
export function renderMerge(html, data = {}) {
    if (!html) return "";
    return String(html).replace(/\{\{\s*([a-zA-Z0-9_.]+)(?:\s*\|\s*default:\s*"([^"]*)")?\s*\}\}/g,
        (_, key, deflt) => {
            const val = lookup(data, key);
            return (val === undefined || val === null || val === "") ? (deflt ?? "") : String(val);
        });
}

function lookup(obj, path) {
    const parts = String(path).split(".");
    let cur = obj;
    for (const p of parts) {
        if (cur && Object.prototype.hasOwnProperty.call(cur, p)) cur = cur[p];
        else return undefined;
    }
    return cur;
}

// minimal signed token for unsubscribe; align this with your unsubscribe route (Phase 3)
export function makeUnsubToken(userId, contactId) {
    const secret = env.APP_SECRET || "dev-secret";
    const payload = `${userId}.${contactId}`;
    const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex").slice(0, 16);
    return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

export function makeUnsubUrl(userId, contactId) {
    const appUrl = env.APP_URL || env.PUBLIC_APP_URL || "http://localhost:3000";
    const token = makeUnsubToken(userId, contactId);
    return `${appUrl}/u/${token}`;
}
