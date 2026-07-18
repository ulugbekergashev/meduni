import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, BookOpen, CalendarCheck2, ClipboardCheck, GraduationCap, Layers, PlayCircle } from "lucide-react";
import { Card, EmptyState, Icon, ProgressRing, cls } from "@meduni/ui";
import { AsyncSection } from "../../components/AsyncSection";
import { useMyDashboard, useMyProfile, type CourseSummary } from "./api";

function ProgressBar({ pct, tone = "brand" }: { pct: number; tone?: "brand" | "white" }) {
  return (
    <div className={tone === "white" ? "h-2 w-full overflow-hidden rounded-pill bg-white/25" : "h-2 w-full overflow-hidden rounded-pill bg-bg"}>
      <div
        className={tone === "white" ? "h-full rounded-pill bg-white transition-all" : "h-full rounded-pill bg-brand transition-all"}
        style={{ width: `${Math.max(pct, 2)}%` }}
      />
    </div>
  );
}

function CourseCard({ course }: { course: CourseSummary }) {
  const { t } = useTranslation(undefined, { keyPrefix: "student" });
  const navigate = useNavigate();
  const next = course.nextTopicId ? course.nextTopic : null;

  return (
    <Card interactive onClick={() => navigate(`/app/courses/${course.id}`)} className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-section font-bold text-ink">{course.subjectName}</h3>
          <p className="truncate text-[13.5px] text-ink-faint">{course.teacherName}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-deep">
          <Icon icon={BookOpen} size={18} />
        </div>
      </div>

      <div className="space-y-1.5">
        <ProgressBar pct={course.progressPct} />
        <div className="flex items-center justify-between text-[13px] text-ink-soft">
          <span>{course.progressPct}%</span>
          <span>
            {course.topicsCompleted}/{course.topicsTotal} {t("topics")}
          </span>
        </div>
      </div>

      {next && (
        <p className="truncate text-[13.5px] text-ink-soft">
          <span className="text-ink-faint">{t("nextTopic")}: </span>
          {next}
        </p>
      )}
    </Card>
  );
}

function SummaryTile({ icon, value, label, tone }: { icon: typeof Layers; value: string; label: string; tone: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={cls("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", tone)}>
        <Icon icon={icon} size={16} />
      </div>
      <div className="min-w-0">
        <p className="text-[18px] font-bold leading-none tabular-nums text-ink">{value}</p>
        <p className="mt-0.5 truncate text-[12.5px] text-ink-soft">{label}</p>
      </div>
    </div>
  );
}

export function StudentDashboard() {
  const { t } = useTranslation(undefined, { keyPrefix: "student" });
  const q = useMyDashboard();
  const profile = useMyProfile();
  const d = q.data;
  const p = profile.data;
  const overallPct =
    d && d.courses.length > 0
      ? Math.round(d.courses.reduce((sum, c) => sum + c.progressPct, 0) / d.courses.length)
      : 0;

  return (
    <div className="mx-auto max-w-3xl">
      <AsyncSection
        isLoading={q.isLoading}
        isError={q.isError}
        isEmpty={!!d && d.courses.length === 0}
        emptyIcon={<Icon icon={GraduationCap} size={22} />}
        emptyText={t("noCourses")}
        onRetry={() => q.refetch()}
      >
        {d && (
          <>
            <h1 className="text-h1 font-bold text-ink">
              {t("hello")}, {d.fullName.split(" ")[0]}
            </h1>

            {/* Overall summary: ring + tiles */}
            {d.courses.length > 0 && (
              <Card className="mt-5 flex flex-wrap items-center gap-x-7 gap-y-4 !p-5">
                <ProgressRing value={overallPct} size={96} stroke={10} label={t("overall")} />
                <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
                  <SummaryTile
                    icon={Layers}
                    value={`${d.courses.reduce((s, c) => s + c.topicsCompleted, 0)}/${d.courses.reduce((s, c) => s + c.topicsTotal, 0)}`}
                    label={t("summaryTopics")}
                    tone="bg-emerald-soft text-emerald"
                  />
                  <SummaryTile
                    icon={CalendarCheck2}
                    value={p?.attendancePct !== null && p?.attendancePct !== undefined ? `${p.attendancePct}%` : "—"}
                    label={t("summaryAttendance")}
                    tone={
                      p?.attendancePct !== null && p?.attendancePct !== undefined && p.attendancePct < 75
                        ? "bg-rose-soft text-rose"
                        : "bg-blue-soft text-blue"
                    }
                  />
                  <SummaryTile
                    icon={BookOpen}
                    value={String(d.courses.length)}
                    label={t("summaryCourses")}
                    tone="bg-brand-soft text-brand-deep"
                  />
                </div>
              </Card>
            )}

            {/* Resume — the primary action, most prominent block */}
            {d.resume && (
              <div className="mt-5 rounded-card bg-gradient-to-br from-brand-deep to-brand p-5 text-white shadow-md">
                <p className="text-[13.5px] font-medium uppercase tracking-wide text-white/70">{t("continueLabel")}</p>
                <p className="mt-1 text-[14px] text-white/85">{d.resume.subjectName}</p>
                <h2 className="mt-0.5 text-[20px] font-bold leading-tight">{d.resume.topic}</h2>
                <div className="mt-3">
                  <ProgressBar pct={d.resume.pct} tone="white" />
                  <p className="mt-1.5 text-[13px] text-white/80">{d.resume.pct}% {t("done")}</p>
                </div>
                <Link to={`/app/topics/${d.resume.topicId}`} className="mt-4 block">
                  <button className="flex w-full items-center justify-center gap-2 rounded-control bg-white px-4 py-3 text-[16px] font-bold text-brand-deep transition-all hover:bg-white/90">
                    <Icon icon={PlayCircle} size={19} />
                    {t("continue")}
                  </button>
                </Link>
              </div>
            )}

            {/* Notifications */}
            {d.notifications.length > 0 && (
              <div className="mt-8">
                <h2 className="text-section font-bold text-ink">{t("notifications")}</h2>
                <div className="mt-3 space-y-2">
                  {d.notifications.map((n) => (
                    <Link key={n.caseAttemptId} to={`/app/topics/${n.topicId}?tab=case`}>
                      <Card interactive className="flex items-center gap-3 py-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-soft text-emerald">
                          <Icon icon={ClipboardCheck} size={17} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14.5px] font-semibold text-ink">{t("caseGraded")}</p>
                          <p className="truncate text-[13px] text-ink-soft">{n.topic}</p>
                        </div>
                        {n.score !== null && <span className="text-[16px] font-bold text-emerald">{n.score}</span>}
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* My courses */}
            <div className="mt-8">
              <h2 className="text-section font-bold text-ink">{t("myCourses")}</h2>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {d.courses.map((c) => (
                  <CourseCard key={c.id} course={c} />
                ))}
              </div>
            </div>
          </>
        )}
      </AsyncSection>

      {d && d.courses.length === 0 && (
        <p className="mt-3 text-center text-[14px] text-ink-faint">{t("adminWillAdd")}</p>
      )}

      {/* Empty-but-loaded fallback handled by AsyncSection; explicit hint below */}
      {!d && !q.isLoading && !q.isError && (
        <EmptyState icon={<Icon icon={ArrowRight} size={22} />} text={t("noCourses")} />
      )}
    </div>
  );
}
