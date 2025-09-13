// utils/domainConnectSigner.js
import crypto from 'node:crypto';

/**
 * Build a signed Domain Connect Sync UX URL.
 * @param {Object} o
 * @param {string} o.base         settings.urlSyncUX from discovery
 * @param {string} o.domain       e.g. "99squarewall.xyz"
 * @param {string} o.providerId   your providerId
 * @param {string} o.serviceId    your serviceId
 * @param {string} o.redirectUri  https URL to your callback
 * @param {string} o.keyHost      e.g. "key1"
 * @param {string} o.privateKeyPem RSA private key PEM (with real newlines)
 * @param {Record<string,string>} [o.vars] template variables (selector1, selector2, rua, state...)
 */
export function buildSignedSyncUrl(o) {
    const {
        base, domain, providerId, serviceId, redirectUri,
        keyHost, privateKeyPem, vars = {}
    } = o;

    // Stable order matters. Do NOT include 'sig' when signing.
    const ordered = [
        ['domain', domain.toLowerCase()],
        ['providerId', providerId],
        ['serviceId', serviceId],
        ['redirect_uri', redirectUri],
        ['key', keyHost],
    ];

    // append template variables in deterministic key order
    Object.keys(vars).sort().forEach(k => {
        if (vars[k] !== undefined && vars[k] !== null) {
            ordered.push([k, String(vars[k])]);
        }
    });

    // Build query string with RFC3986 encoding
    const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, c =>
        '%' + c.charCodeAt(0).toString(16).toUpperCase()
    );
    const query = ordered.map(([k, v]) => `${enc(k)}=${enc(v)}`).join('&');

    // Sign the EXACT query string
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(query, 'utf8');
    const sigB64 = signer.sign(privateKeyPem, 'base64');

    const url = `${base}?${query}&sig=${enc(sigB64)}`;
    return { url, query, sigB64 };
}
