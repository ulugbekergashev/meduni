import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Award, ChevronDown, ClipboardList, MessageSquareQuote, Stethoscope, Target, TrendingUp } from "lucide-react";
import { Badge, Card, Icon, ProgressBar, cls } from "@meduni/ui";
import { AsyncSection } from "../../components/AsyncSection";
import { formatDate } from "../../lib/date";
import { useLocale } from "../../lib/useLocale";
import { useMyGrades, type GradeCase, type GradeQuiz, type GradesCourse } from "./api";

function scoreTone(pct: number) {
  if (pct >= 85) return "text-emerald";
  if (pct >= 70) return "text-blue";
  if (pct >= 60) return "text-amber";
  return "text-rose";
}

/** Bosiladigan ko'rsatkich — ro'yxatni shu turga filtrlaydi. */
function StatCard({
  icon,
  value,
  label,
  tone,
  onClick,
  selected = false,
}: {
  icon: typeof Award;
  value: string;
  label: string;
  tone: string;
  onClick?: () => void;
  selected?: boolean;
}) {
  return (
    <Card
      interactive={!!onClick}
      onClick={onClick}
      className={cls("flex items-center gap-3", selected && "border-brand ring-1 ring-brand/30")}
    >
      <div className={cls("flex h-11 w-11 shrink-0 items-center justify-center rounded-control", tone)}>
        <Icon icon={icon} size={19} />
      </div>
      <div className="min-w-0">
        <p className="text-[26px] font-bold leading-none tabular-nums text-ink">{value}</p>
        <p className="mt-1 truncate text-note text-ink-soft">{label}</p>
      </div>
    </Card>
  );
}

function QuizRow({ q, onOpen }: { q: GradeQuiz; onOpen: () => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "grades" });
  const locale = useLocale();
  const [open, setOpen] = useState(false);

  return (
    <div>
      <div
        onClick={() => setOpen((o) => !o)}
        className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-bg"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-soft text-blue">
          <Icon icon={ClipboardList} size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-body font-semibold text-ink">{q.topicTitle}</p>
          <p className="flex items-center gap-1.5 text-note text-ink-faint">
            {t("attemptsN", { n: q.attempts })} · {q.passed ? t("passed") : t("notPassed")}
            <span className="text-ink-faint">· {t("passThreshold", { n: q.passThreshold })}</span>
          </p>
        </div>
        <span className={cls("shrink-0 text-[19px] font-bold tabular-nums", scoreTone(q.bestScore))}>{q.bestScore}%</span>
        <Icon
          icon={ChevronDown}
          size={16}
          className={cls("shrink-0 text-ink-faint transition-transform", !open && "-rotate-90")}
        />
      </div>

      {/* Urinishlar tarixi + mavzuga o'tish */}
      {open && (
        <div className="border-t border-line bg-bg/60 px-4 py-3">
          <p className="mb-2 text-note font-bold uppercase tracking-wide text-ink-faint">{t("historyTitle")}</p>
          <div className="space-y-1.5">
            {q.history.map((h) => (
              <div key={h.attemptNo} className="flex items-center gap-3 text-note">
                <span className="w-20 shrink-0 font-semibold text-ink">{t("attemptsN", { n: h.attemptNo })}</span>
                <span className="flex-1">
                  <ProgressBar value={h.scorePct} tone={h.passed ? "emerald" : "rose"} />
                </span>
                <span className={cls("w-12 shrink-0 text-right font-bold tabular-nums", scoreTone(h.scorePct))}>
                  {h.scorePct}%
                </span>
                <span className="w-20 shrink-0 text-right text-ink-faint">
                  {h.finishedAt ? formatDate(locale === "ru" ? "ru" : "uz", h.finishedAt, "short") : "—"}
                </span>
              </div>
            ))}
          </div>
          <button
            onClick={onOpen}
            className="mt-2.5 text-note font-semibold text-brand-deep hover:underline"
          >
            {t("openTopic")} →
          </button>
        </div>
      )}
    </div>
  );
}

function CaseRow({ c, onOpen }: { c: GradeCase; onOpen: () => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "grades" });
  const locale = useLocale();
  const [open, setOpen] = useState(false);

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-soft text-rose">
          <Icon icon={Stethoscope} size={16} />
        </div>
        <button onClick={onOpen} className="min-w-0 flex-1 text-left">
          <p className="truncate text-body font-semibold text-ink">{c.topicTitle}</p>
          <p className="text-note text-ink-faint">
            {c.reviewed && c.reviewedAt
              ? `${c.reviewedByName ?? "—"} · ${formatDate(locale === "ru" ? "ru" : "uz", c.reviewedAt, "short")}`
              : formatDate(locale === "ru" ? "ru" : "uz", c.submittedAt, "short")}
          </p>
        </button>
        {c.reviewed ? (
          <span className="shrink-0 text-[19px] font-bold tabular-nums text-emerald">{c.score}</span>
        ) : (
          <Badge tone="amber">{t("underReview")}</Badge>
        )}
      </div>

      {/* O'qituvchi izohi — asosiy qiymat, bosilsa ochiladi */}
      {c.feedback && (
        <button
          onClick={() => setOpen((o) => !o)}
          className="mt-2 flex w-full items-start gap-2 rounded-control bg-emerald-soft px-3 py-2 text-left text-note text-ink"
        >
          <Icon icon={MessageSquareQuote} size={14} className="mt-0.5 shrink-0 text-emerald" />
          <span className={cls("min-w-0 flex-1", !open && "truncate")}>{c.feedback}</span>
        </button>
      )}
    </div>
  );
}

