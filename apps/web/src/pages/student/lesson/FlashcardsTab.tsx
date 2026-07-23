import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Lock, RotateCcw, RotateCw, Sparkles, X } from "lucide-react";
import { EmptyState, Icon, ProgressRing, Spinner, cls } from "@meduni/ui";
import { useFlashcards, useResetFlashcards, useReviewFlashcard, type Flashcard } from "../api";

const FACE =
  "absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-card border border-line bg-surface-raised p-8 text-center shadow-card [backface-visibility:hidden]";

function KindBadge({ kind }: { kind: Flashcard["kind"] }) {
  const { t } = useTranslation(undefined, { keyPrefix: "lesson" });
  return (
    <span
      className={cls(
        "rounded-pill px-3 py-1 text-micro font-extrabold uppercase tracking-wider",
        kind === "quiz" ? "bg-blue-soft text-blue" : "bg-violet-soft text-violet"
      )}
    >
      {kind === "quiz" ? t("cardFromQuiz") : t("cardFromTerm")}
    </span>
  );
}

/** Katta fleshkarta — haqiqiy 3D ag'darish; balandlikni to'ldiradi.
 *  Takrorlash sessiyasi (O'zlashtirish tabi) ham shu yuzani ishlatadi. */
export function CardFace({ card, flipped, onFlip }: { card: Flashcard; flipped: boolean; onFlip: () => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "lesson" });
  const reduce = useReducedMotion();

  return (
    <button
      onClick={onFlip}
      aria-label={t("cardTapToFlip")}
      className="block h-full max-h-[440px] min-h-[280px] w-full [perspective:1600px] focus-visible:outline-none"
    >
      <motion.div
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 240, damping: 26 }}
        className="relative h-full w-full [transform-style:preserve-3d]"
      >
        {/* Old (savol) */}
        <div className={FACE}>
          <KindBadge kind={card.kind} />
          <p className="text-[26px] font-bold leading-snug text-ink">{card.front}</p>
          <span className="mt-1 inline-flex items-center gap-1.5 text-note text-ink-dim">
            <Icon icon={RotateCw} size={15} />
            {t("cardFlipHint")}
          </span>
        </div>
        {/* Orqa (javob) */}
        <div className={cls(FACE, "[transform:rotateY(180deg)]")}>
          <span className="rounded-pill bg-emerald-soft px-3 py-1 text-micro font-extrabold uppercase tracking-wider text-emerald">
            {t("cardAnswer")}
          </span>
          <p className="text-[26px] font-extrabold leading-snug text-emerald">{card.back}</p>
          {card.note && <p className="max-w-[46ch] text-body leading-relaxed text-ink-soft">{card.note}</p>}
        </div>
      </motion.div>
    </button>
  );
}

/** 4-bosqich — fleshkartalar (takrorlash). Kartalar test savollari va konspekt
 *  atamalaridan hosil qilinadi; test yakunlanmaguncha yopiq. */
