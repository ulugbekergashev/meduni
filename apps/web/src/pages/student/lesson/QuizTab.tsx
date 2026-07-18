import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, X } from "lucide-react";
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
    <Card className="space-y-4 text-center">
      <div className="flex flex-wrap justify-center gap-3 text-[14.5px] text-ink-soft">
        <span>
          <span className="font-bold text-ink">{data.questionCount}</span> {t("questions")}
        </span>
        <span>·</span>
        <span>
          {t("passIs")} <span className="font-bold text-ink">{data.passThreshold}%</span>
        </span>
      </div>
      <div className="flex items-start gap-2 rounded-control bg-amber-soft p-3 text-left text-[14px] text-amber">
        <Icon icon={AlertTriangle} size={16} className="mt-0.5 shrink-0" />
        {t("quizWarning")}
      </div>
      <button
        onClick={onStart}
        disabled={starting}
        className="w-full rounded-control bg-blue px-4 py-3 text-[16px] font-bold text-white transition-all hover:opacity-90 disabled:opacity-60"
      >
        {starting ? t("starting") : t("startQuiz")}
      </button>
    </Card>
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
    <div className="space-y-4">
      <div>
        <div className="mb-1.5 flex items-center justify-between text-[14px] font-semibold text-ink-soft">
          <span>
            {t("question")} {qi + 1} / {total}
          </span>
          <span>
            {answeredCount}/{total}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-pill bg-bg">
          <div className="h-full rounded-pill bg-blue transition-all" style={{ width: `${((qi + 1) / total) * 100}%` }} />
        </div>
      </div>

      <Card className="space-y-4">
        <p className="text-[16.5px] font-semibold text-ink">{q.text}</p>
        <div className="space-y-2">
          {q.options.map((opt, oi) => {
            const selected = answers[q.id] === oi;
            return (
              <button
                key={oi}
                onClick={() => pick(oi)}
                className={cls(
                  "flex w-full items-center gap-3 rounded-control border p-3 text-left text-[15.5px] transition-all",
                  selected ? "border-blue bg-blue-soft text-ink" : "border-line text-ink-soft hover:border-blue/50"
                )}
              >
                <span
                  className={cls(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[13px] font-bold",
                    selected ? "border-blue bg-blue text-white" : "border-line text-ink-faint"
                  )}
                >
                  {String.fromCharCode(65 + oi)}
                </span>
                {opt}
              </button>
            );
          })}
        </div>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => setQi((p) => Math.max(p - 1, 0))}
          disabled={qi === 0}
          className="flex items-center gap-1 rounded-control border border-line px-3 py-2 text-[14.5px] font-medium text-ink-soft transition-colors hover:bg-bg disabled:opacity-40"
        >
          <Icon icon={ChevronLeft} size={16} /> {t("prev")}
        </button>
        {qi < total - 1 ? (
          <button
            onClick={() => setQi((p) => Math.min(p + 1, total - 1))}
            className="flex items-center gap-1 rounded-control bg-ink px-4 py-2 text-[14.5px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            {t("next")} <Icon icon={ChevronRight} size={16} />
          </button>
        ) : (
          <button
            onClick={() => setConfirm(true)}
            className="rounded-control bg-blue px-4 py-2 text-[14.5px] font-bold text-white transition-opacity hover:opacity-90"
          >
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
    <div className="space-y-4">
      <Card className={cls("text-center", passed ? "border-emerald/40 bg-emerald-soft" : "border-rose/40 bg-rose-soft")}>
        <p className={cls("text-[34px] font-bold tabular-nums", passed ? "text-emerald" : "text-rose")}>{attempt.scorePct}%</p>
        <p className={cls("text-[16px] font-bold", passed ? "text-emerald" : "text-rose")}>
          {passed ? t("passedMsg") : t("failedMsg")}
        </p>
        <p className="mt-1 text-[14px] text-ink-soft">
          {attempt.correctCount}/{attempt.total} {t("correctAnswers")}
        </p>
      </Card>

      {!passed && <div className="rounded-control bg-amber-soft px-3 py-2 text-[14px] text-amber">{t("cannotRetake")}</div>}

      <h3 className="text-section font-bold text-ink">{t("analysis")}</h3>
      <div className="space-y-3">
        {attempt.questions.map((q, i) => {
          const studentIdx = q.studentAnswer;
          const wrong = studentIdx !== q.correctIndex;
          return (
            <Card key={q.id} className="space-y-3">
              <p className="text-[15.5px] font-semibold text-ink">
                {i + 1}. {q.text}
              </p>
              <div className="space-y-2">
                {q.options.map((opt, oi) => {
                  const isCorrect = oi === q.correctIndex;
                  const isStudentWrong = oi === studentIdx && wrong;
                  return (
                    <div
                      key={oi}
                      className={cls(
                        "flex items-center gap-2 rounded-control border p-2.5 text-[14.5px]",
                        isCorrect && "border-emerald/40 bg-emerald-soft text-ink",
                        isStudentWrong && "border-rose/40 bg-rose-soft text-ink",
                        !isCorrect && !isStudentWrong && "border-line text-ink-soft"
                      )}
                    >
                      {isCorrect ? (
                        <Icon icon={Check} size={15} className="shrink-0 text-emerald" />
                      ) : isStudentWrong ? (
                        <Icon icon={X} size={15} className="shrink-0 text-rose" />
                      ) : (
                        <span className="h-[15px] w-[15px] shrink-0" />
                      )}
                      {opt}
                      {studentIdx === oi && <span className="ml-auto text-[12.5px] font-semibold text-ink-faint">{t("yourAnswer")}</span>}
                    </div>
                  );
                })}
              </div>
              {q.explanations?.[q.correctIndex ?? 0] && (
                <div className="rounded-control bg-blue-soft px-3 py-2 text-[14px] text-blue">{q.explanations[q.correctIndex ?? 0]}</div>
              )}
            </Card>
          );
        })}
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
  if (attemptQ.isLoading) return <div className="flex justify-center py-10"><Spinner size={24} /></div>;
  if (!attemptQ.data) return <Intro data={data} onStart={onStart} starting={start.isPending} />;

  return attemptQ.data.status === "finished" ? <Result attempt={attemptQ.data} /> : <Running attempt={attemptQ.data} topicId={topicId} />;
}
