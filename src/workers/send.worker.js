import { Worker } from "bullmq";
import { env } from "../config/env.js";
import { makeTransport, dkimFor } from "../services/send/transport.js";
import { preflightAndBuildHeaders } from "../services/send/enqueue.js";
import Message from "../models/Message.js";

const connection = { connection: { url: env.REDIS_URL || "redis://127.0.0.1:6379" } };
const transport = makeTransport();

function norm(s = "") { return String(s || ""); }

export const worker = new Worker("mail", async (job) => {
    const id = job.data.messageId;
    const doc = await Message.findById(id);
    if (!doc) return;

    try {
        doc.status = "sending";
        doc.attemptCount = (doc.attemptCount || 0) + 1;
        doc.lastAttemptAt = new Date();
        await doc.save();

        const { listHeaders, fromDomain } = await preflightAndBuildHeaders({
            userId: doc.userId, from: doc.from, to: doc.to, campaignId: doc.campaignId || null,
        });

        const dkim = dkimFor(fromDomain);

        const info = await transport.sendMail({
            envelope: { from: env.BOUNCE_FROM || doc.from, to: [doc.to] }, // Return-Path (bounces)
            from: doc.from,
            to: doc.to,
            subject: norm(doc.subject),
            html: norm(doc.html),
            text: norm(doc.text),
            headers: listHeaders,
            dkim, // DKIM signing (selector must exist in DNS via your CNAME!)
        });

        doc.status = "sent";
        doc.messageId = info?.messageId || null;
        doc.error = undefined;
        await doc.save();
    } catch (err) {
        doc.status = "failed";
        doc.error = String(err?.message || err);
        await doc.save();
        throw err; // let BullMQ retry with backoff
    }
}, connection);

// (optional) log worker events
worker.on("failed", (job, err) => console.error("send failed", job?.id, err?.message));
worker.on("completed", (job) => console.log("send ok", job?.id));
