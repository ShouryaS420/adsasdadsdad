import EmailDomain from "../models/EmailDomain.js";
import { genOtp, hashOtp } from "../utils/otp.js";
import { sendOtpMail } from "../utils/mailer.js";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { makeAuthRecords } from "../utils/dnsAuthRecords.js";
import dns from "node:dns/promises";
import { detectProviderMeta, PROVIDER_CATALOG } from "../utils/providerDetect.js";

const PUBLIC_BLOCK = new Set([
    "gmail.com", "googlemail.com", "yahoo.com", "ymail.com", "rocketmail.com",
    "outlook.com", "hotmail.com", "live.com", "msn.com", "icloud.com", "me.com", "mac.com",
    "proton.me", "protonmail.com", "aol.com", "mail.com", "zoho.com", "yandex.com",
]);

// 🔸 Trivial in-memory store (replace with DB later if you want)
const store = new Map();

function parseDomainFromEmail(email) {
    const at = email.indexOf("@");
    if (at < 0) return null;
    return email.slice(at + 1).trim().toLowerCase();
}

/** GET /api/email/domains */
export async function listDomains(req, res) {
    const rows = await EmailDomain.find({ userId: req.user._id }).sort("-createdAt");
    res.json(rows);
}

// keep your 42h policy here
const OTP_TTL_HOURS = 42;
const ms = (h) => h * 60 * 60 * 1000;
const newExpiry = () => new Date(Date.now() + ms(OTP_TTL_HOURS));

/** POST /api/email/domains  { email } */
// single generic message to avoid “email exists” enumeration
const BOUNCE_MASK = (email) =>
    `Error sending verification email.\n\nWe're having some trouble delivering to ${email}. Looks like the verification email might've bounced.`;

/* ------------------ helpers ------------------ */
const normHost = (h) => String(h || "").trim().toLowerCase().replace(/\.+$/, "");
const hostFromEmail = (email) => {
    const at = String(email || "").indexOf("@");
    if (at < 0) return null;
    return email.slice(at + 1).trim().toLowerCase();
};
const OTP_TTL_MS = (Number(env.OTP_TTL_HOURS || 42)) * 60 * 60 * 1000;

// ✅ Helpers for robust matching
const normalizeHost = (h = "") =>
    String(h).trim().toLowerCase().replace(/\.+$/, "");

// Follow up to 5 CNAME hops (handles intermediates)
async function resolveCnameChain(host, maxHops = 5) {
    const seen = [];
    let cur = normalizeHost(host);
    for (let i = 0; i < maxHops; i++) {
        let answers;
        try {
            answers = await dns.resolveCname(cur);
        } catch {
            break; // no more CNAMEs
        }
        if (!answers?.length) break;
        const next = normalizeHost(answers[0]);
        if (seen.includes(next)) break; // loop guard
        seen.push(next);
        cur = next;
    }
    return seen; // array of hop targets in order
}

// ✅ Configure once (MUST match your makeAuthRecords DKIM base)
const DKIM_TARGET_BASE = normalizeHost(env.DKIM_TARGET_BASE || "domainkey.magneticbyteinternettechnologiesopcpvtltd.in");

// ✅ One function to evaluate each record
async function markFound(rec) {
    try {
        if (rec.type === "CNAME") {
            const chain = await resolveCnameChain(rec.host);
            const want = normalizeHost(rec.value);
            rec.found = chain.includes(want) || chain.some((t) => t.endsWith(DKIM_TARGET_BASE));
        } else if (rec.type === "TXT" && /^_dmarc(\.|$)/i.test(rec.host)) {
            const answers = await dns.resolveTxt(rec.host);
            const flat = (answers || []).map((a) => a.join("")).join(" ");
            rec.found = /\bv=DMARC1\b/i.test(flat);
            // parse DMARC policy if present (none/quarantine/reject)
            const m = flat.match(/\bp\s*=\s*(none|quarantine|reject)\b/i);
            if (m) rec.policy = m[1].toLowerCase();
        } else {
            rec.found = false;
        }
    } catch {
        rec.found = false;
    }
    return rec;
}

