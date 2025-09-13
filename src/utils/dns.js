import { Resolver } from "dns/promises";

const resolver = new Resolver();

export async function lookupCname(host) {
    try {
        const res = await resolver.resolveCname(host);
        return res; // array
    } catch { return []; }
}

export async function lookupTxt(host) {
    try {
        const res = await resolver.resolveTxt(host);
        return res.flat(); // array of strings
    } catch { return []; }
}

export function makeAuthRecords(domain) {
    return [
        { type: "CNAME", host: `k1._domainkey.${domain}`, value: "dkim1.mcsv.net", required: true },
        { type: "CNAME", host: `k2._domainkey.${domain}`, value: "dkim2.mcsv.net", required: true },
        { type: "TXT", host: domain, value: "v=spf1 include:servers.mcsv.net ~all", required: true },
    ];
}

export async function checkRecords(records) {
    const out = [];
    for (const r of records) {
        if (r.type === "CNAME") {
            const cnames = await lookupCname(r.host);
            out.push({ ...r, found: cnames.some(c => c.toLowerCase().includes(r.value.toLowerCase())) });
        } else {
            const txts = await lookupTxt(r.host);
            out.push({ ...r, found: txts.some(t => t.toLowerCase().includes(r.value.toLowerCase())) });
        }
    }
    const allRequiredFound = out.filter(x => x.required).every(x => x.found);
    return { updated: out, allRequiredFound };
}
