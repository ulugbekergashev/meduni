import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Award, ChevronDown, ClipboardList, Clock, MessageSquareQuote, Stethoscope, Target, TrendingUp } from "lucide-react";
import { Badge, Card, Icon, ProgressBar, ProgressRing, cls } from "@meduni/ui";
import { HeroCard, HeroTile, RailCard } from "../../components/HeroStats";
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
  const navigateTo = useNavigate();
  const q = useMyGrades();
  const data = q.data;
  const [filter, setFilter] = useState<Filter>("all");
  const withGrades = (data?.courses ?? []).filter((c) =>
    filter === "quiz" ? c.quizzes.length > 0 : filter === "case" ? c.cases.length > 0 : c.quizzes.length > 0 || c.cases.length > 0
  );
  const s = data?.summary;
  const toggle = (f: Filter) => setFilter((cur) => (cur === f ? "all" : f));
  const withGradesAny = (data?.courses ?? []).some((c) => c.quizzes.length > 0 || c.cases.length > 0);
  const allCases = (data?.courses ?? []).flatMap((c) => c.cases.map((k) => ({ ...k, subjectName: c.subjectName })));
  const pendingCases = allCases.filter((k) => !k.reviewed);
  // O'ng ustun: oxirgi baholangan ishlar (sana bo'yicha)
  const recent = [
    ...(data?.courses ?? []).flatMap((c) =>
      c.quizzes.map((qz) => ({
        key: `q${qz.topicId}`,
        title: qz.topicTitle,
        subject: c.subjectName,
        score: `${qz.bestScore}%`,
        at: qz.lastAt,
        topicId: qz.topicId,
        tab: "quiz",
      }))
    ),
    ...allCases
      .filter((k) => k.reviewed)
      .map((k) => ({
        key: `c${k.topicId}`,
        title: k.topicTitle,
        subject: k.subjectName,
        score: String(k.score ?? "—"),
        at: k.reviewedAt,
        topicId: k.topicId,
        tab: "case",
      })),
  ]
    .filter((r) => r.at)
    .sort((a, b) => new Date(b.at!).getTime() - new Date(a.at!).getTime())
    .slice(0, 6);

  return (
    <div>
      <HeroCard
        title={t("title")}
        subtitle={t("subtitle")}
        left={
          s && s.avgQuiz !== null ? (
            <div className="flex items-center gap-3">
              <ProgressRing value={s.avgQuiz} size={64} stroke={8} tone="blue" />
              <span className="text-note text-ink-soft">{t("avgQuiz")}</span>
            </div>
          ) : undefined
        }
      >
        <HeroTile
          icon={TrendingUp}
          value={s?.avgQuiz !== null && s?.avgQuiz !== undefined ? `${s.avgQuiz}%` : "—"}
          label={t("avgQuiz")}
          tone="bg-blue-soft text-blue"
          onClick={() => toggle("quiz")}
          selected={filter === "quiz"}
        />
        <HeroTile
          icon={Target}
          value={`${s?.quizzesPassed ?? 0}/${s?.quizzesTotal ?? 0}`}
          label={t("quizzesPassed")}
          tone="bg-emerald-soft text-emerald"
          onClick={() => toggle("quiz")}
          selected={filter === "quiz"}
        />
        <HeroTile
          icon={Award}
          value={`${s?.casesGraded ?? 0}/${s?.casesTotal ?? 0}`}
          label={t("casesGraded")}
          tone="bg-rose-soft text-rose"
          onClick={() => toggle("case")}
          selected={filter === "case"}
        />
        <HeroTile
          icon={Clock}
          value={String(pendingCases.length)}
          label={t("statPending")}
          tone={pendingCases.length > 0 ? "bg-amber-soft text-amber" : "bg-bg text-ink-faint"}
          onClick={() => toggle("case")}
          selected={filter === "case"}
        />
      </HeroCard>

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

      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
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

        <aside className="min-w-0 space-y-5">
          {recent.length > 0 && (
            <RailCard title={t("recentGrades")} icon={Award}>
              <div className="divide-y divide-line">
                {recent.map((r) => (
                  <button
                    key={r.key}
                    onClick={() => navigateTo(`/app/topics/${r.topicId}?tab=${r.tab}`)}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-bg"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-note font-semibold text-ink">{r.title}</p>
                      <p className="truncate text-[12.5px] text-ink-faint">{r.subject}</p>
                    </div>
                    <span className="shrink-0 text-body font-bold tabular-nums text-ink-soft">{r.score}</span>
                  </button>
                ))}
              </div>
            </RailCard>
          )}

          {pendingCases.length > 0 && (
            <RailCard title={t("statPending")} icon={Clock}>
              <div className="divide-y divide-line">
                {pendingCases.map((k) => (
                  <button
                    key={`p${k.topicId}`}
                    onClick={() => navigateTo(`/app/topics/${k.topicId}?tab=case`)}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-bg"
                  >
                    <Icon icon={Stethoscope} size={14} className="shrink-0 text-amber" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-note font-semibold text-ink">{k.topicTitle}</p>
                      <p className="truncate text-[12.5px] text-ink-faint">{k.subjectName}</p>
                    </div>
                    <Badge tone="amber">{t("underReview")}</Badge>
                  </button>
                ))}
              </div>
            </RailCard>
          )}
        </aside>
      </div>
    </div>
  );
}
