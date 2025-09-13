import express from "express";
import crypto from "crypto";
import { WaSession, WaConnection, WaTemplate } from "./models.js";
import {
    buildEmbeddedSignupUrl, exchangeCodeForToken, getWabas, getPhones,
    subscribeAppToWaba, fetchTemplates, FB_CONST
} from "./meta.js";
import { env } from "../config/env.js";

const router = express.Router();

/** Utility: current user & ws
 * Replace with your auth middleware; here we read from headers for demo.
 */
function ctx(req) {
    return {
        userId: req.headers["x-user-id"] || "demo-user",
        wsId: req.query.wsId || req.body.wsId || req.headers["x-ws-id"]
    };
}

/** Start ESU – returns signupUrl + sessionId (your frontend opens popup & starts polling) */
router.post("/embedded_signup/start", async (req, res) => {
    try {
        const { userId, wsId } = ctx(req);
        if (!wsId) return res.status(400).json({ error: "wsId required" });

        const sessionId = crypto.randomUUID();
        const webhookUrl = `${env.APP_URL}/api/wa/webhook?wsId=${encodeURIComponent(wsId)}`;

        await WaSession.create({
            sessionId, wsId, userId,
            phase: "oauth_started",
            webhookUrl,
            updatedAt: new Date()
        });

        const signupUrl = buildEmbeddedSignupUrl(sessionId);
        res.json({ signupUrl, sessionId });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message || "failed_to_start" });
    }
});

/** OAuth callback from Meta – closes the loop for that session */
router.get("/embedded_signup/callback", async (req, res) => {
    try {
        const { code, state } = req.query;
        if (!code || !state) throw new Error("Missing code/state");

        const s = await WaSession.findOne({ sessionId: state.toString() });
        if (!s) throw new Error("Session not found");

        // 1) exchange code -> short-lived user token
        const userToken = await exchangeCodeForToken(code.toString());

        // 2) discover WABAs this user granted
        const wabas = await getWabas(userToken);
        if (!wabas.length) {
        s.phase = "fb_connected";
        s.userAccessToken = userToken;
        s.updatedAt = new Date();
        await s.save();
        return res.send("<script>window.close();</script>Connected to Facebook, no WABA found.");
        }

        const { id: wabaId, name: businessName } = wabas[0];
        // 3) read phone numbers
        const phones = await getPhones(wabaId, userToken);
        const phone = phones[0];

        s.userAccessToken = userToken;
        s.wabaId = wabaId;
        s.businessName = businessName;
        s.phoneId = phone?.id || null;
        s.phoneNumber = phone?.display_phone_number || null;
        s.phase = phone ? "phone_connected" : "business_selected";
        s.updatedAt = new Date();
        await s.save();

        // 4) subscribe app to WABA (so webhooks fire)
        try { await subscribeAppToWaba(wabaId, FB_CONST.APP_ACCESS_TOKEN); } catch (e) { console.warn("subscribe warn:", e.message); }

        // 5) persist a connection record for the workspace
        const up = await WaConnection.findOneAndUpdate(
        { wsId: s.wsId },
        {
            wsId: s.wsId,
            businessName, wabaId,
            phoneId: s.phoneId, phoneNumber: s.phoneNumber,
            appAccessToken: FB_CONST.APP_ACCESS_TOKEN,
            updatedAt: new Date()
        },
        { upsert: true, new: true }
        );

        // 6) put session to webhook_pending (until user verifies)
        s.phase = "webhook_pending";
        await s.save();

        // minimal “close popup” page
        res.send(`
        <html><body>
            <p>WhatsApp assets linked for ${businessName}. You can close this window.</p>
            <script>window.close();</script>
        </body></html>
        `);
    } catch (e) {
        console.error("[callback]", e);
        res.status(400).send(`<pre>${e.message}</pre>`);
    }
});

/** Poll ESU session */
router.get("/embedded_signup/status", async (req, res) => {
    const { sessionId } = req.query;
    const s = await WaSession.findOne({ sessionId });
    if (!s) return res.status(404).json({ phase: "error", error: "session_not_found" });
    res.json({
        phase: s.phase,
        businessName: s.businessName,
        wabaId: s.wabaId,
        phoneId: s.phoneId,
        phoneNumber: s.phoneNumber,
        webhookUrl: s.webhookUrl,
        error: s.error
    });
});

/** Mark webhook verified (you can auto-set this inside GET /webhook verify handler) */
router.post("/webhook/verify", async (req, res) => {
    const { wsId } = ctx(req);
    const session = await WaSession.findOne({ wsId }).sort({ createdAt: -1 });
    if (!session) return res.status(404).json({ phase: "error", error: "no_session" });

    session.phase = "webhook_verified";
    session.updatedAt = new Date();
    await session.save();

    res.json({
        phase: "webhook_verified",
        businessName: session.businessName,
        wabaId: session.wabaId,
        phoneId: session.phoneId,
        phoneNumber: session.phoneNumber,
        webhookUrl: session.webhookUrl
    });
});

/** Sync templates */
router.post("/templates/sync", async (req, res) => {
    try {
        const { wsId } = ctx(req);
        const conn = await WaConnection.findOne({ wsId });
        if (!conn?.wabaId) return res.status(400).json({ error: "not_connected" });

        const tpls = await fetchTemplates(conn.wabaId, conn.appAccessToken);
        await WaTemplate.deleteMany({ wsId });

        await WaTemplate.insertMany(
            tpls.map(t => ({
                wsId,
                name: t.name,
                language: t.language,
                category: t.category,
                status: t.status,
                lastUpdateTime: t.last_update_time ? new Date(t.last_update_time) : new Date()
            }))
        );

        // update the latest session phase for the stepper
        const s = await WaSession.findOne({ wsId }).sort({ createdAt: -1 });
        if (s) { s.phase = "templates_synced"; s.updatedAt = new Date(); await s.save(); }

        res.json({ phase: "templates_synced", count: tpls.length });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message || "sync_failed" });
    }
});

export default router;
