import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  Check,
  ChevronRight,
  ClipboardList,
  FlaskConical,
  HeartPulse,
  Stethoscope,
  Thermometer,
  User,
  X,
} from "lucide-react";
import { Icon, Textarea, cls } from "@meduni/ui";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { useSubmitCase, type CaseStep, type CaseTabData } from "../api";

function Block({ icon, title, text }: { icon: typeof User; title: string; text: string }) {
  if (!text) return null;
  return (
    <div className="border-b border-line py-2.5 last:border-b-0">
      <p className="mb-1 inline-flex items-center gap-1.5 text-micro font-extrabold uppercase tracking-wider text-ink-dim">
        <Icon icon={icon} size={11} />
        {title}
      </p>
      <p className="whitespace-pre-line text-note leading-relaxed text-ink-strong">{text}</p>
    </div>
  );
}

/** Bemor kartasi — ism, ma'lumot va hayotiy ko'rsatkichlar (materialda bo'lsa). */
function PatientCard({ patient }: { patient: CaseTabData["patient"] }) {
  const v = patient?.vitals;
  const vitals = [
    { icon: Activity, label: "AB", value: v?.bp },
    { icon: HeartPulse, label: "Puls", value: v?.pulse },
    { icon: Activity, label: "SpO₂", value: v?.spo2 },
    { icon: Thermometer, label: "t°", value: v?.temp },
  ].filter((x) => x.value);

  if (!patient?.name && !patient?.info && vitals.length === 0) return null;

  return (
    <div className="rounded-card border border-line bg-surface-raised p-3.5">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-rose-soft text-rose">
          <Icon icon={User} size={16} />
        </div>
        <div className="min-w-0">
          {patient.name && <p className="truncate text-body font-extrabold text-ink">{patient.name}</p>}
          {patient.info && <p className="truncate text-micro text-ink-dim">{patient.info}</p>}
        </div>
      </div>
      {vitals.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {vitals.map((x) => (
            <span
              key={x.label}
              className="inline-flex items-center gap-1 rounded-control bg-surface px-2 py-1 text-micro font-bold text-ink-soft"
            >
              <Icon icon={x.icon} size={11} className="text-ink-dim" />
              {x.label} <span className="tabular-nums text-ink">{x.value}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Bitta qadam — variant tanlangach darhol izoh chiqadi. */
function StepView({
  step,
  chosen,
  onPick,
  locked,
}: {
  step: CaseStep;
  chosen: number | null;
  onPick: (i: number) => void;
  locked: boolean;
}) {
  const reduce = useReducedMotion();
  const picked = chosen !== null ? step.options.find((o) => o.index === chosen) : null;

  return (
    <div className="rounded-card border border-line bg-surface-raised p-4">
      <p className="mb-0.5 text-micro font-extrabold uppercase tracking-wider text-brand-tint">
        {step.index + 1}. {step.title}
      </p>
      <p className="mb-3 text-body font-bold leading-snug text-ink">{step.prompt}</p>

      <div className="space-y-1.5">
        {step.options.map((o) => {
          const isChosen = chosen === o.index;
          const revealed = o.correct !== undefined;
          return (
            <button
              key={o.index}
              onClick={() => !locked && chosen === null && onPick(o.index)}
              disabled={locked || chosen !== null}
              className={cls(
                "flex w-full items-center gap-2.5 rounded-control border px-3 py-2.5 text-left transition-colors",
                isChosen && o.correct && "border-emerald bg-emerald-soft",
                isChosen && o.correct === false && "border-rose bg-rose-soft",
                isChosen && !revealed && "border-brand bg-brand-soft",
                !isChosen && revealed && o.correct && "border-emerald",
                !isChosen && !(revealed && o.correct) && "border-line",
                chosen === null && !locked && "hover:bg-surface"
              )}
            >
              <span
                className={cls(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-control text-micro font-extrabold",
                  isChosen && o.correct
                    ? "bg-emerald text-white"
                    : isChosen && o.correct === false
                      ? "bg-rose text-white"
                      : "bg-surface text-ink-dim"
                )}
              >
                {isChosen && o.correct ? (
                  <Icon icon={Check} size={12} strokeWidth={3} />
                ) : isChosen && o.correct === false ? (
                  <Icon icon={X} size={12} strokeWidth={3} />
                ) : (
                  String.fromCharCode(65 + o.index)
                )}
              </span>
              <span className="min-w-0 flex-1 text-note text-ink-strong">{o.text}</span>
            </button>
          );
        })}
      </div>

      {/* Darhol feedback */}
      <AnimatePresence>
        {picked?.feedback && (
          <motion.p
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className={cls(
              "mt-2.5 overflow-hidden rounded-control border-l-2 px-3 py-2 text-note leading-relaxed text-ink-strong",
              picked.correct ? "border-emerald bg-emerald-soft" : "border-rose bg-rose-soft"
            )}
          >
            {picked.feedback}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

export function CaseTab({ topicId, data }: { topicId: number; data: CaseTabData }) {
  const { t } = useTranslation(undefined, { keyPrefix: "lesson" });
  const submit = useSubmitCase(topicId);
  const attempt = data.attempt;
  const submitted = !!attempt;

  const steps = data.steps ?? [];
  const hasSteps = steps.length > 0;

  const [picks, setPicks] = useState<Record<number, number>>(() => {
    const init: Record<number, number> = {};
    for (const s of steps) if (s.chosen !== null) init[s.index] = s.chosen;
    return init;
  });
  const [answers, setAnswers] = useState<string[]>(attempt?.answers ?? data.questions.map(() => ""));
  const [confirm, setConfirm] = useState(false);

  const allStepsDone = !hasSteps || steps.every((s) => picks[s.index] !== undefined);
  const allAnswered = answers.every((a) => a.trim().length > 0);
  const canSubmit = allStepsDone && allAnswered && !submitted;

  // Qadamlar ketma-ket ochiladi: oldingisi tanlangunicha keyingisi ko'rinmaydi.
  const visibleSteps = submitted
    ? steps
    : steps.filter((_, i) => i === 0 || picks[steps[i - 1].index] !== undefined);

  const doSubmit = () =>
    submit.mutate(
      {
        caseId: data.caseId,
        answers: answers.map((a) => a.trim()),
        steps: hasSteps ? Object.fromEntries(Object.entries(picks)) : undefined,
      },
      { onSuccess: () => setConfirm(false) }
    );

  return (
    <div className="space-y-3">
      <PatientCard patient={data.patient} />

      {/* Keys sharti */}
      <div className="rounded-card border border-line px-3.5 py-1">
        <Block icon={User} title={t("caseComplaints")} text={data.blocks.complaints} />
        <Block icon={ClipboardList} title={t("caseAnamnesis")} text={data.blocks.anamnesis} />
        <Block icon={Stethoscope} title={t("caseObjective")} text={data.blocks.objectiveStatus} />
        <Block icon={FlaskConical} title={t("caseLab")} text={data.blocks.labData} />
      </div>

      {/* v2 — bosqichma-bosqich qarorlar */}
      {hasSteps && (
        <div className="space-y-2.5">
          <p className="flex items-center gap-1.5 text-micro font-extrabold uppercase tracking-wider text-ink-dim">
            <Icon icon={ChevronRight} size={12} />
            {t("caseSteps")} · {Object.keys(picks).length}/{steps.length}
          </p>
          {visibleSteps.map((s) => (
            <StepView
              key={s.index}
              step={s}
              chosen={picks[s.index] ?? null}
              onPick={(i) => setPicks((p) => ({ ...p, [s.index]: i }))}
              locked={submitted}
            />
          ))}
        </div>
      )}

      {/* Erkin savollar — o'qituvchi baholaydi */}
      {data.questions.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-micro font-extrabold uppercase tracking-wider text-ink-dim">{t("caseWritten")}</p>
          {data.questions.map((q, i) => (
            <div key={i} className="rounded-card border border-line p-3.5">
              <p className="mb-2 text-note font-bold leading-snug text-ink">
                <span className="mr-1.5 tabular-nums text-ink-dim">{i + 1}.</span>
                {q}
              </p>
              {submitted ? (
                <>
                  <p className="whitespace-pre-wrap rounded-control bg-surface-raised px-3 py-2 text-note text-ink-strong">
                    {attempt!.answers[i]}
                  </p>
                  {attempt!.referenceAnswer[i] && (
                    <div className="mt-2 rounded-control border-l-2 border-emerald bg-emerald-soft px-3 py-2">
                      <p className="mb-0.5 text-micro font-extrabold uppercase tracking-wider text-emerald">
                        {t("referenceAnswer")}
                      </p>
                      <p className="whitespace-pre-wrap text-note leading-relaxed text-ink-strong">
                        {attempt!.referenceAnswer[i]}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <Textarea
                  value={answers[i]}
                  onChange={(e) => setAnswers((a) => a.map((x, xi) => (xi === i ? e.target.value : x)))}
                  placeholder={t("yourAnswerPlaceholder")}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Natija / topshirish */}
      {submitted ? (
        <div className="space-y-2">
          {attempt!.autoScore !== null && (
            <div className="flex items-center gap-2.5 rounded-control bg-surface-raised px-3.5 py-2.5">
              <Icon icon={Check} size={15} className="shrink-0 text-emerald" strokeWidth={3} />
              <span className="flex-1 text-note font-bold text-ink">{t("caseAutoScore")}</span>
              <span className="text-body font-extrabold tabular-nums text-ink">{attempt!.autoScore}%</span>
            </div>
          )}
          {attempt!.reviewed ? (
            <div className="rounded-control border-l-2 border-emerald bg-emerald-soft px-3.5 py-2.5">
              <p className="text-note font-extrabold text-emerald">
                {t("grade")}: {attempt!.score}
              </p>
              {attempt!.teacherFeedback && (
                <p className="mt-1 text-note leading-relaxed text-ink-strong">{attempt!.teacherFeedback}</p>
              )}
            </div>
          ) : (
            <p className="rounded-control border-l-2 border-amber bg-amber-soft px-3.5 py-2.5 text-note font-bold text-amber">
              {t("underReview")}
            </p>
          )}
        </div>
      ) : (
        <button
          onClick={() => setConfirm(true)}
          disabled={!canSubmit || submit.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-control bg-brand px-4 py-2.5 text-body font-extrabold text-white transition-colors hover:bg-brand-deep disabled:opacity-40"
        >
          {t("submitCase")}
        </button>
      )}

      <ConfirmDialog
        open={confirm}
        title={t("submitCaseTitle")}
        message={t("submitCaseConfirm")}
        confirmLabel={t("submitCase")}
        confirmVariant="primary"
        loading={submit.isPending}
        onConfirm={doSubmit}
        onClose={() => setConfirm(false)}
      />
    </div>
  );
}
