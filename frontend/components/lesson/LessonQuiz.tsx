"use client";

import { useMutation } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { IconCheck } from "@/components/Icons";
import { Badge, Button, Card, cls } from "@/components/ui";
import { api } from "@/lib/api";

type QuizView = {
  content_id: number;
  quiz_id: number;
  question_count: number;
  pass_threshold: number;
  max_attempts: number;
  attempts_used: number;
  best_score: number;
  passed: boolean;
};
type Bilingual = { uz: string; ru: string };
type Question = { id: number; question_uz: string; question_ru: string; options_json: Bilingual[] };
type StartOut = { attempt_id: number; attempt_no: number; max_attempts: number; questions: Question[] };
type ReviewItem = {
  question_id: number; chosen: number | null; correct_index: number;
  is_correct: boolean; explanations_json: Bilingual[];
};
type Result = {
  score_pct: number; passed: boolean; attempt_no: number;
  attempts_left: number; show_review: boolean; review: ReviewItem[];
};

export default function LessonQuiz({ quiz, onDone }: { quiz: QuizView; onDone: () => void }) {
  const t = useTranslations("learn");
  const locale = useLocale();
  const [attempt, setAttempt] = useState<StartOut | null>(null);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<Result | null>(null);

  const start = useMutation({
    mutationFn: () => api<StartOut>(`/me/learn/quizzes/${quiz.content_id}/start`, { method: "POST" }),
    onSuccess: (data) => {
      setAttempt(data);
      setCurrent(0);
      setAnswers({});
      setResult(null);
    },
  });

  const submit = useMutation({
    mutationFn: () =>
      api<Result>(`/me/learn/attempts/${attempt!.attempt_id}/submit`, {
        method: "POST",
        body: { answers: answers },
      }),
    onSuccess: (data) => {
      setResult(data);
      setAttempt(null);
      onDone();
    },
  });

  // Экран результата
  if (result) {
    return (
      <div className="space-y-4">
        <Card className={cls("p-6 text-center ring-1",
          result.passed ? "ring-emerald-200" : "ring-rose-200")}>
          <div className={cls("mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full text-2xl",
            result.passed ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600")}>
            {result.passed ? <IconCheck /> : "✕"}
          </div>
          <p className="text-3xl font-bold text-slate-900">{result.score_pct}%</p>
          <p className={cls("mt-1 font-medium", result.passed ? "text-emerald-600" : "text-rose-600")}>
            {result.passed ? t("passed") : t("failed")}
          </p>
          {!result.passed && result.attempts_left > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-sm text-slate-500">{t("attemptsLeft", { n: result.attempts_left })}</p>
              <Button onClick={() => { setResult(null); start.mutate(); }}>{t("retry")}</Button>
            </div>
          )}
          {!result.show_review && !result.passed && result.attempts_left > 0 && (
            <p className="mt-3 text-xs text-slate-400">{t("reviewLater")}</p>
          )}
        </Card>

        {result.show_review && (
          <div className="space-y-3">
            {result.review.map((r, i) => (
              <Card key={r.question_id} className={cls("p-4 ring-1",
                r.is_correct ? "ring-emerald-100" : "ring-rose-100")}>
                <p className="mb-2 text-sm font-medium text-slate-700">
                  {i + 1}. {r.is_correct ? <Badge tone="green">{t("correct")}</Badge> : <Badge tone="red">✕</Badge>}
                </p>
                {r.explanations_json[r.correct_index] && (
                  <p className="text-sm text-emerald-700">
                    {t("correctAnswer")}: {locale === "ru"
                      ? r.explanations_json[r.correct_index].ru
                      : r.explanations_json[r.correct_index].uz}
                  </p>
                )}
                {!r.is_correct && r.chosen !== null && r.explanations_json[r.chosen] && (
                  <p className="mt-1 text-sm text-rose-600">
                    {t("yourAnswer")}: {locale === "ru"
                      ? r.explanations_json[r.chosen].ru
                      : r.explanations_json[r.chosen].uz}
                  </p>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Экран прохождения
  if (attempt) {
    const q = attempt.questions[current];
    const chosen = answers[q.id];
    const isLast = current === attempt.questions.length - 1;
    const allAnswered = attempt.questions.every((qq) => answers[qq.id] !== undefined);
    return (
      <Card className="p-5">
        <p className="mb-1 text-xs font-medium text-slate-400">
          {t("question", { n: current + 1, total: attempt.questions.length })}
        </p>
        <p className="mb-4 text-lg font-medium text-slate-900">
          {locale === "ru" ? q.question_ru : q.question_uz}
        </p>
        <div className="space-y-2">
          {q.options_json.map((opt, oi) => (
            <button key={oi} onClick={() => setAnswers({ ...answers, [q.id]: oi })}
              className={cls("flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors",
                chosen === oi ? "border-teal-500 bg-teal-50 text-teal-900" : "border-slate-200 hover:border-slate-300")}>
              <span className={cls("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                chosen === oi ? "border-teal-500 bg-teal-500 text-white" : "border-slate-300 text-slate-400")}>
                {String.fromCharCode(65 + oi)}
              </span>
              {locale === "ru" ? opt.ru : opt.uz}
            </button>
          ))}
        </div>
        <div className="mt-5 flex items-center justify-between">
          <Button variant="ghost" disabled={current === 0} onClick={() => setCurrent(current - 1)}>
            {t("prev")}
          </Button>
          {isLast ? (
            <Button disabled={!allAnswered || submit.isPending} onClick={() => submit.mutate()}>
              {t("finish")}
            </Button>
          ) : (
            <Button disabled={chosen === undefined} onClick={() => setCurrent(current + 1)}>
              {t("next")}
            </Button>
          )}
        </div>
      </Card>
    );
  }

  // Стартовый экран
  const noAttempts = quiz.attempts_used >= quiz.max_attempts;
  return (
    <Card className="p-6 text-center">
      <p className="mb-1 text-lg font-semibold text-slate-800">{t("quiz")}</p>
      <p className="mb-4 text-sm text-slate-500">
        {quiz.question_count} · {t("attemptsLeft", { n: quiz.max_attempts - quiz.attempts_used })}
      </p>
      {quiz.attempts_used > 0 && (
        <div className="mb-4 inline-flex items-center gap-2">
          <Badge tone={quiz.passed ? "green" : "slate"}>
            {quiz.passed ? t("passed") : `${Math.round(quiz.best_score)}%`}
          </Badge>
        </div>
      )}
      {!noAttempts && (
        <div>
          <Button onClick={() => start.mutate()} disabled={start.isPending}>
            {quiz.attempts_used > 0 ? t("retry") : t("startQuiz")}
          </Button>
        </div>
      )}
    </Card>
  );
}
