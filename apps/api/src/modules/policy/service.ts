// КОРИДОР ПОЛИТИКИ (2026-08-11, требование руководства: «жёсткий контроль»).
//
// Проблема, которую он решает: до этого ВСЕ замки принадлежали тому, кого они
// должны ограничивать. Преподаватель мог поставить проходной балл 0, выключить
// последовательное открытие тем одним тумблером и убрать требование кейса —
// без чьего-либо согласия и БЕЗ ЕДИНОЙ ЗАПИСИ В ЖУРНАЛЕ.
//
// Теперь минимум задаёт институт. Три уровня, и каждый следующий может только
// УЖЕСТОЧИТЬ: пороги берутся по максимуму, обязательные требования — по ИЛИ,
// число попыток — по пересечению диапазонов.
//
//   UNIVERSITY (scopeId = null)  →  FACULTY (facultyId)  →  DEPARTMENT (departmentId)
//
// Преподаватель работает ВНУТРИ коридора: сервер отклоняет попытку выйти за
// него (assertRuleWithinPolicy / clampQuizSettings), а не молча принимает.
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../lib/errors";
import { DEFAULT_RULE, type UnlockRule } from "../me/rules";

export type MakeupScope = "NONE" | "PRACTICE" | "ALL";
export type ExcuseApprover = "TEACHER" | "DEANERY" | "BOTH";
/** Строгость: кто МОЖЕТ поставить «уважительную». Только деканат — строже всего. */
const APPROVER_RANK: Record<ExcuseApprover, number> = { TEACHER: 0, BOTH: 1, DEANERY: 2 };
const MAKEUP_RANK: Record<MakeupScope, number> = { NONE: 0, PRACTICE: 1, ALL: 2 };

export interface ResolvedPolicy {
  minQuizPassedPct: number;
  minVideoWatchedPct: number;
  requireAssessment: boolean;
  requireSequential: boolean;
  requireCase: boolean;
  requireCaseReviewed: boolean;
  minQuizAttempts: number;
  maxQuizAttempts: number;
  minAttemptGapHours: number;
  requireRemediation: boolean;
  minMinutesPerQuestion: number;
  allowManualUnlock: boolean;
  /** ОЧНЫЙ РЕЖИМ для всех тестов кафедры (отдельный тест включает сам). */
  requirePresence: boolean;
  // ---- Коридор ПОСЕЩАЕМОСТИ (F1). Считается в академических часах. ----
  maxUnexcusedPct: number;
  warnUnexcusedPct: number;
  maxMissedHoursPerTerm: number;
  makeupRequiredFor: MakeupScope;
  makeupDeadlineDays: number;
  makeupClearsAbsence: boolean;
  excuseDocDeadlineDays: number;
  excuseApprover: ExcuseApprover;
  lateThresholdMin: number;
  lateCountsAsAbsentAfterMin: number;
  cycleMaxMissedDays: number;
  /** Откуда пришло ужесточение — для экрана «кто что установил». */
  sources: { level: "UNIVERSITY" | "FACULTY" | "DEPARTMENT"; scopeId: number | null }[];
}

/** Университетский минимум, если в базе ещё ничего не задано. */
export const FALLBACK_POLICY: ResolvedPolicy = {
  minQuizPassedPct: 70,
  minVideoWatchedPct: 80,
  requireAssessment: true,
  requireSequential: true,
  requireCase: true,
  requireCaseReviewed: false,
  minQuizAttempts: 3,
  maxQuizAttempts: 5,
  minAttemptGapHours: 24,
  requireRemediation: true,
  minMinutesPerQuestion: 1,
  allowManualUnlock: true,
  requirePresence: false,
  // Нормативные значения РУз: №824 — 25 % часов предмета без причины,
  // №393 — 74 часа за семестр. 15 % — жёлтая зона (было «75 %» в коде).
  maxUnexcusedPct: 25,
  warnUnexcusedPct: 15,
  maxMissedHoursPerTerm: 74,
  makeupRequiredFor: "PRACTICE",
  makeupDeadlineDays: 14,
  makeupClearsAbsence: true,
  excuseDocDeadlineDays: 3,
  excuseApprover: "DEANERY",
  lateThresholdMin: 15,
  lateCountsAsAbsentAfterMin: 45,
  cycleMaxMissedDays: 2,
  sources: [],
};

