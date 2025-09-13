// src/startup/mailRunnerHandle.js
import { EventEmitter } from "node:events";

/**
 * Minimal in-memory job runner with concurrency.
 * No external deps. Works in ESM.
 *
 * Usage:
 *   import { mailRunner } from "../startup/mailRunnerHandle.js";
 *   mailRunner.register("send-transactional", async (payload) => { ... });
 *   mailRunner.start();
 *   await mailRunner.enqueue("send-transactional", { ... });
 */
class MailRunner extends EventEmitter {
    constructor() {
        super();
        this.queue = [];
        this.running = false;
        this.active = 0;
        this.handlers = new Map(); // type -> async function(payload)
        this.concurrency = Number(process.env.SEND_CONCURRENCY || 2);
        this.intervalMs = Number(process.env.SEND_POLL_MS || 200);
        this._tick = this._tick.bind(this);
    }

    register(type, handler) {
        if (typeof handler !== "function") throw new Error("handler must be a function");
        this.handlers.set(String(type), handler);
    }

    start() {
        if (this.running) return;
        this.running = true;
        this.emit("start");
        setTimeout(this._tick, this.intervalMs);
    }

    stop() {
        this.running = false;
        this.emit("stop");
    }

    isRunning() {
        return this.running;
    }

    size() {
        return this.queue.length;
    }

    setConcurrency(n) {
        this.concurrency = Math.max(1, Number(n) || 1);
    }

    setIntervalMs(ms) {
        this.intervalMs = Math.max(10, Number(ms) || 200);
    }

    /**
     * enqueue(type, payload)  OR  enqueue({ type, payload, id })
     * Returns a promise that resolves/rejects with the job result.
     */
    enqueue(typeOrJob, maybePayload) {
        const job =
            typeof typeOrJob === "object" && typeOrJob !== null
                ? { id: typeOrJob.id || cryptoRandom(), type: String(typeOrJob.type), payload: typeOrJob.payload }
                : { id: cryptoRandom(), type: String(typeOrJob), payload: maybePayload };

        return new Promise((resolve, reject) => {
            this.queue.push({ job, resolve, reject });
            // nudge the loop
            if (this.running) setTimeout(this._tick, 0);
        });
    }

    async _tick() {
        if (!this.running) return;

        while (this.active < this.concurrency && this.queue.length > 0) {
            const item = this.queue.shift();
            if (!item) break;
            this._runOne(item).catch(() => { });
        }

        // schedule next tick
        if (this.running) setTimeout(this._tick, this.intervalMs);
    }

    async _runOne(wrapper) {
        const { job, resolve, reject } = wrapper;
        const { id, type, payload } = job;
        const handler = this.handlers.get(type);

        this.active++;
        this.emit("job:start", { id, type, payload });

        try {
            if (!handler) {
                const err = new Error(`No handler registered for job type "${type}"`);
                err.code = "NO_HANDLER";
                throw err;
            }
            const result = await handler(payload);
            this.emit("job:done", { id, type, result });
            resolve({ ok: true, result });
        } catch (err) {
            this.emit("job:error", { id, type, error: err });
            reject(err);
        } finally {
            this.active--;
        }
    }
}

function cryptoRandom() {
    // small, URL-safe id
    return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export const mailRunner = new MailRunner();
export function startMailRunner() { mailRunner.start(); return mailRunner; }
export function stopMailRunner() { mailRunner.stop(); }
