// routes/pipeline.js
import { Router } from "express";
import { Types } from "mongoose";
import Pipeline from "../models/Pipeline.js";
import { ensureDefaultPipeline } from "../services/pipeline.js";
import { STARTERS } from "../services/pipelineDefaults.js";
import { auth } from "../middleware/auth.js";

const r = Router();

/** GET /api/pipeline?wsId=...&category=local_services
 *  Returns { pipeline, deals } — auto-creates default if missing.
 */
r.get("/", async (req, res) => {
    try {
        const wsId = String(req.query.wsId || "");
        const category = String(req.query.category || "local_services");
        if (!wsId) return res.status(400).json({ message: "wsId required" });

        let pipeline = await Pipeline.findOne({ workspaceId: wsId }).lean();
        if (!pipeline) {
            pipeline = (await ensureDefaultPipeline({ workspaceId: wsId, category })).toObject();
        }

        const deals = await Deal.find({
            workspaceId: wsId,
            pipelineId: String(pipeline._id),
        })
        .sort({ updatedAt: -1 })
        .lean();

        res.json({ pipeline, deals });
    } catch (e) {
        console.log("GET /api/pipeline error", e);
        res.status(500).json({ message: "Failed to load pipeline" });
    }
});

/** GET /api/pipeline/defaults?category=local_services */
r.get("/defaults", async (req, res) => {
    const cat = req.query.category || "local_services";
    res.json({ stages: STARTERS[cat] || STARTERS.local_services });
});

/** POST /api/pipeline/publish
 * body: { wsId, stages:[{id?, key?, name, order, terminal?, probability?}], integrations, mode }
 */
r.post("/publish", async (req, res) => {
    try {
        const { wsId, stages = [], integrations = {}, mode = "custom" } = req.body;
        if (!wsId) return res.status(400).json({ message: "wsId required" });
        if (!Array.isArray(stages) || stages.length === 0) {
            return res.status(400).json({ message: "stages required" });
        }

        const normalized = stages
            .slice()
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            .map((s, i) => {
                const id = s.id || new Types.ObjectId().toString();
                const key =
                s.key ||
                (s.name || "")
                    .toLowerCase()
                    .trim()
                    .replace(/\s+/g, "_")
                    .replace(/[^a-z0-9_]/g, "");
                return {
                    id,
                    key,
                    name: s.name,
                    order: s.order ?? i,
                    terminal: s.terminal ?? null,
                    probability: s.probability ?? undefined,
                };
            });

        const pipe = await Pipeline.findOneAndUpdate(
            { workspaceId: wsId },
            {
                $set: {
                stages: normalized,
                integrations,
                mode,
                locked: true,
                },
                $inc: { version: 1 },
            },
            { upsert: true, new: true }
        );

        // fix deals pointing to removed stages -> move to first stage
        const valid = new Set(pipe.stages.map((s) => s.id));
        const firstId = pipe.stages[0]?.id;
        if (firstId) {
            await Deal.updateMany(
                { workspaceId: wsId, pipelineId: String(pipe._id), stageId: { $nin: Array.from(valid) } },
                { $set: { stageId: firstId } }
            );
        }

        res.json({ ok: true, pipeline: pipe });
    } catch (e) {
        console.log("POST /api/pipeline/publish error", e);
        res.status(500).json({ message: "Publish failed" });
    }
});

/** POST /api/pipeline/deals
 * body: { wsId, title, stageId, value?, currency?, contact? {firstName,lastName,phone,email}, ownerId? }
 */
r.post("/deals", async (req, res) => {
    try {
        const { wsId, title, stageId, value, currency, contact, ownerId } = req.body;
        if (!wsId || !title || !stageId)
        return res.status(400).json({ message: "wsId, title, stageId required" });

        const pipe = await Pipeline.findOne({ workspaceId: wsId });
        if (!pipe) return res.status(404).json({ message: "Pipeline not found" });
        if (!pipe.stages.some((s) => s.id === stageId)) {
            return res.status(400).json({ message: "Invalid stageId" });
        }

        // Upsert/find contact by phone/email (either)
        let contactId = null;
        if (contact?.phone || contact?.email) {
            const or = [];
            if (contact.phone) or.push({ phone: contact.phone });
            if (contact.email) or.push({ email: contact.email });

            let c = await Contact.findOne({
                workspaceId: wsId,
                ...(or.length ? { $or: or } : {}),
            });

            if (!c) {
                c = await Contact.create({
                workspaceId: wsId,
                firstName: contact.firstName || "",
                lastName: contact.lastName || "",
                phone: contact.phone || null,
                email: contact.email || null,
                source: "pipeline",
                createdBy: req.user?.id || null,
                });
            }
            contactId = String(c._id);
        }

        const deal = await Deal.create({
            workspaceId: wsId,
            pipelineId: String(pipe._id),
            stageId,
            title,
            value,
            currency: currency || "INR",
            contactId,
            ownerId: ownerId || null,
        });

        res.json({ deal });
    } catch (e) {
        console.log("POST /api/pipeline/deals error", e);
        res.status(500).json({ message: "Create deal failed" });
    }
});

/** PATCH /api/pipeline/deals/:id/move
 * body: { wsId, stageId }
 */
r.patch("/deals/:id/move", async (req, res) => {
    try {
        const { id } = req.params;
        const { wsId, stageId } = req.body;
        if (!wsId || !stageId) return res.status(400).json({ message: "wsId and stageId required" });

        const pipe = await Pipeline.findOne({ workspaceId: wsId });
        if (!pipe) return res.status(404).json({ message: "Pipeline not found" });
        if (!pipe.stages.some((s) => s.id === stageId))
        return res.status(400).json({ message: "Invalid stageId" });

        const deal = await Deal.findOneAndUpdate(
            { _id: id, workspaceId: wsId },
            { $set: { stageId } },
            { new: true }
        );
        if (!deal) return res.status(404).json({ message: "Deal not found" });

        res.json({ deal });
    } catch (e) {
        console.log("PATCH /api/pipeline/deals/:id/move error", e);
        res.status(500).json({ message: "Move failed" });
    }
});

/** PATCH /api/pipeline/stages/reorder
 * body: { wsId, order: [stageId1, stageId2, ...] }
 */
r.patch("/stages/reorder", async (req, res) => {
    try {
        const { wsId, order = [] } = req.body;
        if (!wsId || !Array.isArray(order))
        return res.status(400).json({ message: "wsId and order[] required" });

        const pipe = await Pipeline.findOne({ workspaceId: wsId });
        if (!pipe) return res.status(404).json({ message: "Pipeline not found" });

        const pos = new Map(order.map((id, i) => [String(id), i]));
        pipe.stages = pipe.stages
        .map((s) => ({ ...(s.toObject?.() ?? s), order: pos.get(s.id) ?? s.order }))
        .sort((a, b) => a.order - b.order);

        pipe.version += 1;
        pipe.markModified("stages");
        await pipe.save();

        res.json({ pipeline: pipe });
    } catch (e) {
        console.log("PATCH /api/pipeline/stages/reorder error", e);
        res.status(500).json({ message: "Reorder failed" });
    }
});

export default r;
