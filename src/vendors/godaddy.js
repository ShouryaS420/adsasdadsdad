// src/vendors/godaddy.js
import fetch from "node-fetch";
const GD = "https://api.godaddy.com/v1";
const H = (k, s) => ({ Authorization: `sso-key ${k}:${s}`, "content-type": "application/json" });
const J = async r => (r.ok ? r.json() : Promise.reject(new Error(`${r.status} ${r.statusText}`)));

export const godaddy = {
    id: "godaddy", name: "GoDaddy",
    async verify(domain, key, secret) {
        // existence/read check
        await fetch(`${GD}/domains/${encodeURIComponent(domain)}`, { headers: H(key, secret) }).then(J);
    },
    async getRecords(domain, key, secret) {
        const all = await fetch(`${GD}/domains/${encodeURIComponent(domain)}/records`, { headers: H(key, secret) }).then(J);
        return all.map(r => ({ type: r.type, host: r.name, value: r.data, ttl: r.ttl }));
    },
    async putOne(domain, key, secret, r) {
        // Replace records for this (type,name)
        await fetch(`${GD}/domains/${encodeURIComponent(domain)}/records/${r.type}/${encodeURIComponent(r.host)}`, {
            method: "PUT", headers: H(key, secret),
            body: JSON.stringify([{ data: r.value, ttl: r.ttl ?? 600 }])
        }).then(r => (r.ok ? null : Promise.reject(new Error(`${r.status} ${r.statusText}`))));
    },
    async upsert(domain, key, secret, desired) {
        // simple upsert: overwrite per (type,name)
        for (const d of desired) await this.putOne(domain, key, secret, d);
    },
};
