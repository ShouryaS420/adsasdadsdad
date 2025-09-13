import Campaign from "../models/Campaign.js";
import { computeWinner } from "../services/ab/selectVariant.js";

export async function runAbAutoDecider() {
    const now = new Date();
    const toDecide = await Campaign.find({
        "ab.enabled": true,
        "ab.status": "running",
        "ab.decideAt": { $lte: now },
        "ab.winnerKey": { $exists: false },
    }).limit(20);

    for (const c of toDecide) {
        const winner = computeWinner(c.ab);
        c.ab.winnerKey = winner;
        c.ab.status = "locked";
        await c.save();
        // (optional) notify the user
    }
}
