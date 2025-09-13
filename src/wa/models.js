import mongoose from "mongoose";

const WaSessionSchema = new mongoose.Schema({
    sessionId: { type: String, index: true },
    wsId: String,
    userId: String,

    phase: {
        type: String,
        enum: [
            "idle","oauth_started","fb_connected","business_selected",
            "phone_connected","webhook_pending","webhook_verified",
            "templates_synced","connected","error"
        ],
        default: "idle"
    },

    // Meta/WABA info we discover along the way
    businessName: String,
    wabaId: String,
    phoneId: String,
    phoneNumber: String,

    // For UI copy button
    webhookUrl: String,

    // Short-lived user token we get from OAuth
    userAccessToken: String,

    // errors
    error: String,

    createdAt: { type: Date, default: Date.now },
    updatedAt: Date
}, { versionKey: false });

export const WaSession = mongoose.model("WaSession", WaSessionSchema);

const WaConnectionSchema = new mongoose.Schema({
    wsId: { type: String, index: true, unique: true },
    businessName: String,
    wabaId: String,
    phoneId: String,
    phoneNumber: String,

    // Token you’ll actually use to call Graph (recommend: System User long-lived)
    appAccessToken: String,

    createdBy: String,
    createdAt: { type: Date, default: Date.now },
    updatedAt: Date
}, { versionKey: false });

export const WaConnection = mongoose.model("WaConnection", WaConnectionSchema);

const WaTemplateSchema = new mongoose.Schema({
    wsId: { type: String, index: true },
    name: String,
    language: String,
    category: String,
    status: String,
    lastUpdateTime: Date
}, { versionKey: false });

export const WaTemplate = mongoose.model("WaTemplate", WaTemplateSchema);
