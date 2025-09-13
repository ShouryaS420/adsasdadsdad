import mongoose from "mongoose";
const { Schema, model } = mongoose;

const ContactSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        listId: { type: Schema.Types.ObjectId, ref: "AudienceList", required: true, index: true },
        email: { type: String, required: true, lowercase: true, trim: true },
        firstName: { type: String, trim: true },
        lastName: { type: String, trim: true },
        note: { type: String, trim: true },
        status: { type: String, enum: ["subscribed", "unsubscribed", "bounced"], default: "subscribed" }
    },
    { timestamps: true }
);

// prevent duplicates inside a list for a user
ContactSchema.index({ userId: 1, listId: 1, email: 1 }, { unique: true });

export default model("Contact", ContactSchema);