export function FlashcardsTab({ topicId }: { topicId: number }) {
  const { t } = useTranslation(undefined, { keyPrefix: "lesson" });
  const reduce = useReducedMotion();
  const q = useFlashcards(topicId);
  const review = useReviewFlashcard(topicId);
  const reset = useResetFlashcards(topicId);

  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [keepReviewing, setKeepReviewing] = useState(false);

  const data = q.data;
  const cards = data?.cards ?? [];
  const card = cards[i];

  useEffect(() => setFlipped(false), [i]);

  const knownCount = cards.filter((c) => c.known === true).length;
  const reviewed = cards.filter((c) => c.known !== null).length;
  const allDone = cards.length > 0 && reviewed === cards.length;

  const mark = (known: boolean) => {
    if (!card) return;
    review.mutate({ cardKey: card.key, known });
    if (i < cards.length - 1) setI(i + 1);
  };

  // Klaviatura: ← → o'tish, probel — ag'darish, 1 bilmayman, 2 bilaman.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA)$/.test(el.tagName)) return;
      if (e.key === "ArrowLeft") setI((n) => Math.max(0, n - 1));
      else if (e.key === "ArrowRight") setI((n) => Math.min(cards.length - 1, n + 1));
      else if (e.key === " ") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === "1") mark(false);
      else if (e.key === "2") mark(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards.length, i, card]);

  if (q.isLoading)
    return (
      <div className="flex h-full items-center justify-center py-10">
        <Spinner size={24} />
      </div>
    );

  if (data?.locked)
    return (
      <div className="py-8">
        <EmptyState icon={<Icon icon={Lock} size={22} />} text={t("flashLockedTitle")} hint={t("flashLockedHint")} />
      </div>
    );

  if (!card)
    return (
      <div className="py-8">
        <EmptyState icon={<Icon icon={Sparkles} size={22} />} text={t("flashEmpty")} />
      </div>
    );

  const resetAll = () => {
    reset.mutate();
    setI(0);
    setKeepReviewing(false);
  };

  // ---- Yakuniy natija ----
  if (allDone && !keepReviewing) {
    const pct = Math.round((knownCount / cards.length) * 100);
    const firstUnknown = cards.findIndex((c) => c.known === false);
    return (
      <div className="mx-auto flex h-full max-w-[520px] flex-col items-center justify-center gap-4 py-8 text-center">
        <ProgressRing value={pct} size={128} stroke={12} tone={pct >= 70 ? "emerald" : pct >= 40 ? "amber" : "rose"} />
        <div>
          <p className="text-section font-extrabold text-ink">{t("cardDoneTitle")}</p>
          <p className="mt-1 text-body text-ink-soft">{t("cardDoneHint", { n: knownCount, total: cards.length })}</p>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {firstUnknown >= 0 && (
            <button
              onClick={() => {
                setI(firstUnknown);
                setKeepReviewing(true);
              }}
              className="inline-flex items-center gap-2 rounded-control bg-brand px-5 py-2.5 text-body font-bold text-white transition-colors hover:bg-brand-deep"
            >
              <Icon icon={RotateCw} size={16} />
              {t("cardReviewUnknown")}
            </button>
          )}
          <button
            onClick={resetAll}
            className="inline-flex items-center gap-2 rounded-control border border-line px-5 py-2.5 text-body font-bold text-ink-soft transition-colors hover:bg-surface-raised hover:text-ink"
          >
            <Icon icon={RotateCcw} size={16} />
            {t("cardReset")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[640px] flex-col gap-4">
      {/* Jarayon */}
      <div className="shrink-0 space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-note font-extrabold uppercase tracking-wider text-ink-dim">
            {t("cardOf", { n: i + 1, total: cards.length })}
          </span>
          <span className="inline-flex items-center gap-1 text-note font-bold tabular-nums text-emerald">
            <Icon icon={Check} size={14} strokeWidth={3} />
            {t("cardKnownN", { n: knownCount })}
          </span>
          <button
            onClick={resetAll}
            className="ml-auto inline-flex items-center gap-1.5 rounded-control border border-line px-2.5 py-1.5 text-note font-bold text-ink-soft transition-colors hover:bg-surface-raised hover:text-ink"
          >
            <Icon icon={RotateCcw} size={13} />
            {t("cardReset")}
          </button>
        </div>
        <div className="flex gap-1">
          {cards.map((c, n) => (
            <button
              key={c.key}
              onClick={() => setI(n)}
              aria-label={`${n + 1}`}
              className={cls(
                "h-1.5 flex-1 rounded-pill transition-colors",
                c.known === true ? "bg-emerald" : c.known === false ? "bg-rose" : n === i ? "bg-brand" : "bg-line-raised"
              )}
            />
          ))}
        </div>
      </div>

      {/* Karta — balandlikni to'ldiradi, markazda */}
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={card.key}
            initial={reduce ? false : { opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? undefined : { opacity: 0, x: -28 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex h-full w-full items-center justify-center"
          >
            <CardFace card={card} flipped={flipped} onFlip={() => setFlipped((f) => !f)} />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Baholash */}
      <div className="shrink-0 space-y-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setI(Math.max(0, i - 1))}
            disabled={i === 0}
            aria-label="prev"
            className="inline-flex h-11 items-center justify-center rounded-control border border-line px-3 text-ink-soft transition-colors hover:bg-surface-raised hover:text-ink disabled:opacity-30"
          >
            <Icon icon={ArrowLeft} size={17} />
          </button>
          <button
            onClick={() => mark(false)}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-control border border-rose text-body font-bold text-rose transition-colors hover:bg-rose-soft"
          >
            <Icon icon={X} size={17} strokeWidth={3} />
            {t("cardDontKnow")}
          </button>
          <button
            onClick={() => mark(true)}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-control bg-emerald text-body font-extrabold text-white transition-opacity hover:opacity-90"
          >
            <Icon icon={Check} size={17} strokeWidth={3} />
            {t("cardKnow")}
          </button>
          <button
            onClick={() => setI(Math.min(cards.length - 1, i + 1))}
            disabled={i === cards.length - 1}
            aria-label="next"
            className="inline-flex h-11 items-center justify-center rounded-control border border-line px-3 text-ink-soft transition-colors hover:bg-surface-raised hover:text-ink disabled:opacity-30"
          >
            <Icon icon={ArrowRight} size={17} />
          </button>
        </div>
        <p className="text-center text-micro text-ink-dim">{t("cardKbHint")}</p>
      </div>
    </div>
  );
}
