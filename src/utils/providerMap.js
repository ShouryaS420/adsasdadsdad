/**
 * Basic NS → provider mapping.
 * Extend this table over time.
 */
const TABLE = [
    { id: 'cloudflare', name: 'Cloudflare', helpUrl: 'https://developers.cloudflare.com/dns/', match: [/\.ns\.cloudflare\.com$/i, /\.cloudflare\.com$/i] },
    { id: 'hostinger', name: 'Hostinger DNS', helpUrl: 'https://support.hostinger.com/en/collections/310001-dns', match: [/\.dns-parking\.com$/i, /\.hostinger\./i] },
    { id: 'godaddy', name: 'GoDaddy DNS', helpUrl: 'https://www.godaddy.com/help/manage-dns-680', match: [/\.domaincontrol\.com$/i] },
    { id: 'google', name: 'Google Cloud DNS', helpUrl: 'https://cloud.google.com/dns/docs', match: [/\.googledomains\.com$/i, /\.ns-cloud-(?:[a-d])\.goog$/i] },
    { id: 'route53', name: 'Amazon Route 53', helpUrl: 'https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/', match: [/^ns-\d+\.(awsdns-\d+\.org|awsdns-\d+\.co\.uk|awsdns-\d+\.com|awsdns-\d+\.net)$/i] },
    { id: 'azure', name: 'Azure DNS', helpUrl: 'https://learn.microsoft.com/azure/dns/', match: [/\.azure-dns\.(?:com|net|org|info)$/i] },
    { id: 'namecheap', name: 'Namecheap DNS', helpUrl: 'https://www.namecheap.com/support/knowledgebase/category/2232/dns/', match: [/\.registrar-servers\.com$/i, /\.namecheaphosting\.com$/i] },
    { id: 'cloudns', name: 'ClouDNS', helpUrl: 'https://www.cloudns.net/wiki/', match: [/\.cloudns\.net$/i] },
    { id: 'digitalocean', name: 'DigitalOcean DNS', helpUrl: 'https://docs.digitalocean.com/products/networking/dns/', match: [/\.digitalocean\.com$/i] }
];

export function mapNsToProvider(nsHost) {
    if (!nsHost) return null;
    const host = nsHost.toLowerCase();
    for (const row of TABLE) {
        if (row.match.some(rx => rx.test(host))) {
            return { id: row.id, name: row.name, helpUrl: row.helpUrl };
        }
    }
    return null;
}