function CourseBlock({ c, filter }: { c: GradesCourse; filter: Filter }) {
  const { t } = useTranslation(undefined, { keyPrefix: "grades" });
  const { t: tp } = useTranslation(undefined, { keyPrefix: "period" });
  const navigate = useNavigate();

  const quizzes = filter === "case" ? [] : c.quizzes;
  const cases = filter === "quiz" ? [] : c.cases;
  if (quizzes.length === 0 && cases.length === 0) return null;

  return (
    <section className="mt-5 first:mt-0">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-section font-bold text-ink">{c.subjectName}</h2>
          <span className="rounded-pill bg-bg px-2 py-0.5 text-note text-ink-soft">
            {c.academicYear} · {tp("semester", { n: c.semester })}
          </span>
        </div>
        {c.avgQuiz !== null && (
          <span className="text-note font-semibold text-ink-soft">
            {t("avgQuizShort")}: <span className={scoreTone(c.avgQuiz)}>{c.avgQuiz}%</span>
          </span>
        )}
      </div>

      <Card className="divide-y divide-line p-0">
        {quizzes.map((q) => (
          <QuizRow key={`q${q.topicId}`} q={q} onOpen={() => navigate(`/app/topics/${q.topicId}?tab=quiz`)} />
        ))}
        {cases.map((k) => (
          <CaseRow key={`c${k.topicId}`} c={k} onOpen={() => navigate(`/app/topics/${k.topicId}?tab=case`)} />
        ))}
      </Card>
    </section>
  );
}

/** "Baholarim" — barcha test natijalari va keys baholari, kurslar kesimida. */
type Filter = "all" | "quiz" | "case";

export function GradesPage() {
  const { t } = useTranslation(undefined, { keyPrefix: "grades" });
  const q = useMyGrades();
  const data = q.data;
  const [filter, setFilter] = useState<Filter>("all");
  const withGrades = (data?.courses ?? []).filter((c) =>
    filter === "quiz" ? c.quizzes.length > 0 : filter === "case" ? c.cases.length > 0 : c.quizzes.length > 0 || c.cases.length > 0
  );
  const s = data?.summary;
  const toggle = (f: Filter) => setFilter((cur) => (cur === f ? "all" : f));
  const withGradesAny = (data?.courses ?? []).some((c) => c.quizzes.length > 0 || c.cases.length > 0);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-h1 font-bold text-ink">{t("title")}</h1>
      <p className="mt-1 text-body text-ink-soft">{t("subtitle")}</p>

      {s && withGrades.length > 0 && (
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <StatCard
            icon={TrendingUp}
            value={s.avgQuiz !== null ? `${s.avgQuiz}%` : "—"}
            label={t("avgQuiz")}
            tone="bg-blue-soft text-blue"
            onClick={() => toggle("quiz")}
            selected={filter === "quiz"}
          />
          <StatCard
            icon={Target}
            value={`${s.quizzesPassed}/${s.quizzesTotal}`}
            label={t("quizzesPassed")}
            tone="bg-emerald-soft text-emerald"
            onClick={() => toggle("quiz")}
            selected={filter === "quiz"}
          />
          <StatCard
            icon={Award}
            value={`${s.casesGraded}/${s.casesTotal}`}
            label={t("casesGraded")}
            tone="bg-rose-soft text-rose"
            onClick={() => toggle("case")}
            selected={filter === "case"}
          />
        </div>
      )}

      {/* Tur filtri — segmented */}
      {withGradesAny && (
        <div className="mt-5 inline-flex gap-1 rounded-control border border-line bg-surface p-1 shadow-card">
          {(["all", "quiz", "case"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cls(
                "rounded-[8px] px-3.5 py-1.5 text-body font-semibold transition-all",
                filter === f ? "bg-brand-soft text-brand-deep" : "text-ink-soft hover:bg-bg hover:text-ink"
              )}
            >
              {t(`filter.${f}`)}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4">
        <AsyncSection
          isLoading={q.isLoading}
          isError={q.isError}
          isEmpty={withGrades.length === 0}
          emptyIcon={<Icon icon={Award} size={22} />}
          emptyText={t("empty")}
          emptyHint={t("emptyHint")}
          onRetry={() => q.refetch()}
        >
          {withGrades.map((c) => (
            <CourseBlock key={c.courseId} c={c} filter={filter} />
          ))}
        </AsyncSection>
      </div>
    </div>
  );
}
