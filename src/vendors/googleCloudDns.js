// src/vendors/googleCloudDns.js
import { google } from "googleapis";

function authFromSa(saJson) {
    const sa = JSON.parse(saJson);
    return new google.auth.JWT(sa.client_email, null, sa.private_key, ["https://www.googleapis.com/auth/ndev.clouddns.readwrite"]);
}

export const gcloud = {
    id: "google-cloud-dns", name: "Google Cloud DNS",
    async verify(projectId, managedZone, saJson) {
        const auth = authFromSa(saJson); const dns = google.dns({ version: "v1", auth });
        await dns.managedZones.get({ project: projectId, managedZone });
    },
    async getRecords(domain, projectId, managedZone, saJson) {
        const auth = authFromSa(saJson); const dns = google.dns({ version: "v1", auth });
        const r = await dns.resourceRecordSets.list({ project: projectId, managedZone, maxResults: 5000 });
        return (r.data.rrsets || []).map(x => ({
            type: x.type, host: x.name.replace(/\.$/, ""), value: Array.isArray(x.rrdatas) ? x.rrdatas[0] : x.rrdatas, ttl: x.ttl
        }));
    },
    async upsert(domain, projectId, managedZone, saJson, desired) {
        const auth = authFromSa(saJson); const dns = google.dns({ version: "v1", auth });
        const cur = await dns.resourceRecordSets.list({ project: projectId, managedZone, maxResults: 5000 });
        const current = cur.data.rrsets || [];

        const key = r => `${r.type} ${r.name}`.toLowerCase();
        const want = desired.map(d => ({ type: d.type, name: (d.host.endsWith(".") ? d.host : `${d.host}.`) + (d.host.endsWith(".") ? "" : ""), rrdatas: [d.value], ttl: d.ttl ?? 300, kind: "dns#resourceRecordSet", name: d.host.endsWith(".") ? d.host : `${d.host}.` });
        // normalize names to FQDN
        for (const w of want) if (!w.name.endsWith(".")) w.name = `${w.name}.`;

        const mapCur = new Map(current.map(r => [key({ type: r.type, name: r.name }), r]));
        const toAdd = [], toDel = [];
        for (const w of want) {
            const k = key({ type: w.type, name: w.name });
            const ex = mapCur.get(k);
            if (!ex) { toAdd.push(w); continue; }
            if (ex.ttl !== w.ttl || String(ex.rrdatas) !== String(w.rrdatas)) { toDel.push(ex); toAdd.push(w); }
        }
        if (!toAdd.length && !toDel.length) return;

        await dns.changes.create({ project: projectId, managedZone, requestBody: { additions: toAdd, deletions: toDel } });
    },
};