type PolicyRow = {
  level: "UNIVERSITY" | "FACULTY" | "DEPARTMENT";
  scopeId: number | null;
  minQuizPassedPct: number;
  minVideoWatchedPct: number;
  requireAssessment: boolean;
  requireSequential: boolean;
  requireCase: boolean;
  requireCaseReviewed: boolean;
  minQuizAttempts: number;
  maxQuizAttempts: number;
  minAttemptGapHours: number;
  requireRemediation: boolean;
  minMinutesPerQuestion: number;
  allowManualUnlock: boolean;
  requirePresence: boolean;
  maxUnexcusedPct: number;
  warnUnexcusedPct: number;
  maxMissedHoursPerTerm: number;
  makeupRequiredFor: MakeupScope;
  makeupDeadlineDays: number;
  makeupClearsAbsence: boolean;
  excuseDocDeadlineDays: number;
  excuseApprover: ExcuseApprover;
  lateThresholdMin: number;
  lateCountsAsAbsentAfterMin: number;
  cycleMaxMissedDays: number;
};

/** Слияние: следующий уровень может только ужесточить. */
function tighten(base: ResolvedPolicy, row: PolicyRow): ResolvedPolicy {
  return {
    minQuizPassedPct: Math.max(base.minQuizPassedPct, row.minQuizPassedPct),
    minVideoWatchedPct: Math.max(base.minVideoWatchedPct, row.minVideoWatchedPct),
    requireAssessment: base.requireAssessment || row.requireAssessment,
    requireSequential: base.requireSequential || row.requireSequential,
    requireCase: base.requireCase || row.requireCase,
    requireCaseReviewed: base.requireCaseReviewed || row.requireCaseReviewed,
    // Больше попыток — мягче, поэтому нижняя граница растёт, верхняя падает.
    minQuizAttempts: Math.max(base.minQuizAttempts, row.minQuizAttempts),
    maxQuizAttempts: Math.min(base.maxQuizAttempts, row.maxQuizAttempts),
    minAttemptGapHours: Math.max(base.minAttemptGapHours, row.minAttemptGapHours),
    requireRemediation: base.requireRemediation || row.requireRemediation,
    minMinutesPerQuestion: Math.max(base.minMinutesPerQuestion, row.minMinutesPerQuestion),
    // Запретить ручной допуск — ужесточение, поэтому И.
    allowManualUnlock: base.allowManualUnlock && row.allowManualUnlock,
    // Требовать присутствие — ужесточение.
    requirePresence: base.requirePresence || row.requirePresence,
    // Посещаемость: МЕНЬШЕ допустимого пропуска = строже; порог предупреждения
    // тоже вниз; сроки справки/отработки — короче; дней цикла — меньше.
    maxUnexcusedPct: Math.min(base.maxUnexcusedPct, row.maxUnexcusedPct),
    warnUnexcusedPct: Math.min(base.warnUnexcusedPct, row.warnUnexcusedPct),
    maxMissedHoursPerTerm: Math.min(base.maxMissedHoursPerTerm, row.maxMissedHoursPerTerm),
    makeupRequiredFor: MAKEUP_RANK[row.makeupRequiredFor] > MAKEUP_RANK[base.makeupRequiredFor] ? row.makeupRequiredFor : base.makeupRequiredFor,
    makeupDeadlineDays: Math.min(base.makeupDeadlineDays, row.makeupDeadlineDays),
    // Otrabotka propuskni YOPMASLIGI — qattiqroq shart.
    makeupClearsAbsence: base.makeupClearsAbsence && row.makeupClearsAbsence,
    excuseDocDeadlineDays: Math.min(base.excuseDocDeadlineDays, row.excuseDocDeadlineDays),
    excuseApprover: APPROVER_RANK[row.excuseApprover] > APPROVER_RANK[base.excuseApprover] ? row.excuseApprover : base.excuseApprover,
    lateThresholdMin: Math.min(base.lateThresholdMin, row.lateThresholdMin),
    lateCountsAsAbsentAfterMin: Math.min(base.lateCountsAsAbsentAfterMin, row.lateCountsAsAbsentAfterMin),
    cycleMaxMissedDays: Math.min(base.cycleMaxMissedDays, row.cycleMaxMissedDays),
    sources: [...base.sources, { level: row.level, scopeId: row.scopeId }],
  };
}

