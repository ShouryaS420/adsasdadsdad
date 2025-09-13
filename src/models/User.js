import mongoose from 'mongoose';

const refreshSchema = new mongoose.Schema({
    jti: { type: String, required: true },
    tokenHash: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    userAgent: String,
    ip: String,
    revoked: { type: Boolean, default: false }
}, { _id: false });

const userSchema = new mongoose.Schema({
    businessName: { type: String, trim: true },
    industry:     { type: String, trim: true },     // category
    subcategory:  { type: String, trim: true },     // NEW
    email: { type: String, unique: true, index: true, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, trim: true },
    role: { type: String, enum: ['owner', 'admin', 'agent'], default: 'owner' },
    // WhatsApp integration flags (future)
    wa: {
        connected: { type: Boolean, default: false },
        wabaId: String,
        phoneNumberId: String,
        phone: String,
        templatesApproved: { type: Number, default: 0 }
    },
    refreshTokens: [refreshSchema]
}, { timestamps: true });

export const User = mongoose.model('User', userSchema);
