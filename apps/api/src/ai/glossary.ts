import { prisma } from "../lib/prisma";

export interface GlossaryTerm {
  termRu: string;
  termUz: string;
  termLat: string | null;
}

/** The department's approved terminology — the university's curated Uzbek medical
 *  vocabulary. Injected into every AI prompt so all generated content agrees. */
export async function getGlossaryForDepartment(departmentId: number | null | undefined): Promise<GlossaryTerm[]> {
  if (!departmentId) return [];
  const rows = await prisma.glossary.findMany({
    where: { departmentId, approved: true },
    select: { termRu: true, termUz: true, termLat: true },
    orderBy: { termRu: "asc" },
  });
  return rows;
}

/** Formats the glossary as a mandatory-terms block appended to a system prompt. */
export function glossaryBlock(terms: GlossaryTerm[]): string {
  if (terms.length === 0) return "";
  const lines = terms.map((t) => `${t.termRu} = ${t.termUz}${t.termLat ? ` (${t.termLat})` : ""}`);
  return (
    "\n\nQuyidagi atamalar lugʻatidan foydalaning (MAJBURIY — aynan shu oʻzbekcha " +
    "atamalarni ishlating):\n" +
    lines.join("\n")
  );
}

/** Resolve a topic's owning department (topic -> course -> subject -> department). */
export async function departmentForTopic(topicId: number): Promise<number | null> {
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    select: { course: { select: { subject: { select: { departmentId: true } } } } },
  });
  return topic?.course.subject.departmentId ?? null;
}
