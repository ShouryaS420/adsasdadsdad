// src/vendors/cloudflare.js
import fetch from "node-fetch";
const CF = "https://api.cloudflare.com/client/v4";
const H = t => ({ Authorization: `Bearer ${t}`, "content-type": "application/json" });
const J = async r => (r.ok ? r.json() : Promise.reject(new Error(`${r.status} ${r.statusText}`)));

export const cloudflare = {
    id: "cloudflare", name: "Cloudflare",
    async verify(domain, token) {
        const z = await fetch(`${CF}/zones?name=${encodeURIComponent(domain)}`, { headers: H(token) }).then(J);
        if (!z.result?.[0]?.id) throw new Error("Zone not found in this account");
        return z.result[0].id;
    },
    async getRecords(domain, token, zoneId) {
        if (!zoneId) zoneId = await this.verify(domain, token);
        const recs = [];
        let page = 1, done = false;
        while (!done) {
            const r = await fetch(`${CF}/zones/${zoneId}/dns_records?per_page=100&page=${page}`, { headers: H(token) }).then(J);
            recs.push(...r.result.map(x => ({ id: x.id, type: x.type, host: x.name.replace(/\.$/, ""), value: x.content, ttl: x.ttl })));
            done = page >= r.result_info.total_pages; page++;
        }
        return { zoneId, recs };
    },
    async upsert(domain, token, desired) {
        const { zoneId, recs } = await this.getRecords(domain, token);
        const byKey = new Map(recs.map(r => [`${r.type} ${r.host}`.toLowerCase(), r]));
        for (const d of desired) {
            const k = `${d.type} ${d.host}`.toLowerCase();
            const existing = byKey.get(k);
            if (!existing) {
                await fetch(`${CF}/zones/${zoneId}/dns_records`, {
                    method: "POST", headers: H(token),
                    body: JSON.stringify({ type: d.type, name: d.host, content: d.value, ttl: d.ttl ?? 300 })
                }).then(J);
            } else if (String(existing.value) !== String(d.value) || (existing.ttl || 0) !== (d.ttl ?? 300)) {
                await fetch(`${CF}/zones/${zoneId}/dns_records/${existing.id}`, {
                    method: "PUT", headers: H(token),
                    body: JSON.stringify({ type: d.type, name: d.host, content: d.value, ttl: d.ttl ?? 300 })
                }).then(J);
            }
        }
    },
};
