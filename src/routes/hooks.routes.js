// src/routes/hooks.routes.js
import { Router } from "express";
import Message from "../models/Message.js";
import { addSuppression } from "../utils/suppressions.js";
import { env } from "../config/env.js";

const r = Router();

// simple auth: send header X-Auth: <WEBHOOK_SECRET>
function checkAuth(req, res, next) {
    const need = env.WEBHOOK_SECRET;
    if (!need) return next(); // dev mode
    if (req.get("x-auth") === need) return next();
    return res.sendStatus(401);
}
r.use("/hooks", checkAuth);

// Bounce: { messageId?, to, hard:boolean, reason?, code? }
r.post("/hooks/bounce", async (req, res) => {
    const { messageId, to, hard, reason, code } = req.body || {};
    if (!to && !messageId) return res.status(400).json({ error: "to or messageId required" });

    if (messageId) {
        await Message.updateOne(
            { messageId },
            {
                $inc: { "counts.bounces": 1 },
                $set: { lastEventAt: new Date(), status: "failed" },
                $push: { events: { type: "bounce", ts: new Date(), meta: { kind: hard ? "hard" : "soft", reason, code } } },
            }
        ).exec();
    }
    if (hard && to) { try { await addSuppression({ email: to, reason: "bounce-hard", source: "webhook" }); } catch { } }

    res.json({ ok: true });
});

// Complaint: { messageId?, to, feedbackType? }
r.post("/hooks/complaint", async (req, res) => {
    const { messageId, to, feedbackType } = req.body || {};
    if (!to && !messageId) return res.status(400).json({ error: "to or messageId required" });

    if (messageId) {
        await Message.updateOne(
            { messageId },
            {
                $inc: { "counts.complaints": 1 },
                $set: { lastEventAt: new Date() },
                $push: { events: { type: "complaint", ts: new Date(), meta: { feedbackType } } },
            }
        ).exec();
    }
    if (to) { try { await addSuppression({ email: to, reason: "complaint", source: "webhook" }); } catch { } }

    res.json({ ok: true });
});

export default r;