export async function createAndSendOtp(req, res) {
    try {
        const raw = String(req.body.email || "");
        const email = raw.trim().toLowerCase();
        const domain = parseDomainFromEmail(email);
        if (!domain) return res.status(400).json({ error: "Invalid email" });
        if (PUBLIC_BLOCK.has(domain)) {
            return res.status(400).json({ error: "Use a business email (no public providers)" });
        }

        // one row per (userId, domain)
        let doc = await EmailDomain.findOne({ userId: req.user._id, domain });

        // helper: ensure emails[] exists and dedup the mailbox
        const addMailbox = (d) => {
            if (!Array.isArray(d.emails)) d.emails = [];
            if (!d.emails.includes(email)) d.emails.push(email);
        };

        // email content helpers
        const appUrl = env.APP_URL || env.PUBLIC_APP_URL || "https://app.example.com";
        const user = await User.findById(req.user._id).lean().catch(() => null);
        const requester = user?.email || req.user?.email || "your account";
        const year = new Date().getFullYear();

        const buildEmailHtml = (code) => {
            const verifyUrl = `${appUrl}/integrations/email-domains?open=otp&domain=${encodeURIComponent(domain)}`;
            return `<!doctype html><html><head><meta charset="utf-8"/>
            <meta name="viewport" content="width=device-width, initial-scale=1"/>
            <title>Verify Domain</title>
            <style>@media (max-width:620px){.container{width:100%!important}.card{padding:24px!important}.h1{font-size:22px!important;line-height:1.3!important}}</style>
            </head><body style="margin:0;padding:0;background:#efefef">
            <table role="presentation" width="100%" style="background:#efefef" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
            <table role="presentation" width="600" class="container" style="width:600px;max-width:100%" cellpadding="0" cellspacing="0">
                <tr><td class="card" style="background:#fff;border-radius:4px;padding:32px 36px;border:1px solid #e8e8e8">
                <div style="display:inline-block;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:18px;font-weight:700;color:#222">
                    <span style="display:inline-block;vertical-align:middle;width:28px;height:28px;border-radius:50%;background:#111;margin-right:10px"></span>
                    <span style="vertical-align:middle;letter-spacing:.2px">Business&nbsp;Suite</span>
                </div>
                <h1 class="h1" style="margin:28px 0 10px 0;font-family:Georgia,'Times New Roman',Times,serif;font-size:28px;line-height:1.25;color:#141414;font-weight:700">
                    An account is trying to send email from your domain.
                </h1>
                <p style="margin:0 0 16px 0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#333">
                    The Business Suite account with the username <strong>${requester}</strong> is attempting to use an email address at your domain,
                    (<a href="https://${domain}" style="color:#007c89;text-decoration:none">${domain}</a>).
                </p>
                <p style="margin:0 0 24px 0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#333">
                    Before the account can use this domain, you'll need to
                    <a href="${verifyUrl}" style="color:#007c89;text-decoration:underline">verify that it's authorized</a>.
                    If you don't wish to authorize this domain, please disregard this message.
                </p>
                <p style="margin:8px 0 6px 0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#555;text-align:center">
                    Alternatively, you can enter this verification code into Business Suite:
                </p>
                <div style="text-align:center;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:28px;font-weight:700;color:#141414;letter-spacing:1px;margin:4px 0 8px">
                    ${code}
                </div>
                <div style="height:8px"></div>
                <div style="text-align:center;color:#777;font:12px system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">© ${year} Business Suite</div>
                </td></tr>
            </table>
            </td></tr></table></body></html>`;
        };

        // First time for this domain → create & send OTP
        if (!doc) {
            const code = genOtp();
            doc = await EmailDomain.create({
                userId: req.user._id,
                domain,
                verifyingEmail: email,
                status: "verification_pending",
                otpHash: hashOtp(code),
                otpExpiresAt: newExpiry(),
                emails: [email],
            });

            await sendOtpMail({
                to: email,
                subject: "An account is trying to send email from your domain.",
                html: buildEmailHtml(code),
                text: `Your Business Suite verification code for ${domain}: ${code}`,
            });

            return res.json(doc);
        }

        // Make sure we track the mailbox under the domain
        addMailbox(doc);

        // If domain already progressed past OTP, don't restart verification.
        if (doc.status !== "verification_pending") {
            // Optionally update the “last used mailbox” for display
            doc.verifyingEmail = doc.verifyingEmail || email;
            await doc.save();
            return res.json(doc);
        }

        // Domain is pending
        const sameMailbox = (doc.verifyingEmail || "").toLowerCase() === email;
        const stillValid = doc.otpExpiresAt && doc.otpExpiresAt > new Date();

        // Same mailbox + still-valid OTP => do not rotate, return masked 409
        if (sameMailbox && stillValid) {
            await doc.save(); // persist emails[] updates
            return res.status(409).json({ error: BOUNCE_MASK(email), code: "email_already_pending" });
        }

        // New mailbox for same domain OR code expired => rotate & send to the new mailbox
        const code = genOtp();
        doc.verifyingEmail = email;
        doc.otpHash = hashOtp(code);
        doc.otpExpiresAt = newExpiry();
        await doc.save();

        await sendOtpMail({
            to: email,
            subject: "Your domain verification code",
            html: buildEmailHtml(code),
            text: `Your Business Suite verification code for ${domain}: ${code}`,
        });

        return res.json(doc);
    } catch (err) {
        console.error("createAndSendOtp failed:", err);
        return res.status(500).json({ error: "Failed to send verification email. Please try again." });
    }
}

