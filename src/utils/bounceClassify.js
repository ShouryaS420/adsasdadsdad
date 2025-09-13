// src/utils/bounceClassify.js
// Classify SMTP failures from nodemailer into soft/hard
export function classifySmtpError(err) {
    const code = Number(err?.responseCode || err?.code || 0);
    const msg = String(err?.response || err?.message || "").toLowerCase();

    // 4xx are transient -> soft (rate limit, greylist, mailbox full)
    if (code >= 400 && code < 500) return { kind: "soft", code, reason: err?.response || err?.message };

    // 5xx are permanent -> hard
    if (code >= 500 && code < 600) return { kind: "hard", code, reason: err?.response || err?.message };

    // Heuristics on common strings
    if (/user unknown|no such user|mailbox unavailable|relay denied|blocked by policy/.test(msg))
        return { kind: "hard", code: code || 550, reason: err?.response || err?.message };

    if (/mailbox full|temporar|try again|greylist|rate|throttl/.test(msg))
        return { kind: "soft", code: code || 451, reason: err?.response || err?.message };

    return { kind: "unknown", code: code || 0, reason: err?.response || err?.message };
}
