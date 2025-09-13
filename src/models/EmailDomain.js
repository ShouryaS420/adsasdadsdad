import mongoose from "mongoose";

const EmailDomainSchema = new mongoose.Schema({

    userId: { type: mongoose.Schema.Types.ObjectId, index: true, required: true },
    domain: { type: String, index: true, required: true },
    status: {
        type: String,
        enum: ["verification_pending", "auth_required", "auth_in_progress", "authenticated", "verified", "failed"],
        default: "verification_pending",
    },
    verifyingEmail: String,
    emails: { type: [String], default: [] },
    otpHash: String,
    otpExpiresAt: Date,
    provider: mongoose.Schema.Types.Mixed, // keep loose for future provider metadata
}, { timestamps: true });

EmailDomainSchema.index({ userId: 1, domain: 1 }, { unique: true });

export default mongoose.model("EmailDomain", EmailDomainSchema);
