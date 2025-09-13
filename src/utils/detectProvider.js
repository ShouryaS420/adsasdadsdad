// utils/detectProvider.js
import dns from "dns/promises";

const NS_PROVIDER_MAP = [
    { re: /cloudflare\.com$/i, id: "cloudflare", name: "Cloudflare", helpUrl: "https://developers.cloudflare.com/dns/" },
    { re: /domaincontrol\.com$/i, id: "godaddy", name: "GoDaddy", helpUrl: "https://www.godaddy.com/help/manage-dns-for-your-domain-names-680" }, // GoDaddy NS pattern
    { re: /(hostingerdns|dns-parking)\.com$/i, id: "hostinger", name: "Hostinger", helpUrl: "https://support.hostinger.com/en/collections/1425712-domains" }, // Hostinger uses ns1/ns2.dns-parking.com
    { re: /(registrar-servers|namecheaphosting)\.com$/i, id: "namecheap", name: "Namecheap", helpUrl: "https://www.namecheap.com/support/knowledgebase/" },
    { re: /awsdns-\d+\.(org|net|com|co\.uk)$/i, id: "route53", name: "AWS Route 53", helpUrl: "https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/Welcome.html" },
    { re: /(ns-cloud-[a-z]-\d+\.googledomains\.com|googledomains\.com)$/i, id: "google", name: "Google Domains / Google Cloud DNS", helpUrl: "https://developers.google.com/domains/accreditation" },
    { re: /(squarespacedns\.com|nsone\.net)$/i, id: "squarespace", name: "Squarespace Domains", helpUrl: "https://support.squarespace.com/hc/en-us/sections/206540727-Domains" },
    { re: /digitalocean\.com$/i, id: "digitalocean", name: "DigitalOcean DNS", helpUrl: "https://docs.digitalocean.com/products/networking/dns/" },
    { re: /dnsimple\.com$/i, id: "dnsimple", name: "DNSimple", helpUrl: "https://support.dnsimple.com/categories/dns/" },
];

function matchProviderFromNs(nsHosts = []) {
    for (const ns of nsHosts) {
        for (const m of NS_PROVIDER_MAP) {
            if (m.re.test(ns)) return { id: m.id, name: m.name, helpUrl: m.helpUrl };
        }
    }
    return null;
}

// Try Domain Connect discovery via _domainconnect.<domain> TXT, or CNAME->TXT
async function discoverDomainConnect(domain) {
    const label = `_domainconnect.${domain}`;
    let txt = null;
    let cname = null;

    try {
        const txtRecords = await dns.resolveTxt(label);
        const flat = txtRecords.flat().join("");
        txt = flat || null;
    } catch { }

    if (!txt) {
        try {
            const cn = await dns.resolveCname(label);
            cname = cn?.[0] || null;
        } catch { }
        if (cname) {
            try {
                const txtRecords = await dns.resolveTxt(cname);
                txt = txtRecords.flat().join("") || null;
            } catch { }
        }
    }

    if (!txt) return null;

    // Many providers publish key=value; pairs, e.g. "providerId=godaddy;url=https://domainconnect.gd.domaincontrol.com"
    const parts = Object.fromEntries(
        txt.split(/[;,\s]+/).map(kv => {
            const [k, ...rest] = kv.split("=");
            return [k?.toLowerCase(), rest.join("=")];
        }).filter(([k, v]) => k && v)
    );

    return {
        raw: txt,
        providerId: parts.providerid || parts.provider || null,
        url: parts.url || null, // base Domain Connect URL for this domain
        cname,
    };
}

export async function detectProvider(domain) {
    let nsHosts = [];
    try { nsHosts = await dns.resolveNs(domain); }
    catch { }

    const suspected = matchProviderFromNs((nsHosts || []).map(s => s.toLowerCase()));

    let domainConnect = null;
    try { domainConnect = await discoverDomainConnect(domain); }
    catch { }

    return {
        suspected: suspected?.name || null,
        detectedNs: nsHosts || [],
        provider: suspected,        // {id,name,helpUrl} or null
        domainConnect,              // {url, providerId, raw, cname} or null
    };
}
