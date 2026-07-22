import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, Check, ClipboardList, Clock, Flag, TriangleAlert, X } from "lucide-react";
import { Icon, Spinner, cls, useToast } from "@meduni/ui";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import {
  useAttempt,
  useFinishAttempt,
  useFlagQuestion,
  useSaveAnswers,
  useStartAttempt,
  type QuizAttemptView,
  type QuizTabData,
} from "../api";

/** mm:ss */
function mmss(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Server bergan expiresAt'dan qolgan vaqt. Server baribir avtomatik yakunlaydi —
 *  bu faqat ko'rsatkich va o'z vaqtida finish chaqirish uchun. */
function useCountdown(expiresAt: string | null, onExpire: () => void) {
  const [left, setLeft] = useState(() => (expiresAt ? new Date(expiresAt).getTime() - Date.now() : 0));
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const ms = new Date(expiresAt).getTime() - Date.now();
      setLeft(ms);
      if (ms <= 0) onExpire();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return left;
}

function Intro({ data, onStart, starting }: { data: QuizTabData; onStart: () => void; starting: boolean }) {
  const { t } = useTranslation(undefined, { keyPrefix: "lesson" });
  return (
    <div className="mx-auto max-w-[480px] py-6 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-card bg-blue-soft text-blue">
        <Icon icon={ClipboardList} size={22} />
      </div>
      <h2 className="text-section font-extrabold tracking-tight text-ink">{t("stage_quiz")}</h2>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
        <span className="rounded-control bg-surface-raised px-2.5 py-1 text-note font-bold text-ink-soft">
          {t("questionsN", { n: data.questionCount })}
        </span>
        <span className="rounded-control bg-surface-raised px-2.5 py-1 text-note font-bold text-ink-soft">
          {t("passIsN", { n: data.passThreshold })}
        </span>
        {data.timeLimitMin > 0 && (
          <span className="inline-flex items-center gap-1 rounded-control bg-amber-soft px-2.5 py-1 text-note font-bold text-amber">
            <Icon icon={Clock} size={12} />
            {t("timeLimitN", { n: data.timeLimitMin })}
          </span>
        )}
      </div>

      <div className="mt-4 flex gap-2.5 rounded-control border-l-2 border-amber bg-amber-soft px-3.5 py-3 text-left">
        <Icon icon={TriangleAlert} size={15} className="mt-0.5 shrink-0 text-amber" />
        <p className="text-note leading-relaxed text-ink-strong">{t("quizWarning")}</p>
      </div>

      <button
        onClick={onStart}
        disabled={starting}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-control bg-brand px-4 py-2.5 text-body font-extrabold text-white transition-colors hover:bg-brand-deep disabled:opacity-50"
      >
        {starting ? (
          <>
            <Spinner size={16} className="text-white" /> {t("starting")}
          </>
        ) : (
          <>
            {t("startQuiz")}
            <Icon icon={ArrowRight} size={15} />
          </>
        )}
      </button>
    </div>
  );
}

function Running({ attempt, topicId }: { attempt: QuizAttemptView; topicId: number }) {
  const { t } = useTranslation(undefined, { keyPrefix: "lesson" });
  const { show } = useToast();
  const qc = useQueryClient();
  const save = useSaveAnswers();
  const finish = useFinishAttempt(topicId);
  const flag = useFlagQuestion(attempt.id);
  const [qi, setQi] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>(attempt.answers);
  const [confirm, setConfirm] = useState(false);
  const [expired, setExpired] = useState(false);

  const q = attempt.questions[qi];
  const total = attempt.questions.length;
  const answeredCount = Object.keys(answers).length;
  const unanswered = total - answeredCount;
  const flagged = new Set(attempt.flagged ?? []);

  const doFinish = () =>
    finish.mutate(attempt.id, {
      onSuccess: () => {
        setConfirm(false);
        qc.invalidateQueries({ queryKey: ["me-attempt", attempt.id] });
      },
    });

  // Vaqt tugaganda — bir marta avtomatik yakunlash.
  const left = useCountdown(attempt.expiresAt, () => {
    if (!expired) {
      setExpired(true);
      doFinish();
    }
  });
  const lowTime = attempt.expiresAt !== null && left <= 60_000;

  const pick = (idx: number) => {
    setAnswers((a) => ({ ...a, [q.id]: idx }));
    save.mutate({ attemptId: attempt.id, answers: { [q.id]: idx } }, { onSuccess: () => show(t("saved")) });
  };

  return (
    <div className="space-y-3">
      {/* Yuqori bar: savol raqami · timer · belgilash */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-micro font-extrabold uppercase tracking-wider text-ink-dim">
          {t("question")} {qi + 1}/{total}
        </span>
        <span className="text-micro font-bold tabular-nums text-ink-dim">
          · {answeredCount}/{total}
        </span>

        {attempt.expiresAt && (
          <span
            className={cls(
              "inline-flex items-center gap-1 rounded-control px-2 py-0.5 text-note font-extrabold tabular-nums",
              lowTime ? "bg-rose-soft text-rose" : "bg-surface-raised text-ink-soft"
            )}
          >
            <Icon icon={Clock} size={12} />
            {mmss(left)}
          </span>
        )}

        <button
          onClick={() => flag.mutate({ questionId: q.id, flagged: !flagged.has(q.id) })}
          className={cls(
            "ml-auto inline-flex items-center gap-1.5 rounded-control border px-2.5 py-1 text-note font-bold transition-colors",
            flagged.has(q.id)
              ? "border-amber bg-amber-soft text-amber"
              : "border-line text-ink-soft hover:bg-surface-raised hover:text-ink"
          )}
        >
          <Icon icon={Flag} size={12} />
          {t("flagQuestion")}
        </button>
      </div>

      {/* Savol navigatori */}
      <div className="flex flex-wrap gap-1">
        {attempt.questions.map((qq, i) => {
          const done = answers[qq.id] !== undefined;
          const isFlagged = flagged.has(qq.id);
          return (
            <button
              key={qq.id}
              onClick={() => setQi(i)}
              className={cls(
                "flex h-6 w-6 items-center justify-center rounded-control text-micro font-extrabold tabular-nums transition-colors",
                i === qi
                  ? "bg-brand text-white"
                  : isFlagged
                    ? "bg-amber-soft text-amber"
                    : done
                      ? "bg-emerald-soft text-emerald"
                      : "bg-surface-raised text-ink-dim hover:text-ink"
              )}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      {/* Savol */}
      <div className="rounded-card border border-line bg-surface-raised p-4">
        <p className="text-body font-bold leading-relaxed text-ink">{q.text}</p>
        <div className="mt-3 space-y-1.5">
          {q.options.map((opt, oi) => {
            const selected = answers[q.id] === oi;
            return (
              <button
                key={oi}
                onClick={() => pick(oi)}
                className={cls(
                  "flex w-full items-center gap-2.5 rounded-control border px-3 py-2.5 text-left transition-colors",
                  selected
                    ? "border-brand bg-brand-soft text-ink"
                    : "border-line text-ink-soft hover:bg-surface hover:text-ink"
                )}
              >
                <span
                  className={cls(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-control text-micro font-extrabold",
                    selected ? "bg-brand text-white" : "bg-surface text-ink-dim"
                  )}
                >
                  {String.fromCharCode(65 + oi)}
                </span>
                <span className="min-w-0 flex-1 text-note">{opt}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Navigatsiya */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setQi((p) => Math.max(p - 1, 0))}
          disabled={qi === 0}
          className="inline-flex items-center gap-1.5 rounded-control border border-line px-3 py-1.5 text-note font-bold text-ink-soft transition-colors hover:bg-surface-raised hover:text-ink disabled:opacity-30"
        >
          <Icon icon={ArrowLeft} size={14} /> {t("prev")}
        </button>
        <div className="ml-auto">
          {qi < total - 1 ? (
            <button
              onClick={() => setQi((p) => Math.min(p + 1, total - 1))}
              className="inline-flex items-center gap-1.5 rounded-control bg-brand px-3.5 py-1.5 text-note font-bold text-white transition-colors hover:bg-brand-deep"
            >
              {t("next")} <Icon icon={ArrowRight} size={14} />
            </button>
          ) : (
            <button
              onClick={() => setConfirm(true)}
              className="inline-flex items-center gap-1.5 rounded-control bg-emerald px-3.5 py-1.5 text-note font-extrabold text-white transition-opacity hover:opacity-90"
            >
              <Icon icon={Check} size={14} strokeWidth={3} />
              {t("finishQuiz")}
            </button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirm}
        title={t("finishTitle")}
        message={unanswered > 0 ? t("finishWithUnanswered", { count: unanswered }) : t("finishConfirm")}
        confirmLabel={t("finishQuiz")}
        confirmVariant="primary"
        loading={finish.isPending}
        onConfirm={doFinish}
        onClose={() => setConfirm(false)}
      />
    </div>
  );
}

function Result({ attempt }: { attempt: QuizAttemptView }) {
  const { t } = useTranslation(undefined, { keyPrefix: "lesson" });
  const passed = attempt.passed;

  return (
    <div className="space-y-4">
      {/* Ball */}
      <div className="rounded-card border border-line bg-surface-raised p-5 text-center">
        <div
          className={cls(
            "mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-card",
            passed ? "bg-emerald-soft text-emerald" : "bg-rose-soft text-rose"
          )}
        >
          <Icon icon={passed ? Check : X} size={22} strokeWidth={3} />
        </div>
        <p className={cls("text-stat font-extrabold tabular-nums", passed ? "text-emerald" : "text-rose")}>
          {attempt.scorePct}%
        </p>
        <p className={cls("text-body font-extrabold", passed ? "text-emerald" : "text-rose")}>
          {passed ? t("passedMsg") : t("failedMsg")}
        </p>
        <p className="mt-1 text-note text-ink-dim">
          <span className="font-bold tabular-nums text-ink">{attempt.correctCount}</span> / {attempt.total}{" "}
          {t("correctAnswers")}
        </p>
      </div>

      {!passed && (
        <div className="flex gap-2.5 rounded-control border-l-2 border-amber bg-amber-soft px-3.5 py-2.5">
          <Icon icon={TriangleAlert} size={15} className="mt-0.5 shrink-0 text-amber" />
          <p className="text-note text-ink-strong">{t("cannotRetake")}</p>
        </div>
      )}

      {/* Javoblar tahlili */}
      <div>
        <h3 className="mb-2 text-micro font-extrabold uppercase tracking-wider text-ink-dim">{t("analysis")}</h3>
        <div className="space-y-2.5">
          {attempt.questions.map((q, i) => {
            const studentIdx = q.studentAnswer;
            const wrong = studentIdx !== q.correctIndex;
            return (
              <div key={q.id} className="rounded-card border border-line bg-surface-raised p-3.5">
                <p className="text-note font-bold leading-snug text-ink">
                  <span className="mr-1.5 tabular-nums text-ink-dim">{i + 1}.</span>
                  {q.text}
                </p>
                <div className="mt-2 space-y-1">
                  {q.options.map((opt, oi) => {
                    const isCorrect = oi === q.correctIndex;
                    const isStudentWrong = oi === studentIdx && wrong;
                    return (
                      <div
                        key={oi}
                        className={cls(
                          "flex items-center gap-2 rounded-control px-2.5 py-1.5 text-note",
                          isCorrect && "bg-emerald-soft font-bold text-ink",
                          isStudentWrong && "bg-rose-soft font-bold text-ink",
                          !isCorrect && !isStudentWrong && "text-ink-dim"
                        )}
                      >
                        {isCorrect ? (
                          <Icon icon={Check} size={13} className="shrink-0 text-emerald" strokeWidth={3} />
                        ) : isStudentWrong ? (
                          <Icon icon={X} size={13} className="shrink-0 text-rose" strokeWidth={3} />
                        ) : (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-line" />
                        )}
                        <span className="min-w-0 flex-1">{opt}</span>
                        {studentIdx === oi && (
                          <span className="shrink-0 text-micro font-bold text-ink-dim">{t("yourAnswer")}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {q.explanations?.[q.correctIndex ?? 0] && (
                  <p className="mt-2 rounded-control border-l-2 border-blue bg-blue-soft px-3 py-2 text-note leading-relaxed text-ink-strong">
                    {q.explanations[q.correctIndex ?? 0]}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function QuizTab({ topicId, data }: { topicId: number; data: QuizTabData }) {
  const start = useStartAttempt();
  const [startedId, setStartedId] = useState<number | null>(null);

  // Which attempt is active: a freshly started one, else in-progress, else a finished one.
  const finishedId = data.attempt?.status === "finished" ? data.attempt.id : null;
  const attemptId = startedId ?? data.inProgressId ?? finishedId;
  const attemptQ = useAttempt(attemptId);

  const onStart = () => start.mutate(data.quizId, { onSuccess: (a) => setStartedId(a.id) });

  if (attemptId === null) return <Intro data={data} onStart={onStart} starting={start.isPending} />;
  if (attemptQ.isLoading)
    return (
      <div className="flex justify-center py-10">
        <Spinner size={24} />
      </div>
    );
  if (!attemptQ.data) return <Intro data={data} onStart={onStart} starting={start.isPending} />;

  return attemptQ.data.status === "finished" ? (
    <Result attempt={attemptQ.data} />
  ) : (
    <Running attempt={attemptQ.data} topicId={topicId} />
  );
}
