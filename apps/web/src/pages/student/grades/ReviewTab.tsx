import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CalendarClock, Check, CheckCircle2, Repeat, Sparkles, X } from "lucide-react";
import { Card, EmptyState, Icon, ProgressRing, Spinner, cls } from "@meduni/ui";
import { HeroTile, RailCard } from "../../../components/HeroStats";
import { formatDate } from "../../../lib/date";
import { useLocale } from "../../../lib/useLocale";
import { CardFace } from "../lesson/FlashcardsTab";
import {
  useReviewSession,
  useReviewSessionMark,
  useReviewStats,
  type ReviewSessionCard,
} from "../api";

/** Kross-mavzu takrorlash pleyeri — sessiya kartalari tugaguncha yuradi. */
function SessionPlayer({ cards, onDone }: { cards: ReviewSessionCard[]; onDone: (known: number) => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "review" });
  const { t: tl } = useTranslation(undefined, { keyPrefix: "lesson" });
  const reduce = useReducedMotion();
  const mark = useReviewSessionMark();

  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [knownCount, setKnownCount] = useState(0);
  const card = cards[i];

  useEffect(() => setFlipped(false), [i]);

  const answer = (known: boolean) => {
    if (!card) return;
    mark.mutate({ topicId: card.topicId, cardKey: card.key, known });
    if (known) setKnownCount((k) => k + 1);
    if (i < cards.length - 1) setI(i + 1);
    else onDone(knownCount + (known ? 1 : 0));
  };

  // Klaviatura: probel ag'darish, 1 bilmayman, 2 bilaman.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA)$/.test(el.tagName)) return;
      if (e.key === " ") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === "1") answer(false);
      else if (e.key === "2") answer(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, card, knownCount]);

  if (!card) return null;

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4">
      {/* Jarayon + mavzu konteksti */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-note font-extrabold uppercase tracking-wider text-ink-dim">
            {tl("cardOf", { n: i + 1, total: cards.length })}
          </span>
          <span className="inline-flex min-w-0 items-center gap-1.5 rounded-pill bg-brand-soft px-2.5 py-0.5 text-note font-bold text-brand-tint">
            <span className="truncate">{card.topicTitle}</span>
            <span className="shrink-0 text-ink-dim">· {card.subjectName}</span>
          </span>
        </div>
        <div className="flex gap-1">
          {cards.map((c, n) => (
            <span
              key={c.key}
              className={cls(
                "h-1.5 flex-1 rounded-pill transition-colors",
                n < i ? "bg-emerald" : n === i ? "bg-brand" : "bg-line-raised"
              )}
            />
          ))}
        </div>
      </div>

      {/* Karta */}
      <div className="flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${card.topicId}:${card.key}`}
            initial={reduce ? false : { opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? undefined : { opacity: 0, x: -28 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="w-full"
          >
            <CardFace card={card} flipped={flipped} onFlip={() => setFlipped((f) => !f)} />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Baholash */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => answer(false)}
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-control border border-rose text-body font-bold text-rose transition-colors hover:bg-rose-soft"
          >
            <Icon icon={X} size={18} strokeWidth={3} />
            {tl("cardDontKnow")}
          </button>
          <button
            onClick={() => answer(true)}
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-control bg-emerald text-body font-extrabold text-white transition-opacity hover:opacity-90"
          >
            <Icon icon={Check} size={18} strokeWidth={3} />
            {tl("cardKnow")}
          </button>
        </div>
        <p className="text-center text-micro text-ink-dim">{t("kbHint")}</p>
      </div>
    </div>
  );
}

/** O'zlashtirish → Takrorlash tabi: hero + sessiya + kelgusi jadval. */
export function ReviewTab() {
  const { t } = useTranslation(undefined, { keyPrefix: "review" });
  const locale = useLocale();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const topicFilter = params.get("topic") ? Number(params.get("topic")) : null;

  const statsQ = useReviewStats();
  const sessionQ = useReviewSession(topicFilter);
  const [result, setResult] = useState<{ known: number; total: number } | null>(null);

  const stats = statsQ.data;
  const cards = useMemo(() => sessionQ.data?.cards ?? [], [sessionQ.data]);
  const fmt = (iso: string) => formatDate(locale === "ru" ? "ru" : "uz", iso, "short");

  const finish = (known: number) => setResult({ known, total: cards.length });
  const restart = () => {
    setResult(null);
    sessionQ.refetch();
    statsQ.refetch();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-4">
        {/* Hero ko'rsatkichlari */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <HeroTile
            icon={Repeat}
            value={String(stats?.dueNow ?? "—")}
            label={t("statDue")}
            tone={stats && stats.dueNow > 0 ? "bg-brand-soft text-brand-tint" : "bg-surface text-ink-faint"}
          />
          <HeroTile
            icon={CheckCircle2}
            value={String(stats?.reviewedToday ?? "—")}
            label={t("statToday")}
            tone="bg-emerald-soft text-emerald"
          />
          <HeroTile
            icon={Sparkles}
            value={stats?.knownPct !== null && stats !== undefined ? `${stats.knownPct}%` : "—"}
            label={t("statKnown")}
            tone="bg-violet-soft text-violet"
          />
          <HeroTile
            icon={CalendarClock}
            value={stats?.nextDueAt ? fmt(stats.nextDueAt) : "—"}
            label={t("statNext")}
            tone="bg-blue-soft text-blue"
          />
        </div>

        {/* Sessiya / natija / bo'sh holat */}
        <Card className="p-5 sm:p-6">
          {sessionQ.isLoading ? (
            <div className="flex justify-center py-12">
              <Spinner size={24} />
            </div>
          ) : result ? (
            <div className="mx-auto flex max-w-[440px] flex-col items-center gap-4 py-6 text-center">
              <ProgressRing
                value={result.total ? Math.round((result.known / result.total) * 100) : 0}
                size={120}
                stroke={12}
                tone="emerald"
              />
              <div>
                <p className="text-section font-extrabold text-ink">{t("sessionDoneTitle")}</p>
                <p className="mt-1 text-body text-ink-soft">
                  {t("sessionDoneHint", { n: result.known, total: result.total })}
                </p>
              </div>
              <button
                onClick={restart}
                className="inline-flex items-center gap-2 rounded-control border border-line px-5 py-2.5 text-body font-bold text-ink-soft transition-colors hover:bg-surface-raised hover:text-ink"
              >
                <Icon icon={Repeat} size={16} />
                {t("checkMore")}
              </button>
            </div>
          ) : cards.length > 0 ? (
            <SessionPlayer key={cards.map((c) => c.key).join("|")} cards={cards} onDone={finish} />
          ) : (
            <div className="py-6">
              <EmptyState
                icon={<Icon icon={CheckCircle2} size={24} />}
                text={t("emptyTitle")}
                hint={
                  stats?.nextDueAt
                    ? t("emptyNext", { date: fmt(stats.nextDueAt) })
                    : t("emptyNoUpcoming")
                }
              />
            </div>
          )}
        </Card>
      </div>

      {/* O'ng ustun — kelgusi takrorlar jadvali */}
      <aside className="min-w-0 space-y-4">
        <RailCard title={t("upcomingTitle")} icon={CalendarClock}>
          {(stats?.upcoming ?? []).length === 0 ? (
            <p className="px-4 py-4 text-note text-ink-faint">{t("upcomingEmpty")}</p>
          ) : (
            <div className="divide-y divide-line">
              {stats!.upcoming.slice(0, 8).map((u) => (
                <button
                  key={u.topicId}
                  onClick={() => navigate(`/app/topics/${u.topicId}?view=flashcards`)}
                  className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-raised"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body font-semibold text-ink">{u.topicTitle}</p>
                    <p className="truncate text-note text-ink-faint">{u.subjectName}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-body font-bold tabular-nums text-ink">{u.count}</p>
                    <p className="text-micro tabular-nums text-ink-faint">{fmt(u.nextDueAt)}</p>
                  </div>
                  <Icon
                    icon={ArrowRight}
                    size={15}
                    className="shrink-0 text-ink-dim transition-transform group-hover:translate-x-0.5"
                  />
                </button>
              ))}
            </div>
          )}
        </RailCard>
      </aside>
    </div>
  );
}
