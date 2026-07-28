import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  FlaskConical,
  Languages,
  Lightbulb,
  Lock,
  Pill,
  RotateCcw,
  RotateCw,
  Sparkles,
  Stethoscope,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { EmptyState, Icon, ProgressRing, Spinner, cls } from "@meduni/ui";
import { useFlashcards, useResetFlashcards, useReviewFlashcard, type Flashcard, type FlashcardKind } from "../api";

// 2026-07-28 (buyurtmachi: "flashcardlar chiroyliroq, keyin ko'proq bo'lishi
// kerak"). Ikki o'zgarish:
//   · MANBA — kartalar endi faqat test+atamalardan emas: tushuncha, fakt (cloze),
//     doza, checkpoint va keys qadamlaridan ham (backend `me/flashcards.ts`).
//   · YUZA — yakka karta o'rniga DASTA (deck): orqada turgan kartalar ko'rinadi,
//     yuqoridagisi suriladi (chapga = bilmayman, o'ngga = bilaman) va 3D ag'dariladi.

interface KindStyle {
  icon: LucideIcon;
  /** Badge (chip) ranglari. */
  chip: string;
  /** Kartaning yuqori chekka aksenti. */
  edge: string;
}

const KIND: Record<FlashcardKind, KindStyle> = {
  // Dizayn tizimidagi semantik ranglar: test=blue, keys=rose, kurs=brand,
  // video/tushuncha=violet, ogohlantirish/doza=amber, muvaffaqiyat=emerald.
  term: { icon: Languages, chip: "bg-brand-soft text-brand-tint", edge: "from-brand to-violet" },
  termRev: { icon: Languages, chip: "bg-brand-soft text-brand-tint", edge: "from-violet to-brand" },
  concept: { icon: Lightbulb, chip: "bg-violet-soft text-violet", edge: "from-violet to-brand" },
  fact: { icon: BookOpen, chip: "bg-surface-raised text-ink-soft", edge: "from-ink-faint to-line" },
  dose: { icon: Pill, chip: "bg-amber-soft text-amber", edge: "from-amber to-rose" },
  check: { icon: FlaskConical, chip: "bg-emerald-soft text-emerald", edge: "from-emerald to-blue" },
  case: { icon: Stethoscope, chip: "bg-rose-soft text-rose", edge: "from-rose to-amber" },
  quiz: { icon: Sparkles, chip: "bg-blue-soft text-blue", edge: "from-blue to-brand" },
};

function KindBadge({ kind }: { kind: FlashcardKind }) {
  const { t } = useTranslation(undefined, { keyPrefix: "lesson" });
  const st = KIND[kind] ?? KIND.term;
  return (
    <span
      className={cls(
        "inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-micro font-extrabold uppercase tracking-wider",
        st.chip
      )}
    >
      <Icon icon={st.icon} size={12} />
      {t(`cardKind_${kind}`)}
    </span>
  );
}

/** Karta yuzasi — yuqorida yorliq, o'rtada javob/savol (bo'sh joyni to'ldiradi),
 *  pastda maslahat. Ilgari hammasi markazga yig'ilib, ustki va ostki qismi
 *  bo'm-bo'sh qolardi. */
const FACE =
  "absolute inset-0 flex flex-col items-center overflow-hidden rounded-card border border-line bg-gradient-to-br from-surface to-surface-raised px-6 py-5 text-center shadow-card [backface-visibility:hidden]";

/** Katta fleshkarta — haqiqiy 3D ag'darish; balandlikni to'ldiradi.
 *  Takrorlash sessiyasi (O'zlashtirish tabi) va mashg'ulotlar ham shu yuzani
 *  ishlatadi — imzo o'zgarmaydi. */
