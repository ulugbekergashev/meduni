import { prisma } from "../lib/prisma";
import { estimateCost } from "./cost";

export interface UsageRecord {
  kind: string;
  model: string;
  topicId?: number | null;
  departmentId?: number | null;
  userId?: number | null;
  promptTokens?: number;
  completionTokens?: number;
  images?: number;
  ttsChars?: number;
}

/** Central AI-usage recorder — one row per generation with cost + department/user
 *  context, so the admin AI-monitoring page can aggregate spend and enforce quotas. */
export async function recordAiUsage(d: UsageRecord): Promise<void> {
  const promptTokens = d.promptTokens ?? 0;
  const completionTokens = d.completionTokens ?? 0;
  const images = d.images ?? 0;
  await prisma.aiUsage
    .create({
      data: {
        kind: d.kind,
        model: d.model,
        topicId: d.topicId ?? null,
        departmentId: d.departmentId ?? null,
        userId: d.userId ?? null,
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        images,
        ttsChars: d.ttsChars ?? 0,
        costUsd: estimateCost(d.model, promptTokens, completionTokens, images),
      },
    })
    .catch(() => {});
}
