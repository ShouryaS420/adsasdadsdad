// src/vendors/hostinger.js
import fetch from "node-fetch";
const BASE = "https://developers.hostinger.com";
const auth = t => ({ Authorization: `Bearer ${t}`, "content-type": "application/json" });
const j = async r => (r.ok ? r.json() : Promise.reject(new Error(`${r.status} ${r.statusText}`)));

export const hostinger = {
    id: "hostinger", name: "Hostinger",
    async verify(domain, token) { await fetch(`${BASE}/api/dns/v1/zones/${domain}`, { headers: auth(token) }).then(j); },
    async getRecords(domain, token) {
        const z = await fetch(`${BASE}/api/dns/v1/zones/${domain}`, { headers: auth(token) }).then(j);
        return (z.records || []).map(r => ({ type: r.type, host: r.name || r.host || "@", value: r.value ?? r.data, ttl: r.ttl ?? 300 }));
    },
    async upsert(domain, token, desired) {
        const body = { records: desired.map(r => ({ type: r.type, name: r.host, value: r.value, ttl: r.ttl ?? 300 })) };
        await fetch(`${BASE}/api/dns/v1/zones/${domain}`, { method: "PUT", headers: auth(token), body: JSON.stringify(body) }).then(j);
    },
};
