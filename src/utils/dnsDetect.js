// utils/dnsDetect.js
import dns from "node:dns/promises";
import { env } from "../config/env.js";

const PROVIDER_GUESS = [
    { match: "domaincontrol.com", name: "GoDaddy", id: "godaddy.com" },
    { match: "cloudflare.com", name: "Cloudflare", id: "cloudflare.com" },
    { match: "hostinger", name: "Hostinger", id: "hostinger.com" },
    { match: "google", name: "Google DNS", id: "google.com" },
    { match: "awsdns", name: "Amazon Route 53", id: "aws.amazon.com" },
];

function guessProviderFromNs(ns) {
    const joined = (ns || []).join(" ").toLowerCase();
    for (const p of PROVIDER_GUESS) {
        if (joined.includes(p.match)) return p;
    }
    return null;
}

async function safeResolveTxt(name) {
    try { return await dns.resolveTxt(name); } catch { return []; }
}
async function safeResolveCname(name) {
    try { return await dns.resolveCname(name); } catch { return []; }
}

export async function analyzeDomain(domain) {
    const detectedNs = await dns.resolveNs(domain).catch(() => []);
    const providerGuess = guessProviderFromNs(detectedNs);

    // Check DMARC
    const dmarcHost = `_dmarc.${domain}`;
    const dmarcTxt = (await safeResolveTxt(dmarcHost)).map(a => a.join(""));

    const dmarcFound = dmarcTxt.some(s => /(^|;)\s*v=DMARC1/i.test(s));
    const dmarcVal = dmarcTxt[0] || "";

    // Check DKIM for two selectors (use env fallback)
    const s1 = env.DKIM_SELECTOR1 || "k1";
    const s2 = env.DKIM_SELECTOR2 || "k2";

    const dkim1Host = `${s1}._domainkey.${domain}`;
    const dkim2Host = `${s2}._domainkey.${domain}`;
    const dkim1Cname = await safeResolveCname(dkim1Host);
    const dkim2Cname = await safeResolveCname(dkim2Host);

    const records = [
        { type: "TXT", host: dmarcHost, value: dmarcVal, found: dmarcFound, purpose: "dmarc", required: true },
        { type: "CNAME", host: dkim1Host, value: dkim1Cname[0] || "", found: dkim1Cname.length > 0, purpose: "dkim", required: true },
        { type: "CNAME", host: dkim2Host, value: dkim2Cname[0] || "", found: dkim2Cname.length > 0, purpose: "dkim", required: false }, // optional 2nd
    ];

    return {
        provider: {
            provider: providerGuess ? { id: providerGuess.id, name: providerGuess.name } : null,
            suspected: providerGuess?.name || null,
            detectedNs,
        },
        records,
    };
}
