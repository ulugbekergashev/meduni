import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BookOpen,
  Building2,
  GraduationCap,
  KeyRound,
  Layers,
  Mail,
  Phone,
  Sparkles,
  Users,
} from "lucide-react";
import { Badge, Button, Card, Icon, LegendRow, ProgressBar, ProgressRing, Spinner, StackedBar, Toggle, cls, useToast } from "@meduni/ui";
import { AsyncSection } from "../../../components/AsyncSection";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { api } from "../../../lib/api";
import { useLocale } from "../../../lib/useLocale";
import { formatDate } from "../../../lib/date";
import { useUserProfile, type StudentProfileCourse, type TeacherProfileCourse } from "../api";
import { PasswordModal } from "./PasswordModal";

function ContactRow({ icon, value }: { icon: typeof Mail; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[14px] text-ink-soft">
      <Icon icon={icon} size={14} className="text-ink-faint" /> {value}
    </span>
  );
}

function MetricTile({ icon, value, label, tone }: { icon: typeof Users; value: number | string; label: string; tone: string }) {
  return (
    <div className="flex items-center gap-3 rounded-card border border-line bg-surface p-4">
      <div className={cls("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", tone)}>
        <Icon icon={icon} size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-[24px] font-bold leading-none tabular-nums text-ink">{value}</p>
        <p className="mt-1 truncate text-[13px] text-ink-soft">{label}</p>
      </div>
    </div>
  );
}

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

  return (
    <div className="mx-auto max-w-4xl">
      <button onClick={() => navigate(-1)} className="mb-3 flex items-center gap-1 text-[14.5px] font-medium text-brand-deep hover:underline">
        <Icon icon={ArrowLeft} size={15} /> {t("back")}
      </button>

      {q.isLoading ? (
        <div className="flex min-h-[40vh] items-center justify-center"><Spinner size={26} /></div>
      ) : (
        <AsyncSection isLoading={false} isError={q.isError} isEmpty={false} emptyText="" onRetry={() => q.refetch()}>
          {p && (
            <>
              {/* Identity card: who + contacts + admin actions */}
              <Card className="flex flex-wrap items-center gap-5 !p-5">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[21px] font-bold text-brand-deep">
                  {p.fullName.split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("")}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-[22px] font-bold leading-tight text-ink">{p.fullName}</h1>
                    <Badge tone={p.kind === "teacher" ? "violet" : p.kind === "student" ? "blue" : "slate"}>
                      {p.kind === "teacher" && p.position ? p.position : t(`kind.${p.kind}`)}
                    </Badge>
                    {!p.isActive && <Badge tone="rose">{t("inactive")}</Badge>}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1">
                    <ContactRow icon={Mail} value={p.email} />
                    {p.phone && <ContactRow icon={Phone} value={p.phone} />}
                    {p.kind === "student" && p.groupName && <ContactRow icon={Users} value={p.groupName} />}
                    {p.kind === "teacher" && p.departmentName && <ContactRow icon={Building2} value={p.departmentName} />}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <label className="flex items-center gap-2 text-[13px] font-medium text-ink-soft">
                    {t("activeLabel")}
                    <Toggle checked={p.isActive} disabled={toggleActive.isPending} aria-label="active" onChange={() => toggleActive.mutate()} />
                  </label>
                  <Button size="sm" variant="ghost" icon={<Icon icon={KeyRound} size={14} />} onClick={() => setResetOpen(true)}>
                    {t("resetPw")}
                  </Button>
                </div>
              </Card>

              {/* ---------- STUDENT ---------- */}
              {p.kind === "student" && (
                <>
                  <div className="mt-4 grid gap-4 lg:grid-cols-5">
                    {/* Overall progress ring */}
                    <Card className="flex items-center justify-center gap-5 lg:col-span-2">
                      <ProgressRing value={overallPct} size={116} stroke={11} label={t("overall")} />
                      <div className="flex flex-col gap-2 text-[14px] text-ink-soft">
                        <span><b className="tabular-nums text-ink">{studentCourses.length}</b> {t("courses")}</span>
                        <span>
                          <b className="tabular-nums text-ink">{studentCourses.reduce((s, c) => s + c.completed, 0)}/{studentCourses.reduce((s, c) => s + c.total, 0)}</b> {t("topicsDone")}
                        </span>
                        {p.lastActiveAt && (
                          <span className="text-[12.5px] text-ink-faint">
                            {t("lastActive")}: {formatDate(locale === "ru" ? "ru" : "uz", p.lastActiveAt, "short")}
                          </span>
                        )}
                      </div>
                    </Card>

                    {/* Attendance breakdown */}
                    <Card className="lg:col-span-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <h2 className="text-section font-bold text-ink">{t("attendance")}</h2>
                        <span
                          className={cls(
                            "text-[20px] font-bold tabular-nums",
                            p.attendancePct === null || p.attendancePct === undefined
                              ? "text-ink-faint"
                              : p.attendancePct < 75
                                ? "text-rose"
                                : "text-emerald"
                          )}
                        >
                          {p.attendancePct === null || p.attendancePct === undefined ? "—" : `${p.attendancePct}%`}
                        </span>
                      </div>
                      {att && att.marked > 0 ? (
                        <>
                          <div className="mt-3">
                            <StackedBar
                              segments={[
                                { value: att.present, tone: "emerald" },
                                { value: att.late, tone: "amber" },
                                { value: att.excused, tone: "blue" },
                                { value: att.absent, tone: "rose" },
                              ]}
                            />
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                            <LegendRow tone="emerald" label={t("att.present")} value={att.present} />
                            <LegendRow tone="amber" label={t("att.late")} value={att.late} />
                            <LegendRow tone="blue" label={t("att.excused")} value={att.excused} />
                            <LegendRow tone="rose" label={t("att.absent")} value={att.absent} />
                          </div>
                        </>
                      ) : (
                        <p className="mt-4 text-[14px] text-ink-faint">{t("noAttendance")}</p>
                      )}
                      {p.avgQuizScore !== null && p.avgQuizScore !== undefined && (
                        <p className="mt-3 flex items-center gap-1.5 border-t border-line pt-3 text-[13.5px] text-ink-soft">
                          <Icon icon={Sparkles} size={14} className="text-blue" />
                          {t("avgQuiz")}: <b className="tabular-nums text-ink">{p.avgQuizScore}%</b>
                        </p>
                      )}
                    </Card>
                  </div>

                  {/* Enrolled courses */}
                  <section className="mt-5">
                    <h2 className="mb-3 text-section font-bold text-ink">{t("studentCourses")}</h2>
                    {studentCourses.length === 0 ? (
                      <Card><p className="py-6 text-center text-[14.5px] text-ink-soft">{t("noCourses")}</p></Card>
                    ) : (
                      <Card className="!p-0">
                        {studentCourses.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => navigate(`/admin/courses/${c.id}`)}
                            className="flex w-full flex-wrap items-center gap-4 border-b border-line px-5 py-3.5 text-left transition-colors last:border-0 hover:bg-bg"
                          >
                            <span className="min-w-[140px] flex-1 text-[15px] font-semibold text-ink">{c.name}</span>
                            <span className="text-[13.5px] tabular-nums text-ink-soft">{c.completed}/{c.total}</span>
                            <div className="w-32"><ProgressBar value={c.progressPct} /></div>
                            <span className="w-12 text-right text-[14px] font-bold tabular-nums text-ink">{c.progressPct}%</span>
                          </button>
                        ))}
                      </Card>
                    )}
                  </section>
                </>
              )}

              {/* ---------- TEACHER ---------- */}
              {p.kind === "teacher" && p.stats && (
                <>
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <MetricTile icon={BookOpen} value={p.stats.courses} label={t("courses")} tone="bg-brand-soft text-brand-deep" />
                    <MetricTile icon={GraduationCap} value={p.stats.students} label={t("students")} tone="bg-blue-soft text-blue" />
                    <MetricTile icon={Layers} value={p.stats.publishedTopics} label={t("publishedTopics")} tone="bg-emerald-soft text-emerald" />
                  </div>
                  <section className="mt-5">
                    <h2 className="mb-3 text-section font-bold text-ink">{t("teacherCourses")}</h2>
                    {(p.courses ?? []).length === 0 ? (
                      <Card><p className="py-6 text-center text-[14.5px] text-ink-soft">{t("noCourses")}</p></Card>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {(p.courses as TeacherProfileCourse[]).map((c) => (
                          <Card key={c.id} interactive onClick={() => navigate(`/admin/courses/${c.id}`)} className="flex flex-col gap-2">
                            <h3 className="text-[16px] font-bold text-ink">{c.name}</h3>
                            <div className="flex flex-wrap gap-1.5 text-[13px]">
                              <span className="rounded-pill bg-brand-soft px-2 py-0.5 font-semibold text-brand-deep">{c.semester}-semestr</span>
                              <span className="rounded-pill bg-bg px-2 py-0.5 text-ink-soft">{c.academicYear}</span>
                              {c.groups.map((g) => <span key={g} className="rounded-pill bg-bg px-2 py-0.5 text-ink-soft">{g}</span>)}
                            </div>
                            <span className="mt-auto flex items-center gap-1.5 text-[13.5px] text-ink-soft"><Icon icon={GraduationCap} size={14} /> {c.studentCount}</span>
                          </Card>
                        ))}
                      </div>
                    )}
                  </section>
                </>
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
