import mongoose from "mongoose";
const { Schema, model } = mongoose;

const AudienceListSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        name: { type: String, required: true },
        isDefault: { type: Boolean, default: false, index: true }
    },
    { timestamps: true }
);

// One default list per user (soft-enforced in controller; index helps queries)
AudienceListSchema.index({ userId: 1, name: 1 }, { unique: true });

export default model("AudienceList", AudienceListSchema);
