import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, BookOpen, Building2, GraduationCap, KeyRound, Mail, Users } from "lucide-react";
import { Button, EmptyState, Icon, LegendRow, ProgressBar, Spinner, StackedBar, Toggle, cls, useToast } from "@meduni/ui";
import { BentoCard, BentoRow, HeaderChip, PageHeader } from "../../../components/bento";
import { BackLink } from "../components";
import { AsyncSection } from "../../../components/AsyncSection";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { api } from "../../../lib/api";
import { useLocale } from "../../../lib/useLocale";
import { isLowAttendance } from "../../../lib/attendance";
import { formatDate } from "../../../lib/date";
import { useUserProfile, type StudentProfileCourse, type TeacherProfileCourse } from "../api";
import { PasswordModal } from "./PasswordModal";

export function UserProfilePage() {
  const { id } = useParams();
  const userId = Number(id);
  const { t } = useTranslation(undefined, { keyPrefix: "userProfile" });
  const { t: tc } = useTranslation(undefined, { keyPrefix: "common" });
  const navigate = useNavigate();
  const locale = useLocale();
  const { show } = useToast();
  const qc = useQueryClient();
  const q = useUserProfile(userId);
  const p = q.data;

  const [resetOpen, setResetOpen] = useState(false);
  const [revealPassword, setRevealPassword] = useState<string | null>(null);

  const toggleActive = useMutation({
    mutationFn: () => api(`/api/v1/users/${userId}/toggle-active`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-profile", userId] });
      qc.invalidateQueries({ queryKey: ["admin-students"] });
      qc.invalidateQueries({ queryKey: ["staff-teachers"] });
      show(tc("updated"));
    },
  });
  const resetPw = useMutation({
    mutationFn: () => api<{ password: string }>(`/api/v1/users/${userId}/reset-password`, { method: "POST" }),
  });

  // Student aggregates derived from the enrolled-course rows.
  const studentCourses = (p?.kind === "student" ? (p.courses as StudentProfileCourse[]) : []) ?? [];
  const overallPct =
    studentCourses.length > 0
      ? Math.round(studentCourses.reduce((s, c) => s + c.progressPct, 0) / studentCourses.length)
      : 0;
  const att = p?.attendance;

  const lang = locale === "ru" ? "ru" : "uz";
  const kindLabel = p ? (p.kind === "teacher" && p.position ? p.position : t(`kind.${p.kind}`)) : "";
  const contacts = p
    ? [
        p.email,
        p.phone,
        p.kind === "student" ? p.groupName : null,
        p.kind === "teacher" ? p.departmentName : null,
      ].filter(Boolean)
    : [];
  const topicsDone = studentCourses.reduce((s, c) => s + c.completed, 0);
  const topicsTotal = studentCourses.reduce((s, c) => s + c.total, 0);

  return (
    <div className="space-y-3">
      <div>
        <BackLink label={t("back")} onClick={() => navigate(-1)} />
        {p && (
          <PageHeader
            className="mb-0"
            title={p.fullName}
            subtitle={contacts.join(" · ")}
            right={
              <>
                <HeaderChip tone={p.kind === "teacher" ? "brand" : "plain"} icon={<Icon icon={p.kind === "teacher" ? Building2 : p.kind === "student" ? Users : Mail} size={14} />}>
                  {kindLabel}
                </HeaderChip>
                {!p.isActive && <HeaderChip tone="rose">{t("inactive")}</HeaderChip>}
                <label className="inline-flex items-center gap-2 rounded-pill bg-surface-raised px-3 py-1 text-note font-semibold text-ink-2">
                  {t("activeLabel")}
                  <Toggle checked={p.isActive} disabled={toggleActive.isPending} aria-label="active" onChange={() => toggleActive.mutate()} />
                </label>
                <Button size="sm" variant="ghost" icon={<Icon icon={KeyRound} size={14} />} onClick={() => setResetOpen(true)}>
                  {t("resetPw")}
                </Button>
              </>
            }
          />
        )}
      </div>

      {q.isLoading ? (
        <div className="flex min-h-[40vh] items-center justify-center"><Spinner size={26} /></div>
      ) : (
        <AsyncSection isLoading={false} isError={q.isError} isEmpty={false} emptyText="" onRetry={() => q.refetch()}>
          {p && (
            <>
              {/* ---------- STUDENT ---------- */}
              {p.kind === "student" && (
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  {/* Umumiy progress — sahifaning yagona pastel yuzasi */}
                  <section className="flex flex-col gap-4 rounded-card bg-brand-soft p-5 sm:flex-row sm:items-stretch">
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="inline-flex items-center gap-1.5 self-start rounded-pill bg-surface/70 px-2.5 py-1 text-micro font-semibold text-brand-deep">
                        <Icon icon={GraduationCap} size={13} /> {t("overall")}
                      </span>
                      <h2 className="mt-3 text-h1 font-semibold tabular-nums text-ink">
                        {topicsDone}/{topicsTotal} <span className="text-section font-normal text-ink-2">{t("topicsDone")}</span>
                      </h2>
                      <p className="mt-1 text-note text-ink-2">
                        {studentCourses.length} {t("courses").toLowerCase()}
                        {p.avgQuizScore !== null && p.avgQuizScore !== undefined && (
                          <> · {t("avgQuiz")}: <b className="font-data tabular-nums text-ink">{p.avgQuizScore}%</b></>
                        )}
                      </p>
                      {p.lastActiveAt && (
                        <p className="mt-auto pt-3 text-micro text-ink-2">
                          {t("lastActive")}: {formatDate(lang, p.lastActiveAt, "short")}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-end justify-between border-t border-ink/10 pt-3 sm:flex-col sm:items-end sm:justify-start sm:border-0 sm:pt-0">
                      <p className="text-display font-semibold tabular-nums text-ink">{overallPct}%</p>
                    </div>
                  </section>

                  {/* Attendance breakdown */}
                  <BentoCard
                    title={t("attendance")}
                    right={
                      <span
                        className={cls(
                          "text-stat font-semibold tabular-nums",
                          p.attendancePct === null || p.attendancePct === undefined
                            ? "text-ink-faint"
                            : isLowAttendance(p.attendancePct)
                              ? "text-rose"
                              : "text-emerald"
                        )}
                      >
                        {p.attendancePct === null || p.attendancePct === undefined ? "—" : `${p.attendancePct}%`}
                      </span>
                    }
                  >
                    {att && att.marked > 0 ? (
                      <div className="flex flex-1 flex-col justify-end">
                        <StackedBar
                          segments={[
                            { value: att.present, tone: "emerald" },
                            { value: att.late, tone: "amber" },
                            { value: att.excused, tone: "blue" },
                            { value: att.absent, tone: "rose" },
                          ]}
                        />
                        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <LegendRow tone="emerald" label={t("att.present")} value={att.present} />
                          <LegendRow tone="amber" label={t("att.late")} value={att.late} />
                          <LegendRow tone="blue" label={t("att.excused")} value={att.excused} />
                          <LegendRow tone="rose" label={t("att.absent")} value={att.absent} />
                        </div>
                      </div>
                    ) : (
                      <p className="py-4 text-note text-ink-soft">{t("noAttendance")}</p>
                    )}
                  </BentoCard>

                  {/* Enrolled courses */}
                  <BentoCard className="xl:col-span-2" title={t("studentCourses")} count={studentCourses.length} bodyClassName="px-2 pb-3">
                    {studentCourses.length === 0 ? (
                      <div className="px-2 py-2">
                        <EmptyState icon={<Icon icon={BookOpen} size={20} />} text={t("noCourses")} />
                      </div>
                    ) : (
                      <ul className="space-y-1">
                        {studentCourses.map((c) => (
                          <li key={c.id}>
                            <BentoRow
                              icon={BookOpen}
                              iconTone="bg-blue-soft text-blue"
                              title={c.name}
                              sub={`${c.completed}/${c.total} ${t("topicsDone")}`}
                              right={
                                <span className="flex items-center gap-2">
                                  <span className="hidden w-32 sm:block"><ProgressBar value={c.progressPct} /></span>
                                  <span className="w-10 text-right">{c.progressPct}%</span>
                                </span>
                              }
                              onClick={() => navigate(`/admin/courses/${c.id}`)}
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                  </BentoCard>
                </div>
              )}

              {/* ---------- TEACHER ---------- */}
              {p.kind === "teacher" && p.stats && (
                <BentoCard
                  title={t("teacherCourses")}
                  count={(p.courses ?? []).length}
                  meta={`${p.stats.students} ${t("students").toLowerCase()} · ${p.stats.publishedTopics} ${t("publishedTopics").toLowerCase()}`}
                >
                  {(p.courses ?? []).length === 0 ? (
                    <EmptyState icon={<Icon icon={BookOpen} size={20} />} text={t("noCourses")} />
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {(p.courses as TeacherProfileCourse[]).map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => navigate(`/admin/courses/${c.id}`)}
                          className="group flex flex-col gap-2 rounded-card border border-line bg-surface p-4 text-left transition-colors hover:border-line-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                        >
                          <span className="flex items-start justify-between gap-2">
                            <span className="text-section font-semibold text-ink">{c.name}</span>
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line text-ink-soft transition-colors group-hover:border-ink group-hover:bg-ink group-hover:text-surface">
                              <Icon icon={ArrowRight} size={13} />
                            </span>
                          </span>
                          <span className="flex flex-wrap gap-1.5 text-micro">
                            <span className="rounded-pill bg-brand-soft px-2 py-0.5 font-semibold text-brand-deep">{c.semester}-semestr</span>
                            <span className="rounded-pill bg-surface-raised px-2 py-0.5 text-ink-2">{c.academicYear}</span>
                            {c.groups.map((g) => <span key={g} className="rounded-pill bg-surface-raised px-2 py-0.5 text-ink-2">{g}</span>)}
                          </span>
                          <span className="mt-auto flex items-center gap-1.5 text-note text-ink-soft"><Icon icon={GraduationCap} size={14} /> {c.studentCount}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </BentoCard>
              )}
            </>
          )}
        </AsyncSection>
      )}

      <ConfirmDialog
        open={resetOpen}
        title={t("resetPw")}
        message={t("resetPwConfirm")}
        confirmLabel={t("resetPw")}
        confirmVariant="primary"
        loading={resetPw.isPending}
        onConfirm={() =>
          resetPw.mutate(undefined, {
            onSuccess: (r) => {
              setResetOpen(false);
              setRevealPassword(r.password);
            },
          })
        }
        onClose={() => setResetOpen(false)}
      />
      <PasswordModal password={revealPassword} onClose={() => setRevealPassword(null)} />
    </div>
  );
}
