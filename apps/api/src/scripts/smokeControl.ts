// ЖЁСТКИЙ КОНТРОЛЬ — логический смоук (без сети и Gemini).
// Проверяет: коридор политики, запрет ослабления, авто-зачёт пустой темы,
// цикл пересдачи (попытки / пауза / разбор ошибок).
//   npx tsx src/scripts/smokeControl.ts
import { evaluateRule, type Facts, type UnlockRule, DEFAULT_RULE } from "../modules/me/rules";
import { clampQuiz, clampRule, assertRuleWithinPolicy, assertSequentialAllowed, FALLBACK_POLICY, type ResolvedPolicy } from "../modules/policy/service";

let ok = 0;
let fail = 0;
const check = (n: string, c: boolean, got?: unknown) => {
  if (c) {
    ok++;
    console.log("  ✓ " + n);
  } else {
    fail++;
    console.log(`  ✗ ${n}${got !== undefined ? ` — got: ${JSON.stringify(got)}` : ""}`);
  }
};
const threw = (fn: () => void): string | null => {
  try {
    fn();
    return null;
  } catch (e) {
    return (e as { code?: string }).code ?? "error";
  }
};

const strict: ResolvedPolicy = { ...FALLBACK_POLICY, minQuizPassedPct: 75, minVideoWatchedPct: 90, requireCase: true };
const facts = (over: Partial<Facts> = {}): Facts => ({
  hasVideo: false,
  hasSlides: false,
  hasQuiz: false,
  hasCase: false,
  videoWatchedPct: 0,
  quizScore: null,
  caseSubmitted: false,
  caseReviewed: false,
  ...over,
});

console.log("\n— Коридор: правило курса зажимается минимумами —");
const weak: Partial<UnlockRule> = { quizPassedPct: 30, videoWatchedPct: 10, caseRequired: false, logic: "OR" };
const clamped = clampRule(weak, strict);
check("проходной балл поднят до минимума", clamped.quizPassedPct === 75, clamped.quizPassedPct);
check("порог видео поднят до минимума", clamped.videoWatchedPct === 90, clamped.videoWatchedPct);
check("кейс снова обязателен", clamped.caseRequired === true);
check("режим «достаточно одного условия» отключён", clamped.logic === "AND");
const strong = clampRule({ quizPassedPct: 95 }, strict);
check("ужесточение преподавателем сохраняется", strong.quizPassedPct === 95, strong.quizPassedPct);
check("правило по умолчанию не ломается", clampRule(null, FALLBACK_POLICY).quizPassedPct === DEFAULT_RULE.quizPassedPct);

console.log("\n— Коридор: попытка ослабить отклоняется, а не клампится молча —");
check("ниже проходного балла → policy_violation", threw(() => assertRuleWithinPolicy({ quizPassedPct: 50 }, strict)) === "policy_violation");
check("отключить кейс → policy_violation", threw(() => assertRuleWithinPolicy({ caseRequired: false }, strict)) === "policy_violation");
check("логика OR → policy_violation", threw(() => assertRuleWithinPolicy({ logic: "OR" }, strict)) === "policy_violation");
check("выключить последовательность → policy_violation", threw(() => assertSequentialAllowed(false, strict)) === "policy_violation");
check("ужесточение проходит", threw(() => assertRuleWithinPolicy({ quizPassedPct: 90 }, strict)) === null);
check("включить последовательность проходит", threw(() => assertSequentialAllowed(true, strict)) === null);

console.log("\n— Тема без оценивания больше не засчитывается —");
const bare = evaluateRule(facts({ hasSlides: true, requireAssessment: true }), DEFAULT_RULE);
check("тема со слайдами НЕ завершена", bare.completed === false);
check("прогресс не рисуется как 100%", bare.pct === 0, bare.pct);
check("причина названа", /baholash|оценивани/i.test(bare.unmet[0]?.ru ?? ""), bare.unmet[0]);
const bareOld = evaluateRule(facts({ hasSlides: true, requireAssessment: false }), DEFAULT_RULE);
check("без требования политики поведение прежнее", bareOld.completed === true);
const withQuiz = evaluateRule(facts({ hasQuiz: true, quizScore: 80, requireAssessment: true }), DEFAULT_RULE);
check("тема с тестом считается как раньше", withQuiz.completed === true);

console.log("\n— Настройки теста зажимаются коридором —");
const eff = clampQuiz({ passThreshold: 50, maxAttempts: 1, attemptGapHours: 0, timeLimitMin: 0 }, FALLBACK_POLICY, 20);
check("попыток стало 3 (было 1)", eff.maxAttempts === 3, eff.maxAttempts);
check("пауза 24 часа", eff.attemptGapHours === 24, eff.attemptGapHours);
check("проходной балл поднят до 70", eff.passThreshold === 70, eff.passThreshold);
check("таймер включён: 1 мин × 20 вопросов", eff.timeLimitMin === 20, eff.timeLimitMin);
const capped = clampQuiz({ passThreshold: 70, maxAttempts: 99, attemptGapHours: 0, timeLimitMin: 0 }, FALLBACK_POLICY, 10);
check("бесконечные попытки обрезаны верхней границей", capped.maxAttempts === 5, capped.maxAttempts);

console.log("\n— Исчерпанные попытки: честная причина, а не невыполнимое указание —");
const stuck = evaluateRule(
  facts({ hasQuiz: true, quizScore: 20, quizExhausted: true, requireAssessment: true }),
  { ...DEFAULT_RULE, quizPassedPct: 70 }
);
check("тема не завершена", stuck.completed === false);
check("сказано, что попытки исчерпаны", /исчерпан/i.test(stuck.unmet[0]?.ru ?? ""), stuck.unmet[0]?.ru);
check("помечено как «сам не решит»", stuck.unmet[0]?.blocked === true);
const retryable = evaluateRule(
  facts({ hasQuiz: true, quizScore: 20, quizExhausted: false, requireAssessment: true }),
  { ...DEFAULT_RULE, quizPassedPct: 70 }
);
check("пока попытки есть — обычное указание", retryable.unmet[0]?.blocked !== true);

console.log(`\n${fail === 0 ? "✅" : "❌"} ${ok}/${ok + fail}`);
process.exit(fail === 0 ? 0 : 1);