/** POST /api/email/domains/:id/otp/resend */
export async function resendOtp(req, res) {
    const doc = await EmailDomain.findOne({ _id: req.params.id, userId: req.user._id });
    const user = await User.findById(req.user._id);
    if (!doc) return res.sendStatus(404);
    const code = genOtp();
    doc.otpHash = hashOtp(code);
    doc.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await doc.save();
    const emailTemplate = `
        <!doctype html>
        <html lang="en">
        <head>
            <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
            <meta name="x-apple-disable-message-reformatting" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>Verify Domain</title>
            <style>
            /* Some clients (Gmail) ignore <style> but it helps others.
                All critical styles are inline below. */
            @media (max-width: 620px) {
                .container { width: 100% !important; }
                .card { padding: 24px !important; }
                .h1 { font-size: 22px !important; line-height: 1.3 !important; }
            }
            </style>
        </head>
        <body style="margin:0;padding:0;background:#efefef;">
            <!-- full width background -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#efefef;">
            <tr>
                <td align="center" style="padding:24px;">
                <!-- centered card -->
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="container" style="width:600px; max-width:100%;">
                    <tr>
                    <td style="padding:0 0 12px 0;">
                        <!-- Top spacer -->
                    </td>
                    </tr>
                    <tr>
                    <td class="card" style="background:#ffffff;border-radius:4px;padding:32px 36px; border:1px solid #e8e8e8;">
                        <!-- Brand -->
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                            <td>
                            <!-- If you have a logo image, swap this <div> for an <img> -->
                            <div style="display:inline-block;font-family:system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;font-size:18px;font-weight:700;color:#222;">
                                <span style="display:inline-block;vertical-align:middle;width:28px;height:28px;border-radius:50%;background:#111;margin-right:10px;"></span>
                                <span style="vertical-align:middle;letter-spacing:.2px;">Business&nbsp;Suite</span>
                            </div>
                            </td>
                        </tr>
                        </table>

                        <!-- Title -->
                        <h1 class="h1" style="margin:28px 0 10px 0;font-family:Georgia, 'Times New Roman', Times, serif;font-size:28px;line-height:1.25;color:#141414;font-weight:700;">
                        An account is trying to send email from your domain.
                        </h1>

                        <!-- Copy -->
                        <p style="margin:0 0 16px 0;font-family:system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;font-size:16px;line-height:1.6;color:#333;">
                        The Business Suite account with the username
                        <strong>${user?.email}</strong> is attempting to use an email address at your domain,
                        (<a href="https://${doc.domain}" style="color:#007c89;text-decoration:none;">${doc.domain}</a>).
                        </p>

                        <p style="margin:0 0 24px 0;font-family:system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;font-size:16px;line-height:1.6;color:#333;">
                        Before the account can use this domain, you'll need to
                        <a href="{{verifyUrl}}" style="color:#007c89;text-decoration:underline;">verify that it's authorized</a>
                        to do so. If you don't wish to authorize this domain, please disregard this message.
                        </p>

                        <!-- Alt code -->
                        <p style="clear:both;margin:8px 0 6px 0;font-family:system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;font-size:14px;line-height:1.6;color:#555;text-align:center;">
                        Alternatively, you can enter this verification code into Business Suite:
                        </p>
                        <div style="text-align:center;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;
                                    font-size:28px; font-weight:700; color:#141414; letter-spacing:1px; margin:4px 0 8px;">
                        ${code}
                        </div>
                    </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                    <td style="padding:14px 8px 0;color:#777;font-family:system-ui,-apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;font-size:12px;line-height:1.5;text-align:center;">
                        © {{year}} Business Suite. All rights reserved.<br />
                        405 N. Angier Ave. NE, Atlanta, GA 30308 USA
                    </td>
                    </tr>
                    <tr><td style="height:24px;">&nbsp;</td></tr>
                </table>
                </td>
            </tr>
            </table>
        </body>
        </html>
    `;
    await sendOtpMail({ to: doc.verifyingEmail, code, domain: doc.domain, subject: 'An account is trying to send email from your domain.', html: emailTemplate });
    res.json({ ok: true });
}

