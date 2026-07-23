import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BookText,
  Check,
  ClipboardList,
  Dices,
  Dumbbell,
  RotateCcw,
  Sparkles,
  Stethoscope,
  User,
  X,
} from "lucide-react";
import { Card, EmptyState, Icon, ProgressRing, Spinner, cls } from "@meduni/ui";
import { CardFace } from "../lesson/FlashcardsTab";
import {
  usePatientPractice,
  usePracticeOverview,
  usePracticeSet,
  type PracticeItem,
} from "../api";

/** Variantli mashq savoli (test savoli yoki keys qadami) — tanlangach darhol izoh. */
function ChoiceItem({
  title,
  prompt,
  options,
  correctIndex,
  explanations,
  sourceFragment,
  onAnswered,
}: {
  title?: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  /** Har variant izohi (bo'sh bo'lishi mumkin). */
  explanations: (string | null)[];
  sourceFragment?: string | null;
  onAnswered: (correct: boolean) => void;
}) {
  const reduce = useReducedMotion();
  const [picked, setPicked] = useState<number | null>(null);

  const pick = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    onAnswered(i === correctIndex);
  };

  return (
    <div>
      {title && (
        <p className="mb-1 text-micro font-extrabold uppercase tracking-wider text-brand-tint">{title}</p>
      )}
      <p className="mb-4 text-section font-bold leading-snug text-ink">{prompt}</p>
      <div className="space-y-2">
        {options.map((o, i) => {
          const isPicked = picked === i;
          const revealed = picked !== null;
          const isCorrect = i === correctIndex;
          return (
            <button
              key={i}
              onClick={() => pick(i)}
              disabled={revealed}
              className={cls(
                "flex w-full items-center gap-3 rounded-control border px-4 py-3 text-left transition-colors",
                revealed && isCorrect && "border-emerald bg-emerald-soft",
                revealed && isPicked && !isCorrect && "border-rose bg-rose-soft",
                revealed && !isPicked && !isCorrect && "border-line opacity-60",
                !revealed && "border-line hover:bg-surface-raised"
              )}
            >
              <span
                className={cls(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-control text-note font-extrabold",
                  revealed && isCorrect
                    ? "bg-emerald text-white"
                    : revealed && isPicked
                      ? "bg-rose text-white"
                      : "bg-surface-raised text-ink-soft"
                )}
              >
                {revealed && isCorrect ? (
                  <Icon icon={Check} size={14} strokeWidth={3} />
                ) : revealed && isPicked ? (
                  <Icon icon={X} size={14} strokeWidth={3} />
                ) : (
                  String.fromCharCode(65 + i)
                )}
              </span>
              <span className="min-w-0 flex-1 text-body text-ink-strong">{o}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {picked !== null && (
          <motion.div
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            {(explanations[correctIndex] || explanations[picked]) && (
              <div className="mt-3 rounded-control border-l-2 border-brand bg-brand-soft px-4 py-3">
                <p className="text-body leading-relaxed text-ink-strong">
                  {explanations[picked] || explanations[correctIndex]}
                </p>
              </div>
            )}
            {sourceFragment && (
              <p className="mt-2 border-l-2 border-line pl-3 text-note italic leading-relaxed text-ink-faint">
                <Icon icon={BookText} size={13} className="mr-1 inline" />
                {sourceFragment}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Bitta mavzuning mashq pleyeri. */
function PracticePlayer({ topicId, onExit }: { topicId: number; onExit: () => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "practice" });
  const reduce = useReducedMotion();
  const navigate = useNavigate();
  const q = usePracticeSet(topicId);

  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [answeredCurrent, setAnsweredCurrent] = useState(false);
  const [finished, setFinished] = useState(false);

  const items = useMemo(() => q.data?.items ?? [], [q.data]);
  const item = items[i] as PracticeItem | undefined;
  const gradedTotal = items.filter((x) => x.kind !== "card").length;

  useEffect(() => {
    setFlipped(false);
    setAnsweredCurrent(false);
  }, [i]);

  if (q.isLoading)
    return (
      <div className="flex justify-center py-12">
        <Spinner size={24} />
      </div>
    );
  if (!q.data || items.length === 0)
    return (
      <div className="py-6">
        <EmptyState icon={<Icon icon={Sparkles} size={22} />} text={t("noMistakes")} />
      </div>
    );

  const next = () => {
    if (i < items.length - 1) setI(i + 1);
    else setFinished(true);
  };

  if (finished) {
    const pct = gradedTotal ? Math.round((correct / gradedTotal) * 100) : 100;
    return (
      <div className="mx-auto flex max-w-[440px] flex-col items-center gap-4 py-6 text-center">
        <ProgressRing value={pct} size={120} stroke={12} tone={pct >= 70 ? "emerald" : "amber"} />
        <div>
          <p className="text-section font-extrabold text-ink">{t("doneTitle")}</p>
          {gradedTotal > 0 && (
            <p className="mt-1 text-body text-ink-soft">{t("doneHint", { n: correct, total: gradedTotal })}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            onClick={() => {
              setI(0);
              setCorrect(0);
              setFinished(false);
            }}
            className="inline-flex items-center gap-2 rounded-control bg-brand px-5 py-2.5 text-body font-bold text-white transition-colors hover:bg-brand-deep"
          >
            <Icon icon={RotateCcw} size={16} />
            {t("again")}
          </button>
          <button
            onClick={() => navigate(`/app/topics/${topicId}?view=konspekt`)}
            className="inline-flex items-center gap-2 rounded-control border border-line px-5 py-2.5 text-body font-bold text-ink-soft transition-colors hover:bg-surface-raised hover:text-ink"
          >
            <Icon icon={BookText} size={16} />
            {t("reread")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[640px]">
      {/* Shapka: orqaga + jarayon */}
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={onExit}
          className="inline-flex items-center gap-1.5 rounded-control px-2 py-1.5 text-note font-semibold text-brand-tint transition-colors hover:bg-surface-raised"
        >
          <Icon icon={ArrowLeft} size={15} />
          {t("back")}
        </button>
        <span className="text-note font-extrabold uppercase tracking-wider text-ink-dim">
          {i + 1} / {items.length}
        </span>
        <span className="min-w-0 flex-1 truncate text-right text-note font-bold text-ink-soft">
          {q.data.topicTitle}
        </span>
      </div>
      <div className="mb-4 flex gap-1">
        {items.map((_, n) => (
          <span
            key={n}
            className={cls(
              "h-1.5 flex-1 rounded-pill transition-colors",
              n < i ? "bg-emerald" : n === i ? "bg-brand" : "bg-line-raised"
            )}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={i}
          initial={reduce ? false : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduce ? undefined : { opacity: 0, x: -24 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
        >
          {item?.kind === "quiz" && (
            <ChoiceItem
              title={t("kindQuiz")}
              prompt={item.text}
              options={item.options}
              correctIndex={item.correctIndex}
              explanations={item.explanations}
              sourceFragment={item.sourceFragment}
              onAnswered={(ok) => {
                if (ok) setCorrect((c) => c + 1);
                setAnsweredCurrent(true);
              }}
            />
          )}
          {item?.kind === "step" && (
            <ChoiceItem
              title={`${t("kindStep")} · ${item.title}`}
              prompt={item.prompt}
              options={item.options.map((o) => o.text)}
              correctIndex={item.options.findIndex((o) => o.correct)}
              explanations={item.options.map((o) => o.feedback)}
              onAnswered={(ok) => {
                if (ok) setCorrect((c) => c + 1);
                setAnsweredCurrent(true);
              }}
            />
          )}
          {item?.kind === "card" && (
            <div className="space-y-3">
              <p className="text-micro font-extrabold uppercase tracking-wider text-violet">{t("kindCard")}</p>
              <CardFace
                card={{ key: `p${i}`, kind: "term", front: item.front, back: item.back, note: item.note, known: null }}
                flipped={flipped}
                onFlip={() => setFlipped((f) => !f)}
              />
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Keyingi tugma — javob berilgach (kartada doim) */}
      <div className="mt-4 flex justify-end">
        <button
          onClick={next}
          disabled={item?.kind !== "card" && !answeredCurrent}
          className="group inline-flex items-center gap-2 rounded-control bg-brand px-5 py-2.5 text-body font-bold text-white transition-colors hover:bg-brand-deep disabled:opacity-35"
        >
          {i === items.length - 1 ? t("finish") : t("next")}
          <Icon icon={ArrowRight} size={16} className="transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
}

/** O'zlashtirish → Mashg'ulotlar tabi: virtual bemor markazi + xatolar ustida ishlash. */
export function PracticeTab() {
  const { t } = useTranslation(undefined, { keyPrefix: "practice" });
  const navigate = useNavigate();
  const overviewQ = usePracticeOverview();
  const patientsQ = usePatientPractice();
  const [activeTopic, setActiveTopic] = useState<number | null>(null);

  const topics = overviewQ.data?.topics ?? [];
  const patients = patientsQ.data?.patients ?? [];

  const randomPatient = () => {
    if (patients.length === 0) return;
    const p = patients[Math.floor(Math.random() * patients.length)];
    navigate(`/app/topics/${p.topicId}?view=patient`);
  };

  if (activeTopic !== null) {
    return (
      <Card className="p-5 sm:p-6">
        <PracticePlayer topicId={activeTopic} onExit={() => setActiveTopic(null)} />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Virtual bemor amaliyot markazi */}
      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-rose-soft text-rose">
            <Icon icon={Stethoscope} size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-body font-extrabold text-ink">{t("patientTitle")}</p>
            <p className="text-note text-ink-faint">{t("patientHint")}</p>
          </div>
          {patients.length > 1 && (
            <button
              onClick={randomPatient}
              className="inline-flex shrink-0 items-center gap-2 rounded-control bg-rose px-4 py-2 text-note font-extrabold text-white transition-opacity hover:opacity-90"
            >
              <Icon icon={Dices} size={16} />
              {t("randomPatient")}
            </button>
          )}
        </div>
        {patientsQ.isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner size={20} />
          </div>
        ) : patients.length === 0 ? (
          <p className="px-5 py-5 text-note text-ink-faint">{t("patientEmpty")}</p>
        ) : (
          <div className="grid gap-px bg-line sm:grid-cols-2 xl:grid-cols-3">
            {patients.map((p) => (
              <button
                key={p.topicId}
                onClick={() => navigate(`/app/topics/${p.topicId}?view=patient`)}
                className="group flex items-center gap-3 bg-surface px-4 py-3.5 text-left transition-colors hover:bg-surface-raised"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-rose-soft text-rose">
                  <Icon icon={User} size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-bold text-ink">
                    {p.patientName || t("patientDefault")}
                  </span>
                  <span className="block truncate text-note text-ink-faint">
                    {p.topicTitle} · {p.subjectName}
                  </span>
                </span>
                {p.finished ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-pill bg-emerald-soft px-2 py-0.5 text-micro font-bold text-emerald">
                    <Icon icon={Check} size={11} strokeWidth={3} />
                    {t("patientAgain")}
                  </span>
                ) : (
                  <Icon
                    icon={ArrowRight}
                    size={16}
                    className="shrink-0 text-ink-dim transition-transform group-hover:translate-x-0.5"
                  />
                )}
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Xatolar ustida ishlash */}
      <Card className="overflow-hidden p-0">
        <div className="flex items-center gap-3 border-b border-line px-5 py-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-amber-soft text-amber">
            <Icon icon={Dumbbell} size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-body font-extrabold text-ink">{t("mistakesTitle")}</p>
            <p className="text-note text-ink-faint">{t("mistakesHint")}</p>
          </div>
        </div>
        {overviewQ.isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner size={20} />
          </div>
        ) : topics.length === 0 ? (
          <div className="px-5 py-6">
            <EmptyState icon={<Icon icon={Sparkles} size={22} />} text={t("noMistakesAll")} hint={t("noMistakesAllHint")} />
          </div>
        ) : (
          <div className="divide-y divide-line">
            {topics.map((tp) => (
              <button
                key={tp.topicId}
                onClick={() => setActiveTopic(tp.topicId)}
                className="group flex w-full flex-wrap items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-surface-raised"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body font-bold text-ink group-hover:text-brand-tint">{tp.topicTitle}</p>
                  <p className="truncate text-note text-ink-faint">{tp.subjectName}</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  {tp.wrongQuiz > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-pill bg-blue-soft px-2 py-0.5 text-micro font-bold text-blue">
                      <Icon icon={ClipboardList} size={11} />
                      {t("nQuiz", { n: tp.wrongQuiz })}
                    </span>
                  )}
                  {tp.wrongSteps > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-pill bg-rose-soft px-2 py-0.5 text-micro font-bold text-rose">
                      <Icon icon={Stethoscope} size={11} />
                      {t("nSteps", { n: tp.wrongSteps })}
                    </span>
                  )}
                  {tp.unknownCards > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-pill bg-violet-soft px-2 py-0.5 text-micro font-bold text-violet">
                      <Icon icon={Sparkles} size={11} />
                      {t("nCards", { n: tp.unknownCards })}
                    </span>
                  )}
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-control bg-brand px-3.5 py-2 text-note font-extrabold text-white transition-colors group-hover:bg-brand-deep">
                  {t("start")}
                  <Icon icon={ArrowRight} size={14} />
                </span>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
