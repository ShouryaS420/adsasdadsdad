// utils/domainConnect.js
import dns from "node:dns/promises";
import crypto from "crypto";
import fetch from "node-fetch";
import EmailDomain from "../models/EmailDomain.js";

const rfc3986 = s =>
    encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());

function signRS256(qs, privateKeyPem) {
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(qs, 'utf8');
    return signer.sign(privateKeyPem, 'base64');
}

/**
 * Try to discover Domain Connect settings for a domain.
 * Strategy:
 *  1) Read _domainconnect.<domain> TXT → often includes provider discovery host(s)
 *  2) Build candidate settings URLs and fetch the first that returns JSON
 *  3) If TXT missing, try a couple of common providers heuristically (GoDaddy etc.)
 */
export async function discoverSettings(domain) {
    const candidates = new Set();

    // 1) TXT discovery: _domainconnect.<domain>
    try {
        const txt = await dns.resolveTxt(`_domainconnect.${domain}`);
        // Flatten and pull host-like tokens
        const tokens = txt.flat().map(s => String(s).trim());
        for (const t of tokens) {
            // e.g. "domainconnect.api.godaddy.com" or "api.domainconnect.com"
            if (/\./.test(t) && !/\s/.test(t)) {
                candidates.add(`https://${t}/v2/${domain}/settings`);
            }
        }
    } catch (_) { /* ignore */ }

    // 2) Heuristics: common DC endpoints (safe to probe)
    // If NS shows domaincontrol.com we’ll likely hit this one:
    candidates.add(`https://domainconnect.api.godaddy.com/v2/${domain}/settings`);

    // 3) Try each candidate until one returns JSON
    let settings = null;
    for (const url of candidates) {
        try {
            const r = await fetch(url, { timeout: 7000 });
            if (!r.ok) continue;
            const json = await r.json();
            // Ensure the minimal fields we rely on exist
            if (json && json.urlSyncUX && json.urlAPI) {
                settings = json;
                break;
            }
        } catch (_) { /* keep trying */ }
    }

    return settings ? { settings } : null;
}

/**
 * Build the Domain Connect Sync UX URL for applying your template.
 * If privateKeyPem is provided, the querystring will be signed (RSA-SHA256).
 *
 * @param {Object} args
 * @param {Object} args.settings - object from /v2/<domain>/settings (must have urlSyncUX)
 * @param {string} args.domain
 * @param {string} args.providerId - must match your template’s providerId
 * @param {string} args.serviceId  - must match your template’s serviceId
 * @param {string} args.redirectUri
 * @param {string} [args.keyHost]  - TXT host label for your public key (e.g. "key1")
 * @param {string|null} [args.privateKeyPem] - RSA private key (PEM). If falsy, no signing.
 * @param {Record<string,string>} args.templateVars - names MUST match your template
 */
function b64url(buf) {
    return Buffer.from(buf).toString("base64")
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function buildApplyUrl({
    settings,
    domain,
    providerId,
    serviceId,
    redirectUri,     // HTTPS, on auth.magneticbyte...
    keyHost,         // "key1"
    privateKeyPem,   // full PEM, BEGIN/END included
    templateVars = {} // { selector1, selector2, rua, state }
}) {
    const params = new URLSearchParams();
    params.set("domain", domain);
    params.set("providerId", providerId);
    params.set("serviceId", serviceId);
    if (redirectUri) params.set("redirect_uri", redirectUri);
    if (templateVars.state) params.set("state", templateVars.state);

    for (const [k, v] of Object.entries(templateVars)) {
        if (k !== "state" && v != null) params.set(k, String(v));
    }

    // Canonical (sorted) query string – sign exactly this
    const canonical = new URLSearchParams(
        [...params.entries()].sort(([a], [b]) => a.localeCompare(b))
    ).toString();

    let url = `${settings.urlSyncUX}/v2/domainTemplates/providers/` +
        `${encodeURIComponent(providerId)}/services/` +
        `${encodeURIComponent(serviceId)}/apply?${canonical}`;

    if (privateKeyPem && keyHost) {
        const signer = crypto.createSign("RSA-SHA256");
        signer.update(canonical);
        signer.end();
        const sig = b64url(signer.sign(privateKeyPem));
        url += `&key=${encodeURIComponent(keyHost)}&sig=${encodeURIComponent(sig)}`;
    }

    return url;
}

export async function dcCallback(req, res) {
    const { domain, state } = req.query; // state = EmailDomain _id we sent
    if (state) {
        await EmailDomain.updateOne(
            { _id: state },
            { $set: { status: "auth_in_progress", lastDcReturnAt: new Date() } }
        );
    }
    // land user back in your UI
    const ui = `${process.env.APP_URL || "http://localhost:5000"}/ui/return?domain=${encodeURIComponent(domain)}&ok=1`;
    res.redirect(ui);
}