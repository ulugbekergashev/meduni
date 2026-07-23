import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check, ChevronDown, ClipboardList, Send, Sparkles, Stethoscope } from "lucide-react";
import { Card, Icon, cls } from "@meduni/ui";
import { QuickTaskModal, type QuickTaskPrefill } from "../../../components/QuickTaskModal";
import { useCourseMistakes, type MistakeQuestion, type MistakeStep, type MistakeTopic } from "../api";

function pctTone(p: number) {
  if (p >= 60) return "text-rose";
  if (p >= 30) return "text-amber";
  return "text-emerald";
}

/** Variant taqsimoti — nechta talaba qaysi variantni tanlagani. */
function Distribution({
  options,
  correctIndex,
  distribution,
  noAnswer,
  total,
}: {
  options: string[];
  correctIndex: number;
  distribution: number[];
  noAnswer: number;
  total: number;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "mistakes" });
  return (
    <div className="mt-2.5 space-y-1.5">
      {options.map((o, i) => {
        const n = distribution[i] ?? 0;
        const pct = total ? Math.round((n / total) * 100) : 0;
        const correct = i === correctIndex;
        return (
          <div key={i} className="flex items-center gap-2.5">
            <span
              className={cls(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-control text-micro font-extrabold",
                correct ? "bg-emerald text-white" : "bg-surface-raised text-ink-soft"
              )}
            >
              {correct ? <Icon icon={Check} size={12} strokeWidth={3} /> : String.fromCharCode(65 + i)}
            </span>
            <span className="min-w-0 flex-1 truncate text-note text-ink-strong">{o}</span>
            <span className="h-2 w-28 shrink-0 overflow-hidden rounded-pill bg-line">
              <span
                className={cls("block h-full rounded-pill", correct ? "bg-emerald" : "bg-rose")}
                style={{ width: `${pct}%` }}
              />
            </span>
            <span className="w-14 shrink-0 text-right text-note font-bold tabular-nums text-ink-soft">
              {n} ({pct}%)
            </span>
          </div>
        );
      })}
      {noAnswer > 0 && (
        <p className="text-micro text-ink-faint">{t("noAnswerN", { n: noAnswer })}</p>
      )}
    </div>
  );
}

