// models/Pipeline.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const StageSchema = new Schema(
    {
        id: { type: String, required: true }, // keep client/server id 1:1
        key: { type: String, required: true }, // stable key (e.g., "quoted")
        name: { type: String, required: true },
        order: { type: Number, required: true },
        terminal: { type: String, enum: ["won", "lost", null], default: null },
        probability: { type: Number, min: 0, max: 100 },
    },
    { _id: false }
);

const IntegrationsSchema = new Schema(
    {
        assignment: {
            type: String,
            enum: ["round_robin", "single_owner"],
            default: "round_robin",
        },
        defaultOwner: { type: String, default: "" },

        whatsapp: {
            enabled: { type: Boolean, default: true },
            onStageEnter: { type: Map, of: String, default: {} },
        },
        email: {
            enabled: { type: Boolean, default: true },
            onStageEnter: { type: Map, of: String, default: {} },
        },
        payments: {
            enabled: { type: Boolean, default: false },
            provider: { type: String, enum: ["razorpay", "stripe"], default: "razorpay" },
            attachOnStageId: { type: String, default: null },
        },
    },
    { _id: false }
);

const PipelineSchema = new Schema(
    {
        workspaceId: { type: String, index: true, required: true, unique: true },
        category: { type: String, index: true }, // local_services | d2c | clinics
        mode: { type: String, enum: ["default", "custom"], default: "default" },
        version: { type: Number, default: 1 },
        locked: { type: Boolean, default: true },

        stages: { type: [StageSchema], default: [] },
        integrations: { type: IntegrationsSchema, default: {} },
    },
    { timestamps: true }
);

export default mongoose.models.Pipeline ||
  mongoose.model("Pipeline", PipelineSchema);
