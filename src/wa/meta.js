import { env } from "../config/env.js";

const GRAPH = "https://graph.facebook.com/v20.0";
const FB = {
    APP_ID: env.FB_APP_ID,
    APP_SECRET: env.FB_APP_SECRET,
    APP_ACCESS_TOKEN: env.FB_APP_ACCESS_TOKEN,
    REDIRECT_URI: env.FB_REDIRECT_URI
};

export function buildEmbeddedSignupUrl(sessionId) {
    // Scopes needed for ESU/WABA mgmt
    const scope = [
        "whatsapp_business_management",
        "whatsapp_business_messaging",
        "business_management"
    ].join(",");

    const q = new URLSearchParams({
        client_id: FB.APP_ID,
        redirect_uri: FB.REDIRECT_URI,
        state: sessionId,
        response_type: "code",
        scope
    });

    // ESU works through this dialog + scopes; you can add `extras` later to prefill.
    return `https://www.facebook.com/v20.0/dialog/oauth?${q.toString()}`;
}

export async function exchangeCodeForToken(code) {
    const q = new URLSearchParams({
        client_id: FB.APP_ID,
        redirect_uri: FB.REDIRECT_URI,
        client_secret: FB.APP_SECRET,
        code
    });
    const res = await fetch(`${GRAPH}/oauth/access_token?${q.toString()}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Token exchange failed");
    return data.access_token; // short-lived user token
}

export async function getWabas(userToken) {
    const res = await fetch(`${GRAPH}/me/owned_whatsapp_business_accounts?fields=id,name`, {
        headers: { Authorization: `Bearer ${userToken}` }
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error?.message || "List WABAs failed");
    return j.data || [];
}

export async function getPhones(wabaId, token) {
    const res = await fetch(`${GRAPH}/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error?.message || "List phone numbers failed");
    return j.data || [];
}

export async function subscribeAppToWaba(wabaId, token) {
    // Subscribe our app to this WABA so webhooks fire
    const res = await fetch(`${GRAPH}/${wabaId}/subscribed_apps`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error?.message || "Subscribe failed");
    return j;
}

export async function fetchTemplates(wabaId, token) {
    const res = await fetch(`${GRAPH}/${wabaId}/message_templates?limit=200`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error?.message || "Fetch templates failed");
    return j.data || [];
}

export const FB_CONST = FB;
