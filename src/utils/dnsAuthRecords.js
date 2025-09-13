// Build the *instructions* you show to the user in ManualDomainAuth
// DKIM: customer adds CNAME  k1._domainkey.<their-domain> -> k1.domainkey.<your DKIM base>.
// DMARC: customer adds TXT   _dmarc.<their-domain>        -> "v=DMARC1; ..."

import { env } from "../config/env.js";

const selectors = [
    env.DKIM_SELECTOR1 || "k1",
    env.DKIM_SELECTOR2 || "k2",
].filter(Boolean);

const dkimBase = (env.DKIM_TARGET_BASE || "").replace(/\.$/, ""); // no trailing dot
const ttl = Number(env.DNS_TTL || 3600);
const perDomain = String(env.DMARC_RUA_MODE || "").toLowerCase() === "per-domain";
const centralRua = env.DMARC_RUA; // e.g. "mailto:dmarc@yourcompany.tld"

export function makeAuthRecords(domain) {
    const recs = [];

    // DKIM CNAMEs
    for (const s of selectors) {
        const host = `${s}._domainkey.${domain}`;
        const value = `${s}.${dkimBase}.`; // value normally ends with a dot
        recs.push({
            type: "CNAME",
            host,
            value,
            ttl,
            required: true,
            found: false,
            purpose: "dkim",
            note: "Add a CNAME that points to your provider-hosted DKIM public key.",
        });
    }

    // DMARC TXT
    const rua = perDomain
        ? `mailto:dmarc@${domain}`
        : (centralRua || `mailto:dmarc@${domain}`);

    recs.push({
        type: "TXT",
        host: `_dmarc.${domain}`,
        value: `v=DMARC1; p=none; rua=${rua}; fo=1; sp=none`,
        ttl,
        required: true,
        found: false,
        purpose: "dmarc",
        note: "Start with policy p=none. You can tighten later to quarantine/reject.",
    });

    return recs;
}