function QuestionRow({ q, attempted }: { q: MistakeQuestion; attempted: number }) {
  const { t } = useTranslation(undefined, { keyPrefix: "mistakes" });
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-line px-4 py-3 last:border-b-0">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-start gap-3 text-left">
        <span className={cls("mt-0.5 w-14 shrink-0 text-body font-extrabold tabular-nums", pctTone(q.wrongPct))}>
          {q.wrongPct}%
        </span>
        <span className="min-w-0 flex-1 text-body font-semibold leading-snug text-ink">{q.text}</span>
        <Icon
          icon={ChevronDown}
          size={16}
          className={cls("mt-1 shrink-0 text-ink-dim transition-transform", !open && "-rotate-90")}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden pl-[68px]"
          >
            <Distribution
              options={q.options}
              correctIndex={q.correctIndex}
              distribution={q.distribution}
              noAnswer={q.noAnswer}
              total={attempted}
            />
            {q.wrongStudents.length > 0 && (
              <p className="mt-2 text-note text-ink-faint">
                <span className="font-bold text-ink-soft">{t("wrongWho")}:</span>{" "}
                {q.wrongStudents.map((s) => s.fullName).join(", ")}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StepRow({ s, submitted }: { s: MistakeStep; submitted: number }) {
  const { t } = useTranslation(undefined, { keyPrefix: "mistakes" });
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-line px-4 py-3 last:border-b-0">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-start gap-3 text-left">
        <span className={cls("mt-0.5 w-14 shrink-0 text-body font-extrabold tabular-nums", pctTone(s.wrongPct))}>
          {s.wrongPct}%
        </span>
        <span className="min-w-0 flex-1">
          <span className="mr-2 rounded-pill bg-rose-soft px-2 py-0.5 text-micro font-extrabold text-rose">
            {s.title}
          </span>
          <span className="text-body font-semibold leading-snug text-ink">{s.prompt}</span>
        </span>
        <Icon
          icon={ChevronDown}
          size={16}
          className={cls("mt-1 shrink-0 text-ink-dim transition-transform", !open && "-rotate-90")}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden pl-[68px]"
          >
            <Distribution
              options={s.options.map((o) => o.text)}
              correctIndex={s.options.findIndex((o) => o.correct)}
              distribution={s.distribution}
              noAnswer={submitted - s.distribution.reduce((a, b) => a + b, 0)}
              total={submitted}
            />
            {s.wrongStudents.length > 0 && (
              <p className="mt-2 text-note text-ink-faint">
                <span className="font-bold text-ink-soft">{t("wrongWho")}:</span>{" "}
                {s.wrongStudents.map((x) => x.fullName).join(", ")}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TopicBlock({ tp, onAssign }: { tp: MistakeTopic; onAssign: (prefill: QuickTaskPrefill) => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "mistakes" });
  const [open, setOpen] = useState(tp.severity >= 50);

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <button onClick={() => setOpen((o) => !o)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span
            className={cls(
              "flex h-10 w-14 shrink-0 items-center justify-center rounded-control text-body font-extrabold tabular-nums",
              tp.severity >= 60
                ? "bg-rose-soft text-rose"
                : tp.severity >= 30
                  ? "bg-amber-soft text-amber"
                  : "bg-emerald-soft text-emerald"
            )}
          >
            {tp.severity}%
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-body font-bold text-ink">{tp.title}</span>
            <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
              {tp.quiz && (
                <span className="inline-flex items-center gap-1 text-micro font-bold text-ink-faint">
                  <Icon icon={ClipboardList} size={11} />
                  {t("attemptedN", { n: tp.quiz.attempted })}
                </span>
              )}
              {tp.case && (
                <span className="inline-flex items-center gap-1 text-micro font-bold text-ink-faint">
                  <Icon icon={Stethoscope} size={11} />
                  {t("submittedN", { n: tp.case.submitted })}
                </span>
              )}
              {tp.unknownCards > 0 && (
                <span className="inline-flex items-center gap-1 text-micro font-bold text-violet">
                  <Icon icon={Sparkles} size={11} />
                  {t("unknownN", { n: tp.unknownCards })}
                </span>
              )}
            </span>
          </span>
          <Icon
            icon={ChevronDown}
            size={17}
            className={cls("shrink-0 text-ink-dim transition-transform", !open && "-rotate-90")}
          />
        </button>
        {/* Assotsiatsiya: talaba tomonidagi Mashg'ulotlar tabiga deep-link bilan topshiriq */}
        <button
          onClick={() =>
            onAssign({
              title: t("assignTitle", { topic: tp.title }),
            })
          }
          className="inline-flex shrink-0 items-center gap-1.5 rounded-control bg-brand px-3.5 py-2 text-note font-extrabold text-white transition-colors hover:bg-brand-deep"
        >
          <Icon icon={Send} size={14} />
          {t("assignBtn")}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {tp.quiz && tp.quiz.questions.filter((q) => q.wrongCount > 0).length > 0 && (
              <div>
                <p className="bg-surface-raised px-4 py-1.5 text-micro font-extrabold uppercase tracking-wider text-ink-faint">
                  {t("quizSection")}
                </p>
                {tp.quiz.questions
                  .filter((q) => q.wrongCount > 0)
                  .sort((a, b) => b.wrongPct - a.wrongPct)
                  .map((q) => (
                    <QuestionRow key={q.questionId} q={q} attempted={tp.quiz!.attempted} />
                  ))}
              </div>
            )}
            {tp.case && tp.case.steps.filter((s) => s.wrongCount > 0).length > 0 && (
              <div>
                <p className="bg-surface-raised px-4 py-1.5 text-micro font-extrabold uppercase tracking-wider text-ink-faint">
                  {t("caseSection")}
                </p>
                {tp.case.steps
                  .filter((s) => s.wrongCount > 0)
                  .sort((a, b) => b.wrongPct - a.wrongPct)
                  .map((s) => (
                    <StepRow key={s.index} s={s} submitted={tp.case!.submitted} />
                  ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

/** Guruh xatolari xaritasi — ProgressTab ichida (Modul 28 Faza 1).
 *  Talaba "Xatolar ustida ishlash" bilan bir xil mezonlar — raqamlar mos. */
export function MistakesMap({ courseId }: { courseId: number }) {
  const { t } = useTranslation(undefined, { keyPrefix: "mistakes" });
  const q = useCourseMistakes(courseId);
  const [assignPrefill, setAssignPrefill] = useState<QuickTaskPrefill | null>(null);

  const topics = q.data?.topics ?? [];
  const hard = topics.filter((tp) => tp.severity >= 50);

  return (
    <section className="mt-5">
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-control bg-rose-soft text-rose">
          <Icon icon={AlertTriangle} size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-section font-extrabold text-ink">{t("title")}</h2>
          <p className="text-note text-ink-faint">
            {hard.length > 0 ? t("subtitleHard", { n: hard.length }) : t("subtitle")}
          </p>
        </div>
      </div>

      {q.isLoading ? (
        <Card className="p-6 text-center text-note text-ink-faint">…</Card>
      ) : topics.length === 0 ? (
        <Card className="border-dashed p-6 text-center text-note text-ink-faint">{t("empty")}</Card>
      ) : (
        <div className="space-y-3">
          {topics.map((tp) => (
            <TopicBlock key={tp.topicId} tp={tp} onAssign={(p) => setAssignPrefill(p)} />
          ))}
        </div>
      )}

      <QuickTaskModal
        open={assignPrefill !== null}
        prefill={assignPrefill ?? undefined}
        onClose={() => setAssignPrefill(null)}
      />
    </section>
  );
}