/** Кэш на процесс: политика меняется редко, а читается на каждый расчёт темы. */
const cache = new Map<string, { at: number; value: ResolvedPolicy }>();
const TTL_MS = 60_000;

export function invalidatePolicyCache(): void {
  cache.clear();
}

/**
 * Действующая политика для кафедры. departmentId = null → только университет.
 * Порядок применения: университет → факультет → кафедра.
 */
export async function resolvePolicy(departmentId: number | null): Promise<ResolvedPolicy> {
  const key = String(departmentId ?? "u");
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const dept = departmentId
    ? await prisma.department.findUnique({ where: { id: departmentId }, select: { id: true, facultyId: true } })
    : null;

  const rows = (await prisma.learningPolicy.findMany({
    where: {
      OR: [
        { level: "UNIVERSITY" },
        ...(dept ? [{ level: "FACULTY" as const, scopeId: dept.facultyId }] : []),
        ...(dept ? [{ level: "DEPARTMENT" as const, scopeId: dept.id }] : []),
      ],
    },
  })) as unknown as PolicyRow[];

  const order = { UNIVERSITY: 0, FACULTY: 1, DEPARTMENT: 2 } as const;
  rows.sort((a, b) => order[a.level] - order[b.level]);

  let out: ResolvedPolicy = rows.length
    ? { ...FALLBACK_POLICY, minQuizAttempts: 1, maxQuizAttempts: 99, minQuizPassedPct: 0, minVideoWatchedPct: 0,
        requireAssessment: false, requireSequential: false, requireCase: false, requireCaseReviewed: false,
        minAttemptGapHours: 0, requireRemediation: false, minMinutesPerQuestion: 0, allowManualUnlock: true,
        requirePresence: false,
        // Мягкая отправная точка: строки уровней потом только ужесточают.
        maxUnexcusedPct: 100, warnUnexcusedPct: 100, maxMissedHoursPerTerm: 100000,
        makeupRequiredFor: "NONE", makeupDeadlineDays: 3650, makeupClearsAbsence: true, excuseDocDeadlineDays: 3650,
        excuseApprover: "TEACHER", lateThresholdMin: 1440, lateCountsAsAbsentAfterMin: 1440,
        cycleMaxMissedDays: 9999,
        sources: [] }
    : FALLBACK_POLICY;
  for (const r of rows) out = tighten(out, r);
  // Диапазон попыток мог схлопнуться при противоречивых настройках уровней.
  if (out.maxQuizAttempts < out.minQuizAttempts) out.maxQuizAttempts = out.minQuizAttempts;

  cache.set(key, { at: Date.now(), value: out });
  return out;
}

/**
 * Правило курса, ЗАЖАТОЕ коридором. Чистая функция — вызывается синхронно
 * внутри движка допуска (computeTopics), политика подтягивается заранее в
 * loadCourse (тот же приём, что и scheduleDates).
 */