export function CardFace({ card, flipped, onFlip }: { card: Flashcard; flipped: boolean; onFlip: () => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "lesson" });
  const reduce = useReducedMotion();
  const st = KIND[card.kind] ?? KIND.term;
  /** Uzun savol kichikroq shriftda — karta ichida sig'sin. */
  const frontSize = card.front.length > 150 ? "text-[19px]" : card.front.length > 80 ? "text-[22px]" : "text-[27px]";
  const backSize = card.back.length > 120 ? "text-[19px]" : card.back.length > 60 ? "text-[22px]" : "text-[27px]";

  return (
    <button
      onClick={onFlip}
      aria-label={t("cardTapToFlip")}
      className="block h-full max-h-[340px] min-h-[240px] w-full [perspective:1600px] focus-visible:outline-none"
    >
      <motion.div
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 240, damping: 26 }}
        className="relative h-full w-full [transform-style:preserve-3d]"
      >
        {/* Old (savol) */}
        <div className={FACE}>
          <span className={cls("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", st.edge)} aria-hidden />
          <KindBadge kind={card.kind} />
          <div className="flex min-h-0 w-full flex-1 items-center justify-center overflow-y-auto py-4">
            <p className={cls("font-bold leading-snug text-ink", frontSize)}>{card.front}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-note text-ink-dim">
            <Icon icon={RotateCw} size={15} />
            {t("cardFlipHint")}
          </span>
        </div>

        {/* Orqa (javob) */}
        <div className={cls(FACE, "[transform:rotateY(180deg)]")}>
          <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald to-blue" aria-hidden />
          <span className="rounded-pill bg-emerald-soft px-3 py-1 text-micro font-extrabold uppercase tracking-wider text-emerald">
            {t("cardAnswer")}
          </span>
          <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-3 overflow-y-auto py-4">
            <p className={cls("font-extrabold leading-snug text-emerald", backSize)}>{card.back}</p>
            {card.note && (
              <p className="max-w-[52ch] rounded-control bg-surface px-3 py-2 text-note leading-relaxed text-ink-soft">
                {card.note}
              </p>
            )}
          </div>
          {/* Savolni eslatib turadi — javobni kontekstsiz o'qish foydasiz. */}
          <span className="line-clamp-1 max-w-full text-micro text-ink-faint">{card.front}</span>
        </div>
      </motion.div>
    </button>
  );
}

/** Dasta — yuqoridagi karta suriladi (drag), orqada ikkitasi ko'rinib turadi. */
function Deck({
  card,
  behind,
  flipped,
  onFlip,
  onMark,
}: {
  card: Flashcard;
  behind: number;
  flipped: boolean;
  onFlip: () => void;
  onMark: (known: boolean) => void;
}) {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-260, 260], [-9, 9]);
  const knowOpacity = useTransform(x, [40, 150], [0, 1]);
  const dontOpacity = useTransform(x, [-150, -40], [1, 0]);

  return (
    <div className="relative h-full w-full">
      {/* Orqadagi kartalar — dasta chuqurligi hissi (faqat bezak) */}
      {Array.from({ length: Math.min(2, behind) }).map((_, i) => (
        <div
          key={i}
          aria-hidden
          className="absolute inset-0 rounded-card border border-line bg-surface-raised shadow-card"
          style={{
            transform: `translateY(${(i + 1) * 10}px) scale(${1 - (i + 1) * 0.035})`,
            opacity: 0.55 - i * 0.2,
          }}
        />
      ))}

      <motion.div
        drag={reduce ? false : "x"}
        style={reduce ? undefined : { x, rotate }}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.55}
        onDragEnd={(_, info) => {
          if (info.offset.x > 130) onMark(true);
          else if (info.offset.x < -130) onMark(false);
        }}
        className="relative h-full w-full cursor-grab active:cursor-grabbing"
      >
        <CardFace card={card} flipped={flipped} onFlip={onFlip} />

        {/* Surish paytidagi niyat belgisi */}
        {!reduce && (
          <>
            <motion.span
              style={{ opacity: knowOpacity }}
              className="pointer-events-none absolute left-4 top-4 rounded-control border-2 border-emerald px-3 py-1 text-note font-extrabold uppercase tracking-wider text-emerald"
            >
              ✓
            </motion.span>
            <motion.span
              style={{ opacity: dontOpacity }}
              className="pointer-events-none absolute right-4 top-4 rounded-control border-2 border-rose px-3 py-1 text-note font-extrabold uppercase tracking-wider text-rose"
            >
              ✕
            </motion.span>
          </>
        )}
      </motion.div>
    </div>
  );
}

