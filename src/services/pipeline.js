// services/pipeline.js
import Pipeline from "../models/Pipeline.js";
import { STARTERS, inferPaymentStageKey } from "./pipelineDefaults.js";
import { Types } from "mongoose";

export async function ensureDefaultPipeline({ workspaceId, category }) {
    let pipe = await Pipeline.findOne({ workspaceId });
    if (pipe) return pipe;

    const seeds = STARTERS[category] || STARTERS.local_services;
    const stages = seeds.map((s, i) => ({
        id: new Types.ObjectId().toString(),
        key: s.key,
        name: s.name,
        order: i,
        terminal: s.terminal ?? null,
    }));

    const payKey = inferPaymentStageKey(seeds.map((s) => s.key));
    const payStage = payKey ? stages.find((s) => s.key.includes(payKey)) : null;

    pipe = await Pipeline.create({
        workspaceId,
        category,
        mode: "default",
        version: 1,
        locked: true,
        stages,
        integrations: {
            assignment: "round_robin",
            whatsapp: { enabled: true, onStageEnter: {} },
            email: { enabled: true, onStageEnter: {} },
            payments: {
                enabled: !!payStage,
                provider: "razorpay",
                attachOnStageId: payStage ? payStage.id : null,
            },
        },
    });

    return pipe;
}
