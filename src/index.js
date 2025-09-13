import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { connectMongo } from './db/mongo.js';
import { env } from './config/env.js';
import authRoutes from './routes/auth.routes.js';
import waRoutes from "./wa/routes.js";
import waWebhook from "./wa/webhook.js";
import pipelineRoutes from "./routes/pipeline.js";
import emailDomainsRouter from "./routes/emailDomains.routes.js";
import dcTemplates from "./routes/domainconnectTemplates.js";
import { mailRunner } from './startup/mailRunnerHandle.js';
import listsRouter from "./routes/lists.routes.js";
import contactsRouter from "./routes/contacts.routes.js";
import { requireUser } from './middleware/requireUser.js';
// near the top:
import path from "path";
import { fileURLToPath } from "url";
import uploadsRouter from "./routes/uploads.routes.js";

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(express.json({ limit: '1mb' }));

// CORS (frontend at localhost:3000 by default)
const origins = env.corsOrigins.length ? env.corsOrigins : ['http://localhost:5000'];
app.use(cors({
    origin: origins,
    credentials: true
}));

// console.log(env.DC_PRIVATE_KEY_PEM);
// console.log(env.DC_PUBLIC_KEY_PEM);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_PUBLIC_DIR = path.join(__dirname, "..", "uploads");

// Serve images with long cache and CORP relaxed (helps cross-origin <img/>)
app.use(
    "/uploads",
    express.static(UPLOADS_PUBLIC_DIR, {
        maxAge: "30d",
        setHeaders: (res) => {
            res.setHeader("Cache-Control", "public, max-age=2592000, immutable");
            res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        },
    })
);

// Basic rate limit on auth
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 200 }));

app.get('/health', (req, res) => res.json({ ok: true, env: env.nodeEnv }));

app.use('/api/auth', authRoutes);

app.use("/api/wa", waRoutes);

app.use("/api/wa", waWebhook);

app.use("/api/pipeline", pipelineRoutes);

app.use('/api/email/domains', emailDomainsRouter);

// all list/contact routes require a logged-in user
app.use("/api/lists", requireUser, listsRouter);
app.use("/api/contacts", requireUser, contactsRouter);

app.use("/api/uploads", uploadsRouter);

app.use(dcTemplates);

// 404 + error handler
app.use((req, res) => res.status(404).json({ message: 'Not found' }));
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
});

function newMessageId() {
    // short URL-safe id; good enough for tracking
    return (Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)).slice(0, 22);
}

mailRunner.register("send-transactional", async (payload) => {
    const pre = await runPreflight(payload);
    if (!pre.ok) {
        const e = new Error(pre.error || "preflight_failed");
        e.meta = pre;
        throw e;
    }
    const messageId = newMessageId();
    return deliver({ ...payload, messageId });
});

connectMongo()
    .then(() => app.listen(env.port, () => console.log(`🚀 Auth on http://localhost:${env.port}`)))
    .catch(err => { console.error('Mongo connect failed', err); process.exit(1); });
