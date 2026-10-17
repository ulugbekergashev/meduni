import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CalendarClock, Check, CheckCircle2, Repeat, X } from "lucide-react";
import { Button, EmptyState, Icon, ProgressRing, cls } from "@meduni/ui";
import { BentoCard, BentoRow, MetricTile } from "../../../components/bento";
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
  const { t } = useTranslation(undefined, { keyPrefix: "reviewTab" });
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
          <span className="text-note font-semibold tabular-nums text-ink-soft">
            {tl("cardOf", { n: i + 1, total: cards.length })}
          </span>
          <span className="inline-flex min-w-0 items-center gap-1.5 rounded-pill bg-brand-soft px-2.5 py-0.5 text-note font-semibold text-brand-deep">
            <span className="truncate">{card.topicTitle}</span>
            <span className="shrink-0 text-ink-soft">· {card.subjectName}</span>
          </span>
        </div>
        <div className="flex gap-1">
          {cards.map((c, n) => (
            <span
              // ⚠️ `c.key` faqat MAVZU ichida noyob ("t:0" har mavzuda bor) —
              // kross-mavzu sessiyada takrorlanardi (React "two children with
              // the same key"). Kartaning o'zi (pastda) allaqachon to'g'ri
              // qilgan: topicId bilan birga.
              key={`${c.topicId}:${c.key}`}
              className={cls(
                "h-1.5 flex-1 rounded-pill transition-colors",
                n < i ? "bg-ink" : n === i ? "bg-ink/40" : "bg-ink/10"
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
            type="button"
            onClick={() => answer(false)}
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-pill border border-rose/40 text-body font-semibold text-rose transition-colors hover:bg-rose-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <Icon icon={X} size={18} strokeWidth={3} />
            {tl("cardDontKnow")}
          </button>
          <Button
            size="lg"
            onClick={() => answer(true)}
            className="h-12 flex-1"
            icon={<Icon icon={Check} size={18} strokeWidth={3} />}
          >
            {tl("cardKnow")}
          </Button>
        </div>
        <p className="text-center text-micro text-ink-soft">{t("kbHint")}</p>
      </div>
    </div>
  );
}

/** O'zlashtirish → Takrorlash tabi: hero + sessiya + kelgusi jadval. */
export function ReviewTab() {
  const { t } = useTranslation(undefined, { keyPrefix: "reviewTab" });
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
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-3">
        {/* STAT DIETASI: bitta ko'rsatkich ("bugun takrorlash kerak") + xulosa
            qatori izohda — asosiy amal kartani takrorlash. */}
        <MetricTile
          size="stat"
          tone={stats && stats.dueNow > 0 ? "brand" : "plain"}
          label={t("statDue")}
          value={stats?.dueNow ?? null}
          sub={t("summaryLine", {
            today: stats?.reviewedToday ?? 0,
            known: stats?.knownPct ?? 0,
            next: stats?.nextDueAt ? fmt(stats.nextDueAt) : "—",
          })}
        />

        {/* Sessiya / natija / bo'sh holat */}
        <BentoCard
          isLoading={sessionQ.isLoading}
          isError={sessionQ.isError}
          onRetry={() => sessionQ.refetch()}
          bodyClassName="p-4 sm:p-6"
        >
          {result ? (
            <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-6 text-center">
              <ProgressRing
                value={result.total ? Math.round((result.known / result.total) * 100) : 0}
                size={120}
                stroke={12}
                tone="emerald"
              />
              <div>
                <p className="text-section font-semibold text-ink">{t("sessionDoneTitle")}</p>
                <p className="mt-1 text-body text-ink-soft">
                  {t("sessionDoneHint", { n: result.known, total: result.total })}
                </p>
              </div>
              <Button size="lg" onClick={restart} icon={<Icon icon={Repeat} size={16} />}>
                {t("checkMore")}
              </Button>
            </div>
          ) : cards.length > 0 ? (
            <SessionPlayer key={cards.map((c) => `${c.topicId}:${c.key}`).join("|")} cards={cards} onDone={finish} />
          ) : (
            <EmptyState
              icon={<Icon icon={CheckCircle2} size={24} />}
              text={t("emptyTitle")}
              hint={stats?.nextDueAt ? t("emptyNext", { date: fmt(stats.nextDueAt) }) : t("emptyNoUpcoming")}
            />
          )}
        </BentoCard>
      </div>

      {/* O'ng ustun — kelgusi takrorlar jadvali */}
      <aside className="min-w-0 space-y-3">
        <BentoCard
          title={t("upcomingTitle")}
          isLoading={statsQ.isLoading}
          isError={statsQ.isError}
          onRetry={() => statsQ.refetch()}
          bodyClassName="px-2 pb-2"
        >
          {(stats?.upcoming ?? []).length === 0 ? (
            <p className="px-2 py-3 text-note text-ink-soft">{t("upcomingEmpty")}</p>
          ) : (
            <ul>
              {stats!.upcoming.slice(0, 8).map((u) => (
                <li key={u.topicId}>
                  <BentoRow
                    icon={CalendarClock}
                    iconTone="bg-violet-soft text-violet"
                    title={u.topicTitle}
                    sub={`${u.subjectName} · ${fmt(u.nextDueAt)}`}
                    right={u.count}
                    onClick={() => navigate(`/app/topics/${u.topicId}?view=flashcards`)}
                  />
                </li>
              ))}
            </ul>
          )}
        </BentoCard>
      </aside>
    </div>
  );
}