/** POST /api/email/domains/:id/otp/verify { code } */
export async function verifyOtp(req, res) {
    const { code } = req.body || {};
    const doc = await EmailDomain.findOne({ _id: req.params.id, userId: req.user._id });
    if (!doc) return res.sendStatus(404);
    if (!doc.otpHash || !doc.otpExpiresAt || doc.otpExpiresAt < new Date())
        return res.status(400).json({ error: "Code expired. Resend a new one." });

    if (hashOtp(String(code)) !== doc.otpHash)
        return res.status(400).json({ error: "Invalid code." });

    doc.status = "auth_required";
    doc.otpHash = undefined;
    doc.otpExpiresAt = undefined;
    await doc.save();
    res.json(doc);
}

/* ------------------ START AUTH (manual) ------------------ */
export async function startAuth(req, res) {
    const { id } = req.params;
    const doc = await EmailDomain.findOne({ _id: id, userId: req.user._id });
    if (!doc) return res.status(404).json({ error: "Domain not found" });

    // Detect and persist provider (once, or refresh if empty)
    const providerMeta = await detectProviderMeta(doc.domain);
    // merge instead of overwrite to keep any future fields you might add
    doc.provider = { ...(doc.provider || {}), ...providerMeta };

    // Build desired auth records template and pre-mark "found"
    const desired = makeAuthRecords(doc.domain);
    await Promise.all(desired.map(markFound));

    // Transition status → in progress if just starting
    if (doc.status === "auth_required" || doc.status === "verification_pending" || doc.status === "failed") {
        doc.status = "auth_in_progress";
    }

    await doc.save();

    return res.json({
        status: doc.status,
        provider: doc.provider || {},
        records: desired,
    });
}