/** O'rganish raili bloki — fleshkartalar (takrorlash). Kartalar konspekt va
 *  test/keysdan hosil qilinadi; test savollari faqat urinish yakunlangach. */
export function FlashcardsTab({ topicId }: { topicId: number }) {
  const { t } = useTranslation(undefined, { keyPrefix: "lesson" });
  const q = useFlashcards(topicId);
  const review = useReviewFlashcard(topicId);
  const reset = useResetFlashcards(topicId);

  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [keepReviewing, setKeepReviewing] = useState(false);
  /** Tur bo'yicha filtr (null — hammasi). */
  const [kind, setKind] = useState<FlashcardKind | null>(null);

  const data = q.data;
  const all = useMemo(() => data?.cards ?? [], [data]);
  const kinds = useMemo(() => {
    const seen: FlashcardKind[] = [];
    for (const c of all) if (!seen.includes(c.kind)) seen.push(c.kind);
    return seen;
  }, [all]);
  const cards = useMemo(() => (kind ? all.filter((c) => c.kind === kind) : all), [all, kind]);
  const card = cards[i];

  useEffect(() => setFlipped(false), [i, kind]);
  useEffect(() => {
    setI(0);
    setKeepReviewing(false);
  }, [kind]);

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
        <EmptyState
          icon={<Icon icon={data.reason === "quiz_not_finished" ? Lock : Sparkles} size={22} />}
          text={data.reason === "quiz_not_finished" ? t("flashLockedTitle") : t("flashEmpty")}
          hint={data.reason === "quiz_not_finished" ? t("flashLockedHint") : undefined}
        />
      </div>
    );

  if (all.length === 0)
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

  const pendingNote =
    data?.quizLocked && data.pendingQuiz ? t("cardPendingQuiz", { n: data.pendingQuiz }) : null;

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
        {pendingNote && <p className="text-note text-amber">{pendingNote}</p>}
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[660px] flex-col gap-3">
      {/* Jarayon + tur filtri */}
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

        {kinds.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setKind(null)}
              className={cls(
                "rounded-pill border px-2.5 py-1 text-micro font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                kind === null ? "border-brand bg-brand-soft text-brand-tint" : "border-line text-ink-soft hover:border-brand"
              )}
            >
              {t("cardFilterAll")} · {all.length}
            </button>
            {kinds.map((k) => {
              const n = all.filter((c) => c.kind === k).length;
              const on = kind === k;
              return (
                <button
                  key={k}
                  onClick={() => setKind(on ? null : k)}
                  className={cls(
                    "inline-flex items-center gap-1 rounded-pill border px-2.5 py-1 text-micro font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                    on ? "border-brand bg-brand-soft text-brand-tint" : "border-line text-ink-soft hover:border-brand"
                  )}
                >
                  <Icon icon={KIND[k].icon} size={11} />
                  {t(`cardKind_${k}`)} · {n}
                </button>
              );
            })}
          </div>
        )}

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

      {/* Dasta — balandlikni to'ldiradi */}
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={card.key}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="flex h-full max-h-[350px] w-full items-center justify-center"
          >
            <Deck
              card={card}
              behind={cards.length - 1 - i}
              flipped={flipped}
              onFlip={() => setFlipped((f) => !f)}
              onMark={mark}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Baholash */}
      <div className="shrink-0 space-y-1.5">
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
        <p className="text-center text-micro text-ink-dim">{t("cardSwipeHint")}</p>
        {pendingNote && <p className="text-center text-micro font-bold text-amber">{pendingNote}</p>}
      </div>
    </div>
  );
}
