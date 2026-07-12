import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BookOpen, CheckCircle2, ClipboardCheck, FileClock, Users, UserX } from "lucide-react";
import { Card, Icon, Spinner } from "@meduni/ui";
import { AsyncSection } from "../../components/AsyncSection";
import { pickName, useLocale } from "../../lib/useLocale";
import { useMe } from "../../lib/auth";
import { useTeachCourses, useTeachDashboard } from "./api";

function TaskRow({ icon, tone, count, label, onClick }: { icon: typeof ClipboardCheck; tone: string; count: number; label: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`flex w-full items-center gap-3 rounded-control border p-3 text-left transition-all ${tone} ${onClick ? "hover:-translate-y-0.5 hover:shadow-sm" : "cursor-default"}`}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/60">
        <Icon icon={icon} size={17} />
      </div>
      <span className="text-[26px] font-bold tabular-nums leading-none">{count}</span>
      <span className="text-[13.5px] font-medium">{label}</span>
    </button>
  );
}

export function TeachDashboard() {
  const { t } = useTranslation(undefined, { keyPrefix: "teach" });
  const locale = useLocale();
  const navigate = useNavigate();
  const { data: me } = useMe();
  const dash = useTeachDashboard();
  const list = useTeachCourses();
  const courses = list.data ?? [];
  const tasks = dash.data?.tasks;
  const today = new Date().toLocaleDateString(locale === "ru" ? "ru-RU" : "uz-UZ", { day: "numeric", month: "long", year: "numeric" });
  const firstCourseId = courses[0]?.id;
  const noTasks = tasks && tasks.casesToReview === 0 && tasks.contentToApprove === 0 && tasks.studentsBehind === 0;

  return (
    <div>
      <h1 className="text-h1 font-bold text-ink">
        {t("hello")}, {me?.full_name?.split(" ")[0]}
      </h1>
      <p className="mt-0.5 text-[13px] text-ink-faint">{today}</p>

      {/* Tasks */}
      <section className="mt-6">
        <h2 className="mb-3 text-section font-bold text-ink">{t("tasks")}</h2>
        {dash.isLoading ? (
          <div className="flex h-24 items-center justify-center"><Spinner size={22} /></div>
        ) : noTasks ? (
          <Card className="flex items-center gap-3 border-emerald/40 bg-emerald-soft">
            <Icon icon={CheckCircle2} size={22} className="text-emerald" />
            <p className="text-[14px] font-semibold text-emerald">{t("allDone")}</p>
          </Card>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-3">
            <TaskRow icon={ClipboardCheck} tone="border-amber/30 bg-amber-soft text-amber" count={tasks?.casesToReview ?? 0} label={t("casesToReview")} onClick={() => navigate("/teach/review")} />
            <TaskRow icon={FileClock} tone="border-blue/30 bg-blue-soft text-blue" count={tasks?.contentToApprove ?? 0} label={t("contentToApprove")} onClick={firstCourseId ? () => navigate(`/teach/courses/${firstCourseId}/topics`) : undefined} />
            <TaskRow icon={UserX} tone="border-rose/30 bg-rose-soft text-rose" count={tasks?.studentsBehind ?? 0} label={t("studentsBehind")} onClick={firstCourseId ? () => navigate(`/teach/courses/${firstCourseId}/progress`) : undefined} />
          </div>
        )}
      </section>

      {/* Courses */}
      <section className="mt-8">
        <h2 className="mb-3 text-section font-bold text-ink">{t("myCourses")}</h2>
        <AsyncSection
          isLoading={list.isLoading}
          isError={list.isError}
          isEmpty={courses.length === 0}
          emptyIcon={<Icon icon={BookOpen} size={22} />}
          emptyText={t("empty")}
          onRetry={() => list.refetch()}
        >
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => {
              const avg = dash.data?.courses.find((d) => d.id === c.id)?.avgProgress ?? 0;
              return (
                <li key={c.id}>
                  <Card interactive onClick={() => navigate(`/teach/courses/${c.id}`)} className="h-full">
                    <div className="mb-3 flex h-14 items-end rounded-control bg-gradient-to-br from-brand to-brand-deep px-3 pb-2">
                      <span className="line-clamp-1 text-[15px] font-bold text-white">{pickName(locale, c.subjectNameUz, c.subjectNameRu)}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-ink-soft">
                      <span className="rounded-pill bg-brand-soft px-2 py-0.5 font-semibold text-brand-deep">{t("semester")} {c.semester}</span>
                      {c.groups.map((g) => (
                        <span key={g.id} className="rounded-pill bg-slate-100 px-2 py-0.5">{g.name}</span>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-[13px] text-ink-soft">
                        <Icon icon={Users} size={15} /> {c.studentCount} {t("students")}
                      </span>
                      <span className="text-[12px] font-semibold text-ink-soft">{t("avgProgress")}: {avg}%</span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-pill bg-bg">
                      <div className="h-full rounded-pill bg-brand" style={{ width: `${Math.max(avg, 2)}%` }} />
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        </AsyncSection>
      </section>
    </div>
  );
}
