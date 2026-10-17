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
import { Button, EmptyState, Icon, ProgressRing, Spinner, cls } from "@meduni/ui";
import { BentoCard } from "../../../components/bento";
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
        <p className="mb-1 text-micro font-semibold text-brand-tint">{title}</p>
      )}
      <p className="mb-4 text-section font-semibold leading-snug text-ink">{prompt}</p>
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
                !revealed && "border-line hover:border-line-raised hover:bg-surface-raised"
              )}
            >
              <span
                className={cls(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-note font-semibold",
                  revealed && isCorrect
                    ? "bg-emerald text-surface"
                    : revealed && isPicked
                      ? "bg-rose text-surface"
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
          <p className="text-section font-semibold text-ink">{t("doneTitle")}</p>
          {gradedTotal > 0 && (
            <p className="mt-1 text-body text-ink-soft">{t("doneHint", { n: correct, total: gradedTotal })}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            size="lg"
            icon={<Icon icon={RotateCcw} size={16} />}
            onClick={() => {
              setI(0);
              setCorrect(0);
              setFinished(false);
            }}
          >
            {t("again")}
          </Button>
          <Button
            variant="ghost"
            size="lg"
            className="rounded-pill"
            icon={<Icon icon={BookText} size={16} />}
            onClick={() => navigate(`/app/topics/${topicId}?view=konspekt`)}
          >
            {t("reread")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[640px]">
      {/* Shapka: orqaga + jarayon */}
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onExit}
          className="inline-flex items-center gap-1.5 rounded-pill px-2 py-1.5 text-note font-semibold text-brand-tint transition-colors hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <Icon icon={ArrowLeft} size={15} />
          {t("back")}
        </button>
        <span className="text-note font-semibold tabular-nums text-ink-soft">
          {i + 1} / {items.length}
        </span>
        <span className="min-w-0 flex-1 truncate text-right text-note font-semibold text-ink-soft">
          {q.data.topicTitle}
        </span>
      </div>
      <div className="mb-4 flex gap-1">
        {items.map((_, n) => (
          <span
            key={n}
            className={cls(
              "h-1.5 flex-1 rounded-pill transition-colors",
              n < i ? "bg-ink" : n === i ? "bg-ink/40" : "bg-ink/10"
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
              <p className="text-micro font-semibold text-violet">{t("kindCard")}</p>
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
        <Button size="lg" onClick={next} disabled={item?.kind !== "card" && !answeredCurrent}>
          {i === items.length - 1 ? t("finish") : t("next")}
          <Icon icon={ArrowRight} size={16} />
        </Button>
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
      <BentoCard bodyClassName="p-4 sm:p-6">
        <PracticePlayer topicId={activeTopic} onExit={() => setActiveTopic(null)} />
      </BentoCard>
    );
  }

  return (
    <div className="space-y-3">
      {/* Virtual bemor amaliyot markazi — sahifaning yagona pastel urg'usi */}
      <BentoCard
        tone="rose"
        title={
          <span className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface/70 text-rose">
              <Icon icon={Stethoscope} size={14} />
            </span>
            {t("patientTitle")}
          </span>
        }
        count={patients.length}
        right={
          patients.length > 1 && (
            <Button size="sm" icon={<Icon icon={Dices} size={14} />} onClick={randomPatient}>
              <span className="hidden sm:inline">{t("randomPatient")}</span>
            </Button>
          )
        }
        isLoading={patientsQ.isLoading}
        isError={patientsQ.isError}
        onRetry={() => patientsQ.refetch()}
        bodyClassName="px-3 pb-3"
      >
        <p className="mb-2 px-1 text-note text-ink-2">{t("patientHint")}</p>
        {patients.length === 0 ? (
          <p className="rounded-control bg-surface/70 px-3 py-3 text-note text-ink-soft">{t("patientEmpty")}</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {patients.map((p) => (
              <button
                key={p.topicId}
                type="button"
                onClick={() => navigate(`/app/topics/${p.topicId}?view=patient`)}
                className="group flex min-w-0 items-center gap-3 rounded-control bg-surface px-3 py-3 text-left transition-colors hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-soft text-rose">
                  <Icon icon={User} size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-body font-semibold text-ink">
                    <span className="truncate">{p.patientName || t("patientDefault")}</span>
                    {p.generated && !p.patientName && (
                      <span className="shrink-0 rounded-pill bg-blue-soft px-1.5 py-0.5 text-micro font-semibold text-blue">
                        {t("patientFromDigest")}
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-micro text-ink-soft">
                    {p.topicTitle} · {p.subjectName}
                  </span>
                </span>
                {p.finished ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-pill border border-emerald/30 px-2 py-0.5 text-micro font-semibold text-emerald">
                    <Icon icon={Check} size={11} strokeWidth={3} />
                    {t("patientAgain")}
                  </span>
                ) : (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line text-ink-soft transition-colors group-hover:border-ink group-hover:bg-ink group-hover:text-surface">
                    <Icon icon={ArrowRight} size={13} />
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </BentoCard>

      {/* Xatolar ustida ishlash */}
      <BentoCard
        title={
          <span className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-soft text-amber">
              <Icon icon={Dumbbell} size={14} />
            </span>
            {t("mistakesTitle")}
          </span>
        }
        count={topics.length}
        isLoading={overviewQ.isLoading}
        isError={overviewQ.isError}
        onRetry={() => overviewQ.refetch()}
        bodyClassName="px-2 pb-2"
      >
        <p className="mb-1 px-2 text-note text-ink-soft">{t("mistakesHint")}</p>
        {topics.length === 0 ? (
          <EmptyState icon={<Icon icon={Sparkles} size={22} />} text={t("noMistakesAll")} hint={t("noMistakesAllHint")} />
        ) : (
          <ul className="divide-y divide-line-soft">
            {topics.map((tp) => (
              <li key={tp.topicId}>
                <button
                  type="button"
                  onClick={() => setActiveTopic(tp.topicId)}
                  className="group flex w-full flex-wrap items-center gap-x-3 gap-y-2 rounded-control px-2 py-3 text-left transition-colors hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <span className="min-w-0 flex-1 basis-40">
                    <span className="block truncate text-body font-semibold text-ink">{tp.topicTitle}</span>
                    <span className="block truncate text-micro text-ink-soft">{tp.subjectName}</span>
                  </span>
                  <span className="flex shrink-0 flex-wrap items-center gap-1.5">
                    {tp.wrongQuiz > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-pill bg-blue-soft px-2 py-0.5 text-micro font-semibold text-blue">
                        <Icon icon={ClipboardList} size={11} />
                        {t("nQuiz", { n: tp.wrongQuiz })}
                      </span>
                    )}
                    {tp.wrongSteps > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-pill bg-rose-soft px-2 py-0.5 text-micro font-semibold text-rose">
                        <Icon icon={Stethoscope} size={11} />
                        {t("nSteps", { n: tp.wrongSteps })}
                      </span>
                    )}
                    {tp.unknownCards > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-pill bg-violet-soft px-2 py-0.5 text-micro font-semibold text-violet">
                        <Icon icon={Sparkles} size={11} />
                        {t("nCards", { n: tp.unknownCards })}
                      </span>
                    )}
                  </span>
                  <span className="inline-flex h-[30px] shrink-0 items-center gap-1.5 rounded-pill bg-ink px-3 text-micro font-semibold text-surface transition-colors group-hover:bg-ink-2">
                    {t("start")}
                    <Icon icon={ArrowRight} size={13} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </BentoCard>
    </div>
  );
}
