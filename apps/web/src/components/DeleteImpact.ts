import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";

/**
 * O'chirishdan OLDIN — nima birga o'chadi (2026-10-31).
 * Mavzu/kurs endi talabalar natijasi bo'lsa ham o'chadi (buyurtmachi), shuning
 * uchun himoya taqiq emas, ANIQ ogohlantirish: "3 ta talabaning 5 ta test urinishi".
 */
export interface DeleteImpact {
  students: number;
  quizAttempts: number;
  caseAttempts: number;
  completed: number;
  attendance: number;
}

/** `path` null bo'lsa so'ramaydi (dialog yopiq). */
export function useDeleteImpact(path: string | null) {
  return useQuery({
    queryKey: ["delete-impact", path],
    queryFn: () => api<DeleteImpact>(path!),
    enabled: path !== null,
    staleTime: 0,
  });
}

/** Ogohlantirish matni yoki null (o'chadigan natija yo'q). */
export function useImpactWarning(impact: DeleteImpact | undefined): string | null {
  const { t } = useTranslation(undefined, { keyPrefix: "deleteImpact" });
  if (!impact) return null;
  const parts = [
    impact.quizAttempts ? t("quizAttempts", { n: impact.quizAttempts }) : null,
    impact.caseAttempts ? t("caseAttempts", { n: impact.caseAttempts }) : null,
    impact.completed ? t("completed", { n: impact.completed }) : null,
    impact.attendance ? t("attendance", { n: impact.attendance }) : null,
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return impact.students > 0
    ? t("warning", { students: impact.students, parts: parts.join(", ") })
    : t("warningNoStudents", { parts: parts.join(", ") });
}
