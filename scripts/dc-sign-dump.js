// scripts/dc-sign-dump.js
import fs from "fs";
import crypto from "crypto";

function b64url(buf) {
    return Buffer.from(buf).toString("base64")
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

// ---- fill these with your real values ----
const domain = "99squarewall.xyz";
const providerId = "magneticbyteinternettechnologiesopcpvtltd.in";
const serviceId = "email-auth";
const redirectUri = "https://auth.magneticbyteinternettechnologiesopcpvtltd.in/api/domainconnect/callback.html";
const keyHost = "key1";
const selector1 = "k1";
const selector2 = "k2";
const rua = "mailto:dmarc@yourco.example";
// optional but useful:
const state = "test-state";
// your real private key file (full PEM including BEGIN/END):
const privatePem = `
-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCmZVX6u1d3G1nb
3zcL4BQ8SSdJeVnwEOjZS+LBKlvT8WebmbM9tjw3NHAINKOgvu6WLHbiGWAdwKRA
w/o2yiuIRRO9shiQTtYjVNdNIyWauJzi0hgCmbewofoKADnoQbSI71wFh7gZS/fq
kdAHElZPjG6eSobpKUKRSOY1tHbX06hDvmWaWFYwILjj0NP4N4L3OsH1dmABk5Zc
Dd5Bh5maN8qRlV6jrft5eKyIus6eIYWvXhX3yMHU7w99hR13J8mBC7pVOUDJQwew
1QlssszmXEzOV/HEMEqEmJW/amSRCRaGm/e+1e3lUWAZ/WZxFl0ExrZShVCiIuTf
SAs09g1xAgMBAAECggEAAWw+HUhlG8IPN//8ph3Iwdh2Cm+Rb99Oz2ix8AkJFfA4
sfoGgDzG1GnEJWTRAJ9mAMDxSgxcSprWk2LISM1HIfmFvQEJAIcPtz0AVjhKh+F5
NB+75/NJVgxs2/v9zW/Y5RTHY0PNJKMQ4/0H079R1L5YmzgbzIJPX6N0APyZtCLH
Z50DCPRqkzpn2SIx0+FGqyf+QsQjyJcuPalzCRdnwQXIjw2uKt040xTMDzc+1/Rv
g9OIB5zUN0JxDesSE4fgoC40cpOyOfFFZAC50sX/lOZave9Niyw/1CLvbUv3uRxd
ZlCqke+kwmwYoAteCQw4+WrxWIeP3EKNWV2nZP8GgQKBgQDqJP24qzw4XghLEXbd
n4AJIlC5FEZmIVPFA3U0J6HbAkp7oYn+IQaJUBD0Hda3ikRE9TOhlnT6jjhonu2/
ZC2LZG93rG3rOyvTM7ngZW+ZM+CDZIoT6MVubwjY7p7/UqcdJKGsc4Z0BTfxhXJU
YqDHJFZAG3TZCT1FZMumt+bT8QKBgQC17XRFcQVu40hU6DYtPrw7NjDGZgZQ7Z48
0+reVNDxtGAfkc0+ZlzcKtCyN01l6UfxkXWLJVk5c0bTUjlNmfD8tmN/xeYBWeZw
ikM4j4E+TsOiEh8wwKBRBAPfxUKnjSm7oTx2NR+rB5NVaPLsLeGQ019G+bY1uaga
MO1RR/ZRgQKBgQCtwx33+jwKqN4Gt8M63a+rF6hIcd9806bTQqmsNu1LFvwnm85I
pkGvjZfHUo2SUC4x7raOaJYPi5QZMDjIHJQgKjz+1xwLwjHX3z9GZIDZdUJcwDQo
akp6ljQ+qXedi70xR4oj7OgPGgBWYO5j6X3fy/umP7oLh2vNH+xyoW/QQQKBgQCb
LmcFbLizs49ZTZIY2fB5mWnVceVlVqqpPCKVb0ejRLbRdu7ZkTsYWjUWL3IHwgsq
FWdsP3lyNdBuJS7X8L3M8k7BCK9+645S5L0eG9qkqU7aihas4UJemMwtLfgDL7gv
YgNO2VWf76BPNGwx5ZkIjiQxSIOSJEEtxhpIQNftAQKBgEmsVibMF5PeNJpdk+AB
uMcab8gS45rKQCLX/jd9kF/2zjfXYwcwJ4HFHDU1B8Vtemn2k4g3PM1g74+syUYN
0t/MRRx6/nUhQXeZ9TrfOQqe/7+xZyYmP12bwYVyM0uc1Y7zRWNcvK2iTFvsamW8
r+sDB0HvBpS11OGgNLbX5dxe
-----END PRIVATE KEY-----`;
// -----------------------------------------

// Build sorted query INCLUDING `key` (exclude only `sig`)
const params = new URLSearchParams();
params.set("domain", domain);
params.set("providerId", providerId);
params.set("serviceId", serviceId);
params.set("redirect_uri", redirectUri);
params.set("key", keyHost);
params.set("selector1", selector1);
params.set("selector2", selector2);
params.set("rua", rua);
if (state) params.set("state", state);

const canonical = new URLSearchParams(
    [...params.entries()].sort(([a], [b]) => a.localeCompare(b))
).toString();

const signer = crypto.createSign("RSA-SHA256");
signer.update(canonical);
signer.end();
const sig = b64url(signer.sign(privatePem));

console.log("CANONICAL:");
console.log(canonical);
console.log("\nSIG (base64url):");
console.log(sig);

// Use the UI base you got from discovery (GoDaddy = https://dcc.godaddy.com/manage)
const urlSyncUX = "https://dcc.godaddy.com/manage"; // <— important

// If you want the full apply URL you’d open:
const applyBase = `${urlSyncUX}/v2/domainTemplates`
  + `/providers/${encodeURIComponent(providerId)}`
  + `/services/${encodeURIComponent(serviceId)}/apply`;

console.log("\nAPPLY URL:");
console.log(`${applyBase}?${canonical}&sig=${encodeURIComponent(sig)}`);
  // console.log(`${applyBase}?${canonical}&sig=${encodeURIComponent(sig)}`);
  