/* ------------------ RECHECK DNS (mark found flags) ------------------ */
export async function recheckDns(req, res) {
    const { id } = req.params;
    const doc = await EmailDomain.findOne({ _id: id, userId: req.user._id });
    if (!doc) return res.status(404).json({ error: "Domain not found" });

    // Refresh provider if we never stored one
    if (!doc.provider || !doc.provider.provider) {
        const meta = await detectProviderMeta(doc.domain);
        doc.provider = { ...(doc.provider || {}), ...meta };
    }

    const desired = makeAuthRecords(doc.domain);
    await Promise.all(desired.map(markFound));

    const hasDmarc = desired.some((r) => r.type === "TXT" && /^_dmarc(\.|$)/i.test(r.host) && r.found);
    const dkimFoundCount = desired.filter((r) => r.type === "CNAME" && /_domainkey/i.test(r.host) && r.found).length;

    // Optional: capture DMARC policy for UI/debugging
    const dmarcPolicy = desired.find((r) => r.type === "TXT" && /^_dmarc(\.|$)/i.test(r.host))?.policy || null;

    // Status machine
    if (hasDmarc && dkimFoundCount >= 1) {
        if (doc.status !== "authenticated") doc.status = "authenticated";
    } else {
        // stay or go back to "in progress" if not ready
        if (doc.status !== "auth_in_progress") doc.status = "auth_in_progress";
    }

    // If you ever want to mark terminal failure, do it behind a retry counter / time window.
    // e.g., after N rechecks over T hours with no progress => doc.status = "failed"

    await doc.save();

    return res.json({
        status: doc.status,
        provider: doc.provider || {},
        dmarcPolicy,           // (optional extra context for the frontend)
        records: desired,
    });
}

export async function setProvider(req, res) {
    const { id } = req.params;
    const { providerId } = req.body || {};
    const doc = await EmailDomain.findOne({ _id: id, userId: req.user._id });
    if (!doc) return res.sendStatus(404);

    const meta = PROVIDER_CATALOG[String(providerId)] || null;
    if (!meta) return res.status(400).json({ error: "Unknown providerId" });

    // Merge; keep any detected NS, etc.
    doc.provider = {
        ...(doc.provider || {}),
        provider: meta,                 // { id, name, helpUrl }
        suspected: meta.name,
        connected: false,
    };

    await doc.save();
    res.json({ ok: true, provider: doc.provider });
}

export async function disconnectDomain(req, res) {
    const { id } = req.params;
    const doc = await EmailDomain.findOne({ _id: id, userId: req.user._id });
    if (!doc) return res.sendStatus(404);

    // Flip back to "auth_required" so UI shows "Start Authentication"
    doc.status = "auth_required";

    // Optional clean-up:
    doc.provider = undefined;      // clear cached provider metadata if any
    doc.otpHash = undefined;       // clear any stale OTP
    doc.otpExpiresAt = undefined;
    // You may keep doc.emails & verifyingEmail for convenience, or clear verifyingEmail:
    // doc.verifyingEmail = undefined;

    await doc.save();
    res.json(doc);
}

export async function listDomainEmailsApi(req, res) {
    try {
        // Pull all domains for this user
        const rows = await EmailDomain.find({ userId: req.user._id }).sort("-createdAt").lean();

        const seen = new Set(); // de-dup per (domainId, email)
        const out = [];

        for (const doc of rows) {
            const domainId = String(doc._id);
            const baseDomain = String(doc.domain || "").toLowerCase();
            const createdAt = doc.createdAt;
            const domainStatus = doc.status;

            // helper to push one mailbox safely
            const pushEmail = (addr) => {
                const email = String(addr || "").trim().toLowerCase();
                if (!email) return;

                const dom = hostFromEmail(email) || baseDomain;
                const key = `${domainId}|${email}`;
                if (seen.has(key)) return;

                // make a stable, URL-safe id for frontend keys
                const id = `${domainId}:${Buffer.from(email).toString("base64url")}`;

                seen.add(key);
                out.push({
                    id,
                    email,
                    domain: String(dom || "").toLowerCase(),
                    domainId,
                    createdAt,
                    domainStatus, // frontend doesn’t require it, but handy to expose
                });
            };

            // include verifyingEmail (may or may not be in emails[])
            if (doc.verifyingEmail) pushEmail(doc.verifyingEmail);

            // include stored list
            if (Array.isArray(doc.emails)) {
                for (const e of doc.emails) pushEmail(e);
            }
        }

        // Optional: newest first by createdAt, then alpha by email
        out.sort((a, b) => {
            const t = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            return t !== 0 ? t : a.email.localeCompare(b.email);
        });

        res.json(out);
    } catch (err) {
        console.error("listDomainEmailsApi failed:", err);
        res.status(500).json({ error: "Failed to load domain emails" });
    }
}