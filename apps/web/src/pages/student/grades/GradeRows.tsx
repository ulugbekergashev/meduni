import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, ChevronDown, ClipboardList, MessageSquareQuote, Stethoscope } from "lucide-react";
import { Icon, cls } from "@meduni/ui";
import { BentoCard } from "../../../components/bento";
import { formatDate } from "../../../lib/date";
import { useLocale } from "../../../lib/useLocale";
import { Line } from "../parts/bento";
import type { GradeCase, GradeQuiz, GradesCourse } from "../api";

export type GradeFilter = "all" | "quiz" | "case";

export function scoreTone(pct: number) {
  if (pct >= 85) return "text-emerald";
  if (pct >= 70) return "text-blue";
  if (pct >= 60) return "text-amber";
  return "text-rose";
}

/**
 * Test qatori. ⚠️ Mobil 390 da ilgari sarlavha "Yurak anatom…" gacha
 * qisilib, izoh 3 qatorga yoyilardi: endi izoh BITTA qator (truncate),
 * o'tish balli esa ochilgan tarixga ko'chdi — qatorda faqat kerakli fakt.
 */
function QuizRow({ q, onOpen }: { q: GradeQuiz; onOpen: () => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "grades" });
  const locale = useLocale();
  const lang = locale === "ru" ? "ru" : "uz";
  const [open, setOpen] = useState(false);

  return (
    <li className="rounded-control">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="group flex w-full min-w-0 items-center gap-3 rounded-control px-2 py-2.5 text-left transition-colors hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-soft text-blue">
          <Icon icon={ClipboardList} size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body font-semibold text-ink">{q.topicTitle}</span>
          <span className="mt-0.5 block truncate text-micro text-ink-soft">
            {t("attemptsN", { n: q.attempts })} ·{" "}
            <span className={q.passed ? "font-semibold text-emerald" : "font-semibold text-rose"}>
              {q.passed ? t("passed") : t("notPassed")}
            </span>
            <span className="hidden sm:inline"> · {t("passThreshold", { n: q.passThreshold })}</span>
          </span>
        </span>
        <span className={cls("shrink-0 text-section font-semibold tabular-nums", scoreTone(q.bestScore))}>
          {q.bestScore}%
        </span>
        <span
          className={cls(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors",
            open ? "border-ink bg-ink text-surface" : "border-line text-ink-soft"
          )}
        >
          <Icon icon={ChevronDown} size={14} className={cls("transition-transform", !open && "-rotate-90")} />
        </span>
      </button>

      {/* Urinishlar tarixi + mavzuga o'tish */}
      {open && (
        <div className="mx-2 mb-2 rounded-control bg-surface-raised p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-micro font-semibold text-ink-soft">{t("historyTitle")}</p>
            <p className="text-micro tabular-nums text-ink-soft">{t("passThreshold", { n: q.passThreshold })}</p>
          </div>
          <ul className="space-y-2">
            {q.history.map((h) => (
              <li key={h.attemptNo} className="flex items-center gap-3 text-note">
                <span className="w-20 shrink-0 font-semibold text-ink-2">{t("attemptsN", { n: h.attemptNo })}</span>
                <Line value={h.scorePct} tone={h.passed ? "emerald" : "rose"} track="bg-surface" className="flex-1" />
                <span className={cls("w-11 shrink-0 text-right font-data font-semibold tabular-nums", scoreTone(h.scorePct))}>
                  {h.scorePct}%
                </span>
                <span className="hidden w-20 shrink-0 text-right tabular-nums text-ink-soft sm:block">
                  {h.finishedAt ? formatDate(lang, h.finishedAt, "short") : "—"}
                </span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={onOpen}
            className="mt-3 inline-flex items-center gap-1.5 rounded-control text-note font-semibold text-brand-tint hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            {t("openTopic")} <Icon icon={ArrowRight} size={14} />
          </button>
        </div>
      )}
    </li>
  );
}

function CaseRow({ c, onOpen }: { c: GradeCase; onOpen: () => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "grades" });
  const locale = useLocale();
  const lang = locale === "ru" ? "ru" : "uz";
  const [open, setOpen] = useState(false);

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="group flex w-full min-w-0 items-center gap-3 rounded-control px-2 py-2.5 text-left transition-colors hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-soft text-rose">
          <Icon icon={Stethoscope} size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body font-semibold text-ink">{c.topicTitle}</span>
          <span className="mt-0.5 block truncate text-micro text-ink-soft">
            {c.reviewed && c.reviewedAt
              ? `${c.reviewedByName ?? "—"} · ${formatDate(lang, c.reviewedAt, "short")}`
              : formatDate(lang, c.submittedAt, "short")}
          </span>
        </span>
        {c.reviewed ? (
          <span className="shrink-0 text-section font-semibold tabular-nums text-emerald">{c.score}</span>
        ) : (
          <span className="shrink-0 rounded-pill bg-amber-soft px-2 py-0.5 text-micro font-semibold text-amber">
            {t("underReview")}
          </span>
        )}
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line text-ink-soft transition-colors group-hover:border-ink group-hover:bg-ink group-hover:text-surface">
          <Icon icon={ArrowRight} size={13} />
        </span>
      </button>

      {/* O'qituvchi izohi — asosiy qiymat, bosilsa ochiladi */}
      {c.feedback && (
        <div className="px-2 pb-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full items-start gap-2.5 rounded-control bg-emerald-soft px-3 py-2.5 text-left text-note text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <Icon icon={MessageSquareQuote} size={15} className="mt-0.5 shrink-0 text-emerald" />
          <span className={cls("min-w-0 flex-1 leading-relaxed", !open && "truncate")}>{c.feedback}</span>
        </button>
        </div>
      )}
    </li>
  );
}

export function CourseBlock({ c, filter }: { c: GradesCourse; filter: GradeFilter }) {
  const { t } = useTranslation(undefined, { keyPrefix: "grades" });
  const { t: tp } = useTranslation(undefined, { keyPrefix: "period" });
  const navigate = useNavigate();

  const quizzes = filter === "case" ? [] : c.quizzes;
  const cases = filter === "quiz" ? [] : c.cases;
  if (quizzes.length === 0 && cases.length === 0) return null;

  return (
    <BentoCard
      title={c.subjectName}
      meta={`${c.academicYear} · ${tp("semester", { n: c.semester })}`}
      right={
        c.avgQuiz !== null && (
          <span className="hidden items-center gap-1 text-note font-semibold text-ink-soft sm:inline-flex">
            {t("avgQuizShort")}
            <span className={cls("tabular-nums", scoreTone(c.avgQuiz))}>{c.avgQuiz}%</span>
          </span>
        )
      }
      bodyClassName="px-2 pb-2"
    >
      <ul className="divide-y divide-line-soft">
        {quizzes.map((q) => (
          <QuizRow key={`q${q.topicId}`} q={q} onOpen={() => navigate(`/app/topics/${q.topicId}?tab=quiz`)} />
        ))}
        {cases.map((k) => (
          <CaseRow key={`c${k.topicId}`} c={k} onOpen={() => navigate(`/app/topics/${k.topicId}?tab=case`)} />
        ))}
      </ul>
    </BentoCard>
  );
}
