import { prisma } from "../lib/prisma";

// The glossary feature (curated terminology injected into AI prompts) was removed
// per product decision. Only the department resolver — used by AI quota enforcement
// and usage accounting — remains here.

/** Resolve a topic's owning department (topic -> subject -> department). */
export async function departmentForTopic(topicId: number): Promise<number | null> {
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    select: { subject: { select: { departmentId: true } } },
  });
  return topic?.subject.departmentId ?? null;
}
