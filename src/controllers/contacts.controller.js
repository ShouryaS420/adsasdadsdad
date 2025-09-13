import Contact from "../models/Contact.js";
import AudienceList from "../models/AudienceList.js";
import { ensureDefaultList } from "./lists.controller.js";

function cleanContactPayload(body = {}) {
    const email = String(body.email || "").trim().toLowerCase();
    const firstName = body.firstName?.trim() || undefined;
    const lastName = body.lastName?.trim() || undefined;
    const note = body.note?.trim() || undefined;
    const status = body.status && ["subscribed", "unsubscribed", "bounced"].includes(body.status)
        ? body.status : "subscribed";
    return { email, firstName, lastName, note, status };
}

async function resolveListId(req) {
    // use provided listId if it belongs to the user; else default
    const userId = req.user._id;
    const fromQuery = req.query.listId;
    const fromBody = req.body?.listId;
    const candidate = fromQuery || fromBody;

    if (candidate) {
        const owned = await AudienceList.findOne({ _id: candidate, userId }).lean();
        if (owned) return owned._id;
    }
    const def = await ensureDefaultList(userId);
    return def._id;
}

export async function listContacts(req, res) {
    const userId = req.user._id;
    const listId = await resolveListId(req);

    const docs = await Contact.find({ userId, listId }).sort({ createdAt: -1 }).lean();
    res.json(docs);
}

export async function createContact(req, res) {
    const userId = req.user._id;
    const listId = await resolveListId(req);
    const { email, firstName, lastName, note, status } = cleanContactPayload(req.body);

    if (!email || !email.includes("@")) {
        return res.status(400).json({ error: "Valid email is required" });
    }

    try {
        const doc = await Contact.create({ userId, listId, email, firstName, lastName, note, status });
        res.status(201).json(doc);
    } catch (e) {
        if (e?.code === 11000) {
            // duplicate -> return existing
            const existing = await Contact.findOne({ userId, listId, email }).lean();
            return res.status(200).json(existing);
        }
        throw e;
    }
}

export async function importContacts(req, res) {
    const userId = req.user._id;
    const listId = await resolveListId(req);
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];

    const toUpsert = rows
        .map(cleanContactPayload)
        .filter(r => r.email && r.email.includes("@"));

    if (toUpsert.length === 0) return res.json({ items: [] });

    const bulkOps = toUpsert.map(r => ({
        updateOne: {
            filter: { userId, listId, email: r.email },
            update: { $setOnInsert: { userId, listId, ...r } },
            upsert: true
        }
    }));

    await Contact.bulkWrite(bulkOps, { ordered: false });

    // return the affected contacts (by the emails we just processed)
    const emails = toUpsert.map(r => r.email);
    const docs = await Contact.find({ userId, listId, email: { $in: emails } })
        .sort({ createdAt: -1 })
        .lean();

    res.json({ items: docs });
}
