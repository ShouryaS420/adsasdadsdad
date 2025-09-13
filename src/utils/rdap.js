const BASE = 'https://rdap.org';

async function fetchJson(url, { timeout = 6000 } = {}) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    try {
        const res = await fetch(url, { signal: ctrl.signal, headers: { 'accept': 'application/rdap+json, application/json' } });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return await res.json();
    } finally {
        clearTimeout(t);
    }
}

export function fetchDomainRDAP(domain) {
    return fetchJson(`${BASE}/domain/${encodeURIComponent(domain)}`);
}

export function fetchNameserverRDAP(nsHost) {
    return fetchJson(`${BASE}/nameserver/${encodeURIComponent(nsHost)}`);
}