export function clampRule(raw: Partial<UnlockRule> | null | undefined, policy: ResolvedPolicy): UnlockRule {
  const merged: UnlockRule = { ...DEFAULT_RULE, ...(raw ?? {}) };
  return {
    ...merged,
    quizPassedPct: Math.max(merged.quizPassedPct, policy.minQuizPassedPct),
    videoWatchedPct: Math.max(merged.videoWatchedPct, policy.minVideoWatchedPct),
    caseRequired: merged.caseRequired || policy.requireCase,
    caseReviewedRequired: merged.caseReviewedRequired || policy.requireCaseReviewed,
    // Коридор не допускает режим «достаточно одного условия».
    logic: policy.requireAssessment ? "AND" : merged.logic,
  };
}

/** Настройки теста, зажатые коридором (попытки, пауза, время, порог). */
export function clampQuiz(
  quiz: { passThreshold: number; maxAttempts: number; attemptGapHours: number; timeLimitMin: number },
  policy: ResolvedPolicy,
  questionCount: number
) {
  const minutes = policy.minMinutesPerQuestion > 0 ? policy.minMinutesPerQuestion * Math.max(1, questionCount) : 0;
  return {
    passThreshold: Math.max(quiz.passThreshold, policy.minQuizPassedPct),
    maxAttempts: Math.min(Math.max(quiz.maxAttempts, policy.minQuizAttempts), policy.maxQuizAttempts),
    attemptGapHours: Math.max(quiz.attemptGapHours, policy.minAttemptGapHours),
    // 0 в настройке теста означало «без ограничения» — коридор это закрывает.
    timeLimitMin: quiz.timeLimitMin > 0 ? Math.max(quiz.timeLimitMin, minutes) : minutes,
  };
}

/** Преподавательская правка правила курса: выход за коридор — отказ, не тихое клампирование. */
export function assertRuleWithinPolicy(raw: Partial<UnlockRule> | null | undefined, policy: ResolvedPolicy): void {
  if (!raw) return;
  if (typeof raw.quizPassedPct === "number" && raw.quizPassedPct < policy.minQuizPassedPct) {
    throw new ApiError(
      403,
      "policy_violation",
      `Oʻtish balli ${policy.minQuizPassedPct}% dan past boʻlishi mumkin emas (kafedra talabi)`,
      `Проходной балл не может быть ниже ${policy.minQuizPassedPct}% (требование кафедры)`
    );
  }
  if (typeof raw.videoWatchedPct === "number" && raw.videoWatchedPct < policy.minVideoWatchedPct) {
    throw new ApiError(
      403,
      "policy_violation",
      `Video koʻrish talabi ${policy.minVideoWatchedPct}% dan past boʻlishi mumkin emas`,
      `Требование к просмотру видео не может быть ниже ${policy.minVideoWatchedPct}%`
    );
  }
  if (raw.caseRequired === false && policy.requireCase) {
    throw new ApiError(403, "policy_violation", "Klinik keys majburiy (kafedra talabi)", "Клинический кейс обязателен (требование кафедры)");
  }
  if (raw.caseReviewedRequired === false && policy.requireCaseReviewed) {
    throw new ApiError(403, "policy_violation", "Keys tekshirilishi majburiy", "Проверка кейса преподавателем обязательна");
  }
  if (raw.logic === "OR" && policy.requireAssessment) {
    throw new ApiError(403, "policy_violation", "Barcha shartlar bajarilishi shart", "Должны выполняться все условия, а не одно из них");
  }
}

/** Последовательное открытие тем: коридор может запретить его выключать. */
export function assertSequentialAllowed(next: boolean | undefined, policy: ResolvedPolicy): void {
  if (next === false && policy.requireSequential) {
    throw new ApiError(
      403,
      "policy_violation",
      "Mavzular ketma-ketligini oʻchirib boʻlmaydi (kafedra talabi)",
      "Последовательное открытие тем отключать нельзя (требование кафедры)"
    );
  }
}
