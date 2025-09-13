import AudienceList from "../models/AudienceList.js";

/** Get or create the user's default list */
export async function getOrCreateDefaultList(req, res) {
    const userId = req.user._id;
    const list = await AudienceList.findOneAndUpdate(
        { userId, isDefault: true },
        { $setOnInsert: { userId, name: "My Contacts", isDefault: true } },
        { new: true, upsert: true }
    ).lean();
    res.json(list);
}

/** Helper used by contacts controller */
export async function ensureDefaultList(userId) {
    return AudienceList.findOneAndUpdate(
        { userId, isDefault: true },
        { $setOnInsert: { userId, name: "My Contacts", isDefault: true } },
        { new: true, upsert: true }
    );
}
