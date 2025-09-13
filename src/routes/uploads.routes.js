// src/routes/uploads.routes.js
import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { requireUser } from "../middleware/requireUser.js";

const router = Router();

// Resolve a stable /uploads directory at the project root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads", "images");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Multer disk storage with safe filenames
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname || "").toLowerCase();
        const id =
            (crypto.randomUUID && crypto.randomUUID()) ||
            crypto.randomBytes(16).toString("hex");
        cb(null, `${id}${ext || ".bin"}`);
    },
});

const fileFilter = (_req, file, cb) => {
    // Allow common image types
    if (/^image\/(png|jpe?g|gif|webp|svg\+xml)$/i.test(file.mimetype)) return cb(null, true);
    cb(new Error("unsupported_file_type"));
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

// POST /api/uploads/images  (form-data key: "file")
router.post("/images", requireUser, upload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "no_file" });
    const urlPath = `/uploads/images/${req.file.filename}`; // relative URL
    return res.status(201).json({ url: urlPath });
});

export default router;
