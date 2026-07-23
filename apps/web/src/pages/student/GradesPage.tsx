import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  Award,
  ChevronDown,
  ClipboardList,
  Clock,
  Dumbbell,
  MessageSquareQuote,
  Repeat,
  Stethoscope,
  Target,
  TrendingUp,
} from "lucide-react";
import { Badge, Card, Icon, ProgressBar, cls } from "@meduni/ui";
import { HeroTile, RailCard } from "../../components/HeroStats";
import { AsyncSection } from "../../components/AsyncSection";
import { formatDate } from "../../lib/date";
import { useLocale } from "../../lib/useLocale";
import { useMyGrades, useReviewDue, type GradeCase, type GradeQuiz, type GradesCourse } from "./api";
import { LeaderboardCard } from "./LeaderboardCard";
import { ReviewTab } from "./grades/ReviewTab";
import { PracticeTab } from "./grades/PracticeTab";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

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
    <div className="border-b border-line last:border-b-0 group">
      <div
        onClick={() => setOpen((o) => !o)}
        className="flex w-full cursor-pointer items-center gap-5 px-5 py-4 text-left transition-all duration-300 hover:bg-surface-raised hover:pl-6"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-soft text-blue shadow-sm transition-transform duration-300 group-hover:scale-110">
          <Icon icon={ClipboardList} size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-body font-bold text-ink transition-colors group-hover:text-brand-tint">{q.topicTitle}</p>
          <p className="flex items-center gap-1.5 text-note text-ink-faint mt-0.5">
            {t("attemptsN", { n: q.attempts })} · <span className={q.passed ? "text-emerald font-medium" : ""}>{q.passed ? t("passed") : t("notPassed")}</span>
            <span className="text-ink-faint">· {t("passThreshold", { n: q.passThreshold })}</span>
          </p>
        </div>
        <span className={cls("shrink-0 text-[20px] font-bold tabular-nums tracking-tight", scoreTone(q.bestScore))}>{q.bestScore}%</span>
        <div className={cls("flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-ink-soft transition-all ml-2 border border-line shadow-sm", open && "bg-brand-soft text-brand border-transparent")}>
          <Icon
            icon={ChevronDown}
            size={16}
            className={cls("transition-transform", !open && "-rotate-90")}
          />
        </div>
      </div>

      {/* Urinishlar tarixi + mavzuga o'tish */}
      <AnimatePresence>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden bg-surface-raised"
        >
          <div className="border-t border-line px-5 py-4">
            <p className="mb-3 text-note font-bold uppercase tracking-wider text-ink-faint">{t("historyTitle")}</p>
            <div className="space-y-2.5">
              {q.history.map((h) => (
                <div key={h.attemptNo} className="flex items-center gap-4 text-body">
                  <span className="w-20 shrink-0 font-semibold text-ink-soft">{t("attemptsN", { n: h.attemptNo })}</span>
                  <span className="flex-1">
                    <ProgressBar value={h.scorePct} tone={h.passed ? "emerald" : "rose"} />
                  </span>
                  <span className={cls("w-12 shrink-0 text-right font-bold tabular-nums", scoreTone(h.scorePct))}>
                    {h.scorePct}%
                  </span>
                  <span className="w-20 shrink-0 text-right font-medium text-ink-faint">
                    {h.finishedAt ? formatDate(locale === "ru" ? "ru" : "uz", h.finishedAt, "short") : "—"}
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={onOpen}
              className="mt-4 text-note font-bold text-brand-tint hover:underline inline-flex items-center gap-1.5"
            >
              {t("openTopic")} <Icon icon={ChevronDown} size={14} className="-rotate-90" />
            </button>
          </div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}

function CaseRow({ c, onOpen }: { c: GradeCase; onOpen: () => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "grades" });
  const locale = useLocale();
  const [open, setOpen] = useState(false);

  return (
    <div className="group border-b border-line last:border-b-0 px-5 py-4 transition-all duration-300 hover:bg-surface-raised hover:pl-6">
      <div className="flex items-center gap-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-soft text-rose shadow-sm transition-transform duration-300 group-hover:scale-110">
          <Icon icon={Stethoscope} size={20} />
        </div>
        <button onClick={onOpen} className="min-w-0 flex-1 text-left">
          <p className="truncate text-body font-bold text-ink transition-colors group-hover:text-brand-tint">{c.topicTitle}</p>
          <p className="text-note text-ink-soft mt-0.5 font-medium">
            {c.reviewed && c.reviewedAt
              ? `${c.reviewedByName ?? "—"} · ${formatDate(locale === "ru" ? "ru" : "uz", c.reviewedAt, "short")}`
              : formatDate(locale === "ru" ? "ru" : "uz", c.submittedAt, "short")}
          </p>
        </button>
        {c.reviewed ? (
          <span className="shrink-0 text-[20px] font-bold tabular-nums text-emerald tracking-tight">{c.score}</span>
        ) : (
          <Badge tone="amber">{t("underReview")}</Badge>
        )}
      </div>

      {/* O'qituvchi izohi — asosiy qiymat, bosilsa ochiladi */}
      {c.feedback && (
        <button
          onClick={() => setOpen((o) => !o)}
          className="mt-3 flex w-full items-start gap-2.5 rounded-card bg-emerald-soft border border-emerald/20 px-4 py-3 text-left text-body text-ink transition-colors hover:bg-emerald-soft"
        >
          <Icon icon={MessageSquareQuote} size={16} className="mt-0.5 shrink-0 text-emerald" />
          <span className={cls("min-w-0 flex-1 leading-relaxed", !open && "truncate")}>{c.feedback}</span>
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
    <motion.section variants={itemVariants} className="mt-3 first:mt-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-3">
          <h2 className="text-[20px] font-black tracking-tight bg-gradient-to-br from-ink to-ink-soft bg-clip-text text-transparent drop-shadow-sm">{c.subjectName}</h2>
          <span className="rounded-full bg-surface-glass backdrop-blur-md border border-line px-3 py-1 text-note font-bold text-ink-soft shadow-sm">
            {c.academicYear} · {tp("semester", { n: c.semester })}
          </span>
        </div>
        {c.avgQuiz !== null && (
          <span className="rounded-full bg-surface border border-line px-3 py-1 text-[15px] font-bold text-ink-soft shadow-sm">
            {t("avgQuizShort")}: <span className={cls(scoreTone(c.avgQuiz), "ml-1")}>{c.avgQuiz}%</span>
          </span>
        )}
      </div>

      <Card className="p-0 overflow-hidden shadow-sm">
        {quizzes.map((q) => (
          <QuizRow key={`q${q.topicId}`} q={q} onOpen={() => navigate(`/app/topics/${q.topicId}?tab=quiz`)} />
        ))}
        {cases.map((k) => (
          <CaseRow key={`c${k.topicId}`} c={k} onOpen={() => navigate(`/app/topics/${k.topicId}?tab=case`)} />
        ))}
      </Card>
    </motion.section>
  );
}

/** "Baholarim" — barcha test natijalari va keys baholari, kurslar kesimida. */
type Filter = "all" | "quiz" | "case";

/** O'zlashtirish moduli — 3 tab: Baholar | Takrorlash | Mashg'ulotlar (Modul 27). */
export function GradesPage() {
  const { t } = useTranslation(undefined, { keyPrefix: "grades" });
  const [params, setParams] = useSearchParams();
  const dueQ = useReviewDue();
  const sub =
    params.get("sub") === "takrorlash" ? "takrorlash" : params.get("sub") === "mashgulot" ? "mashgulot" : "baholar";

  const tabs = [
    { key: "baholar", label: t("tabGrades"), icon: Award, badge: 0 },
    { key: "takrorlash", label: t("tabReview"), icon: Repeat, badge: dueQ.data?.total ?? 0 },
    { key: "mashgulot", label: t("tabPractice"), icon: Dumbbell, badge: 0 },
  ] as const;

  return (
    <div>
      <h1 className="text-h1 font-bold text-ink">{t("title")}</h1>
      <p className="mt-1 text-note text-ink-faint">{t("subtitle")}</p>

      {/* Segmented tab — Davomat sahifasi bilan bir xil naqsh */}
      <div className="mb-4 mt-3.5 inline-flex max-w-full gap-1 overflow-x-auto rounded-control border border-line bg-surface p-1">
        {tabs.map((tab) => {
          const on = sub === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setParams(tab.key === "baholar" ? {} : { sub: tab.key }, { replace: true })}
              className={cls(
                "inline-flex shrink-0 items-center gap-2 rounded-[8px] px-4 py-2 text-body font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                on ? "bg-brand-soft text-brand-tint" : "text-ink-soft hover:bg-surface-raised hover:text-ink"
              )}
            >
              <Icon icon={tab.icon} size={16} />
              {tab.label}
              {tab.badge > 0 && (
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand px-1.5 text-micro font-bold text-white">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {sub === "takrorlash" ? <ReviewTab /> : sub === "mashgulot" ? <PracticeTab /> : <GradesHome />}
    </div>
  );
}

function GradesHome() {
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
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-4">
      {/* Sarlavha GradesPage o'rovida (tablar ustida) — bu yerda faqat kartalar */}
      <motion.div variants={itemVariants}>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
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
            tone={pendingCases.length > 0 ? "bg-amber-soft text-amber" : "bg-surface text-ink-faint"}
            onClick={() => toggle("case")}
            selected={filter === "case"}
          />
        </div>
      </motion.div>

      {/* Tur filtri — segmented */}
      {withGradesAny && (
        <motion.div variants={itemVariants} className="inline-flex gap-1.5 rounded-full border border-line bg-surface/80 backdrop-blur-md p-1.5 shadow-sm">
          {(["all", "quiz", "case"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cls(
                "rounded-full px-5 py-2 text-[15px] font-bold transition-all duration-300",
                filter === f ? "bg-brand text-white shadow-md scale-105" : "text-ink-soft hover:bg-surface-raised hover:text-ink"
              )}
            >
              {t(`filter.${f}`)}
            </button>
          ))}
        </motion.div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
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

        <aside className="min-w-0 space-y-4">
          <motion.div variants={itemVariants}>
            <LeaderboardCard />
          </motion.div>

          {recent.length > 0 && (
            <motion.div variants={itemVariants}>
              <RailCard title={t("recentGrades")} icon={Award}>
                <div className="divide-y divide-line">
                  {recent.map((r) => (
                    <button
                      key={r.key}
                      onClick={() => navigateTo(`/app/topics/${r.topicId}?tab=${r.tab}`)}
                      className="group flex w-full items-center gap-3 px-5 py-4 text-left transition-all duration-300 hover:bg-surface-raised hover:pl-6"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-body font-bold text-ink transition-colors group-hover:text-brand-tint">{r.title}</p>
                        <p className="truncate text-note font-medium text-ink-faint mt-0.5">{r.subject}</p>
                      </div>
                      <span className="shrink-0 text-[16px] font-bold tabular-nums text-ink">{r.score}</span>
                    </button>
                  ))}
                </div>
              </RailCard>
            </motion.div>
          )}

          {pendingCases.length > 0 && (
            <motion.div variants={itemVariants}>
              <RailCard title={t("statPending")} icon={Clock}>
                <div className="divide-y divide-line">
                  {pendingCases.map((k) => (
                    <button
                      key={`p${k.topicId}`}
                      onClick={() => navigateTo(`/app/topics/${k.topicId}?tab=case`)}
                      className="group flex w-full items-center gap-3 px-5 py-4 text-left transition-all duration-300 hover:bg-surface-raised hover:pl-6"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-soft text-amber transition-transform duration-300 group-hover:scale-110">
                        <Icon icon={Stethoscope} size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-body font-bold text-ink transition-colors group-hover:text-brand-tint">{k.topicTitle}</p>
                        <p className="truncate text-note font-medium text-ink-faint mt-0.5">{k.subjectName}</p>
                      </div>
                      <Badge tone="amber">{t("underReview")}</Badge>
                    </button>
                  ))}
                </div>
              </RailCard>
            </motion.div>
          )}
        </aside>
      </div>
    </motion.div>
  );
}
