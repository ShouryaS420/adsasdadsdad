import dns from "node:dns/promises";

const norm = (s) => String(s || "").trim().toLowerCase().replace(/\.+$/, "");

// Central catalog so both detection + manual save use the same IDs
export const PROVIDER_CATALOG = {
    "godaddy": { id: "godaddy", name: "GoDaddy", helpUrl: "https://in.godaddy.com/help/add-a-cname-record-19236" },
    "cloudflare": { id: "cloudflare", name: "Cloudflare", helpUrl: "https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/" },
    "google-cloud-dns": { id: "google-cloud-dns", name: "Google Cloud DNS", helpUrl: "https://cloud.google.com/dns/docs" },
    "namecheap": { id: "namecheap", name: "Namecheap", helpUrl: "https://www.namecheap.com/support/knowledgebase/category/1414/dns-and-host-records/" },
    "aws-route53": { id: "aws-route53", name: "AWS Route 53", helpUrl: "https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resource-record-sets-creating.html" },
    "bluehost": { id: "bluehost", name: "Bluehost", helpUrl: "https://www.bluehost.com/help/article/dns-management" },
    "hostgator": { id: "hostgator", name: "HostGator", helpUrl: "https://www.hostgator.com/help/article/how-to-manage-dns-records" },
    "dreamhost": { id: "dreamhost", name: "DreamHost", helpUrl: "https://help.dreamhost.com/hc/en-us/articles/215747758-Adding-custom-DNS-records" },
    "digitalocean": { id: "digitalocean", name: "DigitalOcean", helpUrl: "https://docs.digitalocean.com/products/networking/dns/how-to/manage-records/" },
    "wix": { id: "wix", name: "Wix", helpUrl: "https://support.wix.com/en/article/adding-or-updating-dns-records-in-your-wix-account" },
    "squarespace": { id: "squarespace", name: "Squarespace", helpUrl: "https://support.squarespace.com/hc/en-us/articles/205812378-Adding-custom-records-to-your-domain" },
    "name.com": { id: "name.com", name: "Name.com", helpUrl: "https://www.name.com/support/articles/205188198-DNS-Record-Types-and-How-to-Edit" },
    "ionos": { id: "ionos", name: "IONOS (1&1)", helpUrl: "https://www.ionos.com/help/domains/configure-dns-settings/dns-records/" },
    "hostinger": { id: "hostinger", name: "Hostinger", helpUrl: "https://support.hostinger.com/en/articles/1585316-how-to-manage-dns-records" },
};

// patterns that identify NS brands (Hostinger expanded)
const KNOWN = [
    { key: "godaddy", match: (h) => /domaincontrol\.com$/.test(h) },
    { key: "cloudflare", match: (h) => /cloudflare\.com$/.test(h) },
    { key: "google-cloud-dns", match: (h) => /(google(domains)?\.com|googledomains\.com)$/.test(h) && /ns-?cloud/i.test(h) },
    { key: "namecheap", match: (h) => /(registrar-servers\.com|namecheaphosting\.com)$/.test(h) },
    { key: "aws-route53", match: (h) => /awsdns-\d+\.(?:com|net|org|co\.uk)$/.test(h) },
    { key: "digitalocean", match: (h) => /digitalocean\.com$/.test(h) },
    { key: "bluehost", match: (h) => /bluehost\.com$/.test(h) },
    { key: "hostgator", match: (h) => /(hostgator\.com|websitewelcome\.com)$/.test(h) },
    { key: "dreamhost", match: (h) => /dreamhost\.com$/.test(h) },
    { key: "wix", match: (h) => /(wixdns\.net|wix\.com)$/.test(h) },
    { key: "squarespace", match: (h) => /squarespacedns\.com$/.test(h) },
    { key: "name.com", match: (h) => /name\.com$/.test(h) },
    { key: "ionos", match: (h) => /ui-dns\.(?:de|com|org|biz)$/.test(h) },

    // Hostinger real-world variants
    { key: "hostinger", match: (h) => /(hostinger|hostingerdns)\.(com|in|eu|net|co)$/.test(h) },
    { key: "hostinger", match: (h) => /dns-parking\.com$/.test(h) }, // ns1/2.dns-parking.com is Hostinger’s
];

export async function detectProviderMeta(domain) {
    let detectedNs = [];
    try {
        detectedNs = (await dns.resolveNs(domain)).map(norm).sort();
    } catch { /* ignore */ }

    const hit = KNOWN.find((p) => detectedNs.some((h) => p.match(h)));
    if (!hit) {
        return {
            connected: false,
            suspected: null, 
            provider: null,
            detectedNs,
            accountLabel: undefined,
            domainConnect: null,
        };
    }

    const provider = PROVIDER_CATALOG[hit.key];
    return {
        connected: false,
        suspected: provider?.name,
        provider,          // { id, name, helpUrl }
        detectedNs,
        accountLabel: undefined,
        domainConnect: null,
    };
}
