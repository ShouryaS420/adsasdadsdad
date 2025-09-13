import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { env } from "../config/env.js";

export function requireUser(req, res, next) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (token) {
        try {
            const payload = jwt.verify(token, env.accessSecret || "dev");
            const id = payload.sub || payload.userId || payload._id;
            if (!id) throw new Error("no id in token");
            req.user = { _id: new mongoose.Types.ObjectId(String(id)) };
            return next();
        } catch (e) {
            return res.status(401).json({ error: "Unauthorized" });
        }
    }

    // Dev-only escape hatch (optional)
    if (env.ALLOW_DEV_WITHOUT_JWT === "1" && env.DEV_USER_ID) {
        req.user = { _id: new mongoose.Types.ObjectId(env.DEV_USER_ID) };
        return next();
    }

    return res.status(401).json({ error: "Unauthorized" });
}
