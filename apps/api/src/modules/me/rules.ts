// Sequential topic-unlock engine. Pure functions — no DB.

export interface UnlockRule {
  videoWatchedPct: number;
  quizPassedPct: number;
  quizMaxAttempts: number;
  caseRequired: boolean;
  caseReviewedRequired: boolean;
  notBeforeDate: string | null;
  logic: "AND" | "OR";
}

export const DEFAULT_RULE: UnlockRule = {
  videoWatchedPct: 80,
  quizPassedPct: 70,
  quizMaxAttempts: 1,
  caseRequired: true,
  caseReviewedRequired: false,
  notBeforeDate: null,
  logic: "AND",
};

export interface Facts {
  hasVideo: boolean;
  hasSlides: boolean;
  hasQuiz: boolean;
  hasCase: boolean;
  videoWatchedPct: number;
  quizScore: number | null;
  caseSubmitted: boolean;
  caseReviewed: boolean;
}

export interface Reason {
  uz: string;
  ru: string;
}

interface Condition {
  met: boolean;
  ratio: number; // 0..1 — partial progress toward this requirement (drives the % bar)
  reason: Reason;
}

function dmy(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

/** Evaluates a topic's completion for one student. */
export function evaluateRule(
  facts: Facts,
  rule: UnlockRule
): { completed: boolean; pct: number; dateOk: boolean; unmet: Reason[] } {
  const conditions: Condition[] = [];

  if (facts.hasVideo) {
    const met = facts.videoWatchedPct >= rule.videoWatchedPct;
    conditions.push({
      met,
      ratio: rule.videoWatchedPct > 0 ? Math.min(facts.videoWatchedPct / rule.videoWatchedPct, 1) : met ? 1 : 0,
      reason: {
        uz: `Videoni ${rule.videoWatchedPct}% koʻring`,
        ru: `Посмотрите видео на ${rule.videoWatchedPct}%`,
      },
    });
  }
  if (facts.hasQuiz) {
    const met = facts.quizScore !== null && facts.quizScore >= rule.quizPassedPct;
    conditions.push({
      met,
      ratio: facts.quizScore === null ? 0 : Math.min(facts.quizScore / rule.quizPassedPct, 1),
      reason: {
        uz: `Testni ${rule.quizPassedPct}% ga topshiring`,
        ru: `Сдайте тест на ${rule.quizPassedPct}%`,
      },
    });
  }
  if (facts.hasCase && rule.caseRequired) {
    const met = facts.caseSubmitted && (!rule.caseReviewedRequired || facts.caseReviewed);
    conditions.push({
      met,
      ratio: met ? 1 : facts.caseSubmitted ? 0.5 : 0,
      reason: !facts.caseSubmitted
        ? { uz: "Keysni topshiring", ru: "Сдайте кейс" }
        : { uz: "Keys tekshirilishini kuting", ru: "Дождитесь проверки кейса" },
    });
  }

  const dateOk = !rule.notBeforeDate || new Date().toISOString().slice(0, 10) >= rule.notBeforeDate;

  const metCount = conditions.filter((c) => c.met).length;
  const total = conditions.length;
  const contentComplete =
    total === 0 ? true : rule.logic === "OR" ? metCount > 0 : metCount === total;
  const completed = contentComplete && dateOk;
  // Progress bar reflects partial advancement (e.g. video 50/80 counts), not just met/unmet.
  const pct =
    total === 0
      ? completed
        ? 100
        : 0
      : Math.round((conditions.reduce((s, c) => s + c.ratio, 0) / total) * 100);
  const unmet = conditions.filter((c) => !c.met).map((c) => c.reason);

  return { completed, pct, dateOk, unmet };
}

/** Reason shown on a LOCKED topic: its own future date, else the previous topic's first unmet requirement. */
export function lockedReason(rule: UnlockRule, prevUnmet: Reason[]): Reason {
  if (rule.notBeforeDate && new Date().toISOString().slice(0, 10) < rule.notBeforeDate) {
    return { uz: `${dmy(rule.notBeforeDate)} da ochiladi`, ru: `Откроется ${dmy(rule.notBeforeDate)}` };
  }
  if (prevUnmet.length > 0) {
    return {
      uz: `Oldingi mavzu: ${prevUnmet[0].uz.toLowerCase()}`,
      ru: `Предыдущая тема: ${prevUnmet[0].ru.toLowerCase()}`,
    };
  }
  return { uz: "Oldingi mavzuni tugating", ru: "Завершите предыдущую тему" };
}
