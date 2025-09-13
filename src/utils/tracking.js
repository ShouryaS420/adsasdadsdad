// src/utils/tracking.js
import { env } from "../config/env.js";

const APP_URL = env.APP_URL || env.PUBLIC_APP_URL || "http://localhost:3000"; // where your app serves pixel/click routes

export function b64urlEncode(s) {
    const b64 = Buffer.from(String(s), "utf8").toString("base64");
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
export function b64urlDecode(s) {
    const pad = (s) => s + "===".slice((s.length + 3) % 4);
    const b64 = pad(String(s).replace(/-/g, "+").replace(/_/g, "/"));
    return Buffer.from(b64, "base64").toString("utf8");
}

export function buildOpenPixelUrl(messageId) {
    return `${APP_URL}/t/o/${encodeURIComponent(messageId)}.png`;
}

export function buildClickUrl(messageId, targetUrl) {
    const u = b64urlEncode(targetUrl);
    return `${APP_URL}/t/c/${encodeURIComponent(messageId)}/${u}`;
}

/**
 * Inject a 1x1 pixel right before </body>. If no body, append to end.
 */
export function injectOpenPixel(html, messageId) {
    const pixel = `<img src="${buildOpenPixelUrl(messageId)}" width="1" height="1" alt="" style="display:none" />`;
    if (!html) return html;
    const i = html.lastIndexOf("</body>");
    if (i === -1) return html + pixel;
    return html.slice(0, i) + pixel + html.slice(i);
}

/**
 * Rewrite all http(s) links to tracking redirects.
 * Keeps mailto:, tel:, #, and relative links untouched.
 */
export function rewriteLinksForTracking(html, messageId) {
    if (!html) return html;
    return html.replace(
        /href\s*=\s*"(.*?)"/gi,
        (m, href) => {
            const url = String(href || "").trim();
            if (!/^https?:\/\//i.test(url)) return m; // skip mailto/tel/anchors/relative
            const tracked = buildClickUrl(messageId, url);
            return `href="${tracked}"`;
        }
    );
}
