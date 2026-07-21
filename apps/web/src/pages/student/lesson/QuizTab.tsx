import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, ClipboardList, X } from "lucide-react";
import { Card, Icon, Spinner, cls, useToast } from "@meduni/ui";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import {
  useAttempt,
  useFinishAttempt,
  useSaveAnswers,
  useStartAttempt,
  type QuizAttemptView,
  type QuizTabData,
} from "../api";

function Intro({ data, onStart, starting }: { data: QuizTabData; onStart: () => void; starting: boolean }) {
  const { t } = useTranslation(undefined, { keyPrefix: "lesson" });
  return (
    <div className="relative overflow-hidden rounded-[20px] border border-line/80 bg-gradient-to-b from-surface via-surface to-bg/50 p-6 sm:p-8 shadow-[0_10px_30px_rgba(0,0,0,0.06)] text-center">
      {/* Background ambient glow */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-brand/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-blue/10 blur-3xl" />

      <div className="relative z-10 flex flex-col items-center">
        <div className="relative mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand/20 via-blue/20 to-indigo-500/20 p-0.5 shadow-inner">
          <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-surface text-brand shadow-card">
            <Icon icon={ClipboardList} size={36} className="text-brand-deep" />
          </div>
        </div>

        <h2 className="text-[20px] font-extrabold tracking-tight text-ink sm:text-[22px]">
          {t("stage_quiz")}
        </h2>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-line bg-surface/80 px-4 py-2 text-[14px] font-bold text-ink shadow-sm backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-blue" />
            <span className="text-ink-soft">{t("questions")}:</span>
            <span className="text-[16px] font-extrabold text-brand-deep">{data.questionCount}</span>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-line bg-surface/80 px-4 py-2 text-[14px] font-bold text-ink shadow-sm backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-emerald" />
            <span className="text-ink-soft">{t("passIs")}</span>
            <span className="text-[16px] font-extrabold text-emerald">{data.passThreshold}%</span>
          </div>
        </div>

        <div className="mt-6 flex w-full max-w-lg items-start gap-3 rounded-xl border border-amber/30 bg-amber-soft/60 p-4 text-left backdrop-blur-sm">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber/20 text-amber-deep">
            <Icon icon={AlertTriangle} size={18} />
          </div>
          <p className="text-[13.5px] font-medium leading-relaxed text-ink-soft">
            {t("quizWarning")}
          </p>
        </div>

        <button
          onClick={onStart}
          disabled={starting}
          className="group relative mt-6 flex w-full max-w-md items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-brand via-brand-deep to-indigo-600 px-6 py-4 text-[16px] font-extrabold text-white shadow-[0_8px_25px_rgba(37,99,235,0.3)] transition-all hover:scale-[1.01] hover:shadow-[0_12px_35px_rgba(37,99,235,0.4)] active:scale-[0.99] disabled:opacity-60"
        >
          {starting ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner size={20} className="text-white" /> {t("starting")}
            </span>
          ) : (
            <>
              <span>{t("startQuiz")}</span>
              <Icon icon={ChevronRight} size={18} className="transition-transform group-hover:translate-x-1" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function Running({ attempt, topicId }: { attempt: QuizAttemptView; topicId: number }) {
  const { t } = useTranslation(undefined, { keyPrefix: "lesson" });
  const { show } = useToast();
  const qc = useQueryClient();
  const save = useSaveAnswers();
  const finish = useFinishAttempt(topicId);
  const [qi, setQi] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>(attempt.answers);
  const [confirm, setConfirm] = useState(false);

  const q = attempt.questions[qi];
  const total = attempt.questions.length;
  const answeredCount = Object.keys(answers).length;
  const unanswered = total - answeredCount;

  const pick = (idx: number) => {
    setAnswers((a) => ({ ...a, [q.id]: idx }));
    save.mutate({ attemptId: attempt.id, answers: { [q.id]: idx } }, { onSuccess: () => show(t("saved")) });
  };

  const doFinish = () =>
    finish.mutate(attempt.id, {
      onSuccess: () => {
        setConfirm(false);
        qc.invalidateQueries({ queryKey: ["me-attempt", attempt.id] });
      },
    });

  return (
    <div className="space-y-5">
      {/* Header & Progress Bar */}
      <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between text-[14px] font-bold text-ink">
          <span className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-soft text-[12px] font-black text-brand-deep">
              {qi + 1}
            </span>
            {t("question")} {qi + 1} / {total}
          </span>
          <span className="rounded-full bg-bg px-3 py-1 text-[12.5px] font-semibold text-ink-soft border border-line">
            {answeredCount} / {total} {t("saved")}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-bg">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand to-indigo-500 transition-all duration-300"
            style={{ width: `${((qi + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Question Card */}
      <Card className="space-y-5 p-6 shadow-md border-line/80">
        <p className="text-[17px] font-bold leading-relaxed text-ink sm:text-[18px]">
          {q.text}
        </p>
        <div className="space-y-2.5">
          {q.options.map((opt, oi) => {
            const selected = answers[q.id] === oi;
            return (
              <button
                key={oi}
                onClick={() => pick(oi)}
                className={cls(
                  "group flex w-full items-center gap-3.5 rounded-xl border p-4 text-left transition-all duration-200",
                  selected
                    ? "border-brand bg-brand-soft/70 shadow-sm text-ink font-bold"
                    : "border-line bg-surface/50 text-ink-soft hover:border-brand/40 hover:bg-bg hover:text-ink"
                )}
              >
                <span
                  className={cls(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-[14px] font-black transition-all",
                    selected
                      ? "border-brand bg-brand text-white shadow-md shadow-brand/30"
                      : "border-line bg-bg text-ink-faint group-hover:border-brand/40 group-hover:text-brand-deep"
                  )}
                >
                  {String.fromCharCode(65 + oi)}
                </span>
                <span className="min-w-0 flex-1 text-[15px] sm:text-[16px]">{opt}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Footer Nav Controls */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <button
          onClick={() => setQi((p) => Math.max(p - 1, 0))}
          disabled={qi === 0}
          className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-4 py-2.5 text-[14px] font-bold text-ink-soft transition-all hover:bg-bg disabled:opacity-40"
        >
          <Icon icon={ChevronLeft} size={18} /> {t("prev")}
        </button>
        {qi < total - 1 ? (
          <button
            onClick={() => setQi((p) => Math.min(p + 1, total - 1))}
            className="flex items-center gap-1.5 rounded-xl bg-ink px-5 py-2.5 text-[14.5px] font-bold text-white shadow-md transition-all hover:bg-ink/90 active:scale-95"
          >
            {t("next")} <Icon icon={ChevronRight} size={18} />
          </button>
        ) : (
          <button
            onClick={() => setConfirm(true)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald to-emerald-deep px-6 py-2.5 text-[14.5px] font-extrabold text-white shadow-lg shadow-emerald/20 transition-all hover:scale-105 active:scale-95"
          >
            <Icon icon={Check} size={18} />
            {t("finishQuiz")}
          </button>
        )}
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
    <div className="space-y-6">
      {/* Result Hero Banner */}
      <div
        className={cls(
          "relative overflow-hidden rounded-[20px] border p-6 text-center shadow-lg sm:p-8 backdrop-blur-md",
          passed
            ? "border-emerald/40 bg-gradient-to-b from-emerald-soft/80 via-surface to-surface"
            : "border-rose/40 bg-gradient-to-b from-rose-soft/80 via-surface to-surface"
        )}
      >
        <div className="relative z-10 flex flex-col items-center">
          <div
            className={cls(
              "mb-4 flex h-16 w-16 items-center justify-center rounded-2xl shadow-inner",
              passed ? "bg-emerald/20 text-emerald" : "bg-rose/20 text-rose"
            )}
          >
            <Icon icon={passed ? Check : X} size={36} strokeWidth={3} />
          </div>
          <p className={cls("text-[42px] font-black tracking-tight tabular-nums sm:text-[48px]", passed ? "text-emerald" : "text-rose")}>
            {attempt.scorePct}%
          </p>
          <p className={cls("mt-1 text-[18px] font-extrabold sm:text-[20px]", passed ? "text-emerald" : "text-rose")}>
            {passed ? t("passedMsg") : t("failedMsg")}
          </p>
          <p className="mt-2 inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 px-4 py-1.5 text-[14px] font-semibold text-ink-soft">
            <span className="font-bold text-ink">{attempt.correctCount}</span> / {attempt.total} {t("correctAnswers")}
          </p>
        </div>
      </div>

      {!passed && (
        <div className="flex items-center gap-3 rounded-xl border border-amber/30 bg-amber-soft/80 p-4 text-[14px] font-medium text-amber-deep">
          <Icon icon={AlertTriangle} size={20} className="shrink-0" />
          {t("cannotRetake")}
        </div>
      )}

      {/* Question Breakdown Analysis */}
      <div className="space-y-4">
        <h3 className="text-[18px] font-extrabold tracking-tight text-ink">{t("analysis")}</h3>
        <div className="space-y-4">
          {attempt.questions.map((q, i) => {
            const studentIdx = q.studentAnswer;
            const wrong = studentIdx !== q.correctIndex;
            return (
              <Card key={q.id} className="space-y-3.5 p-5 shadow-sm border-line">
                <p className="text-[16px] font-bold leading-snug text-ink">
                  <span className="mr-2 text-ink-faint">{i + 1}.</span>
                  {q.text}
                </p>
                <div className="space-y-2">
                  {q.options.map((opt, oi) => {
                    const isCorrect = oi === q.correctIndex;
                    const isStudentWrong = oi === studentIdx && wrong;
                    return (
                      <div
                        key={oi}
                        className={cls(
                          "flex items-center gap-3 rounded-xl border p-3.5 text-[14.5px] transition-all",
                          isCorrect && "border-emerald/40 bg-emerald-soft/60 font-semibold text-ink",
                          isStudentWrong && "border-rose/40 bg-rose-soft/60 font-semibold text-ink",
                          !isCorrect && !isStudentWrong && "border-line bg-surface/40 text-ink-soft opacity-70"
                        )}
                      >
                        {isCorrect ? (
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald text-white">
                            <Icon icon={Check} size={14} strokeWidth={3} />
                          </div>
                        ) : isStudentWrong ? (
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose text-white">
                            <Icon icon={X} size={14} strokeWidth={3} />
                          </div>
                        ) : (
                          <span className="h-6 w-6 shrink-0 rounded-full border border-line bg-bg" />
                        )}
                        <span className="min-w-0 flex-1">{opt}</span>
                        {studentIdx === oi && (
                          <span className="shrink-0 rounded-md bg-bg border border-line px-2 py-1 text-[12px] font-bold text-ink-soft">
                            {t("yourAnswer")}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {q.explanations?.[q.correctIndex ?? 0] && (
                  <div className="rounded-xl border border-blue/20 bg-blue-soft/60 p-3.5 text-[14px] text-ink leading-relaxed">
                    <span className="font-bold text-blue-deep mr-1">Izoh:</span>
                    {q.explanations[q.correctIndex ?? 0]}
                  </div>
                )}
              </Card>
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

  const finishedId = data.attempt?.status === "finished" ? data.attempt.id : null;
  const attemptId = startedId ?? data.inProgressId ?? finishedId;
  const attemptQ = useAttempt(attemptId);

  const onStart = () => start.mutate(data.quizId, { onSuccess: (a) => setStartedId(a.id) });

  if (attemptId === null) return <Intro data={data} onStart={onStart} starting={start.isPending} />;
  if (attemptQ.isLoading) return <div className="flex justify-center py-10"><Spinner size={28} /></div>;
  if (!attemptQ.data) return <Intro data={data} onStart={onStart} starting={start.isPending} />;

  return attemptQ.data.status === "finished" ? <Result attempt={attemptQ.data} /> : <Running attempt={attemptQ.data} topicId={topicId} />;
}
