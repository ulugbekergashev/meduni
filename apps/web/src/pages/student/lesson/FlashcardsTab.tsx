import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Lock, RotateCcw, Sparkles, X } from "lucide-react";
import { EmptyState, Icon, Spinner, cls } from "@meduni/ui";
import { useFlashcards, useResetFlashcards, useReviewFlashcard, type Flashcard } from "../api";

function Card({ card, flipped, onFlip }: { card: Flashcard; flipped: boolean; onFlip: () => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "lesson" });
  return (
    <button
      onClick={onFlip}
      className="flex min-h-[190px] w-full flex-col items-center justify-center gap-2.5 rounded-card border border-line bg-surface-raised p-5 text-center transition-colors hover:border-brand-soft"
    >
      <span
        className={cls(
          "rounded-pill px-2 py-0.5 text-micro font-extrabold uppercase tracking-wider",
          card.kind === "quiz" ? "bg-blue-soft text-blue" : "bg-violet-soft text-violet"
        )}
      >
        {card.kind === "quiz" ? t("cardFromQuiz") : t("cardFromTerm")}
      </span>

      {!flipped ? (
        <>
          <p className="text-body font-bold leading-snug text-ink">{card.front}</p>
          <p className="text-micro text-ink-dim">{t("cardTapToFlip")}</p>
        </>
      ) : (
        <>
          <p className="text-body font-extrabold leading-snug text-emerald">{card.back}</p>
          {card.note && <p className="text-note leading-relaxed text-ink-soft">{card.note}</p>}
        </>
      )}
    </button>
  );
}

/** 4-bosqich — fleshkartalar (takrorlash). Kartalar test savollari va konspekt
 *  atamalaridan hosil qilinadi; test yakunlanmaguncha yopiq (javob oshkor
 *  bo'lmasligi uchun). */
export function FlashcardsTab({ topicId }: { topicId: number }) {
  const { t } = useTranslation(undefined, { keyPrefix: "lesson" });
  const reduce = useReducedMotion();
  const q = useFlashcards(topicId);
  const review = useReviewFlashcard(topicId);
  const reset = useResetFlashcards(topicId);

  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const data = q.data;
  const cards = data?.cards ?? [];
  const card = cards[i];

  // Karta almashsa — old tomonga qaytariladi.
  useEffect(() => setFlipped(false), [i]);

  // Klaviatura: ← → o'tish, probel — ag'darish.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA)$/.test(el.tagName)) return;
      if (e.key === "ArrowLeft") setI((n) => Math.max(0, n - 1));
      else if (e.key === "ArrowRight") setI((n) => Math.min(cards.length - 1, n + 1));
      else if (e.key === " ") {
        e.preventDefault();
        setFlipped((f) => !f);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cards.length]);

  if (q.isLoading)
    return (
      <div className="flex justify-center py-10">
        <Spinner size={22} />
      </div>
    );

  if (data?.locked)
    return (
      <div className="py-8">
        <EmptyState
          icon={<Icon icon={Lock} size={20} />}
          text={t("flashLockedTitle")}
          hint={t("flashLockedHint")}
        />
      </div>
    );

  if (!card)
    return (
      <div className="py-8">
        <EmptyState icon={<Icon icon={Sparkles} size={20} />} text={t("flashEmpty")} />
      </div>
    );

  const mark = (known: boolean) => {
    review.mutate({ cardKey: card.key, known });
    if (i < cards.length - 1) setI(i + 1);
  };

  const knownCount = cards.filter((c) => c.known === true).length;
  const reviewed = cards.filter((c) => c.known !== null).length;
  const done = reviewed === cards.length;

  return (
    <div className="mx-auto max-w-[520px] space-y-3">
      {/* Jarayon */}
      <div className="flex items-center gap-2">
        <span className="text-micro font-extrabold uppercase tracking-wider text-ink-dim">
          {t("cardOf", { n: i + 1, total: cards.length })}
        </span>
        <span className="text-micro font-bold tabular-nums text-emerald">
          {t("cardKnownN", { n: knownCount })}
        </span>
        <button
          onClick={() => {
            reset.mutate();
            setI(0);
          }}
          className="ml-auto inline-flex items-center gap-1 rounded-control border border-line px-2 py-1 text-micro font-bold text-ink-soft transition-colors hover:bg-surface-raised hover:text-ink"
        >
          <Icon icon={RotateCcw} size={11} />
          {t("cardReset")}
        </button>
      </div>

      <div className="flex gap-1">
        {cards.map((c, n) => (
          <button
            key={c.key}
            onClick={() => setI(n)}
            className={cls(
              "h-1 flex-1 rounded-pill transition-colors",
              c.known === true ? "bg-emerald" : c.known === false ? "bg-rose" : n === i ? "bg-brand" : "bg-line"
            )}
          />
        ))}
      </div>

      {/* Karta */}
      <AnimatePresence mode="wait">
        <motion.div
          key={card.key + (flipped ? "-b" : "-f")}
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          <Card card={card} flipped={flipped} onFlip={() => setFlipped((f) => !f)} />
        </motion.div>
      </AnimatePresence>

      {/* Baholash */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setI(Math.max(0, i - 1))}
          disabled={i === 0}
          className="inline-flex items-center gap-1.5 rounded-control border border-line px-3 py-1.5 text-note font-bold text-ink-soft transition-colors hover:bg-surface-raised hover:text-ink disabled:opacity-30"
        >
          <Icon icon={ArrowLeft} size={14} />
        </button>

        <button
          onClick={() => mark(false)}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-control border border-rose px-3 py-1.5 text-note font-bold text-rose transition-colors hover:bg-rose-soft"
        >
          <Icon icon={X} size={14} strokeWidth={3} />
          {t("cardDontKnow")}
        </button>
        <button
          onClick={() => mark(true)}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-control bg-emerald px-3 py-1.5 text-note font-extrabold text-white transition-opacity hover:opacity-90"
        >
          <Icon icon={Check} size={14} strokeWidth={3} />
          {t("cardKnow")}
        </button>

        <button
          onClick={() => setI(Math.min(cards.length - 1, i + 1))}
          disabled={i === cards.length - 1}
          className="inline-flex items-center gap-1.5 rounded-control border border-line px-3 py-1.5 text-note font-bold text-ink-soft transition-colors hover:bg-surface-raised hover:text-ink disabled:opacity-30"
        >
          <Icon icon={ArrowRight} size={14} />
        </button>
      </div>

      {done && (
        <p className="rounded-control border-l-2 border-emerald bg-emerald-soft px-3 py-2 text-note font-bold text-emerald">
          {t("cardAllReviewed", { n: knownCount, total: cards.length })}
        </p>
      )}
    </div>
  );
}
