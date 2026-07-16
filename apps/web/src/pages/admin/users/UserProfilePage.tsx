import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, BookOpen, Building2, CalendarCheck, GraduationCap, Layers, Mail, Phone, Users } from "lucide-react";
import { Badge, Card, Icon, Spinner, cls } from "@meduni/ui";
import { AsyncSection } from "../../../components/AsyncSection";
import { useUserProfile, type StudentProfileCourse, type TeacherProfileCourse } from "../api";

function Row({ icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <Icon icon={icon} size={15} className="shrink-0 text-ink-faint" />
      <span className="w-24 shrink-0 text-[12.5px] text-ink-faint">{label}</span>
      <span className="truncate text-[13.5px] font-medium text-ink">{value}</span>
    </div>
  );
}

function StatTile({ icon, value, label, tone }: { icon: typeof Users; value: number | string; label: string; tone: string }) {
  return (
    <div className="flex items-center gap-3 rounded-card border border-line bg-surface p-3.5">
      <div className={cls("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", tone)}>
        <Icon icon={icon} size={18} />
      </div>
      <div>
        <p className="text-[22px] font-bold leading-none tabular-nums text-ink">{value}</p>
        <p className="mt-0.5 text-[12px] text-ink-soft">{label}</p>
      </div>
    </div>
  );
}

export function UserProfilePage() {
  const { id } = useParams();
  const userId = Number(id);
  const { t } = useTranslation(undefined, { keyPrefix: "userProfile" });
  const navigate = useNavigate();
  const q = useUserProfile(userId);
  const p = q.data;

  return (
    <div className="mx-auto max-w-3xl">
      <button onClick={() => navigate("/admin/users")} className="mb-3 flex items-center gap-1 text-[13.5px] font-medium text-brand-deep hover:underline">
        <Icon icon={ArrowLeft} size={15} /> {t("back")}
      </button>

      {q.isLoading ? (
        <div className="flex min-h-[40vh] items-center justify-center"><Spinner size={26} /></div>
      ) : (
        <AsyncSection isLoading={false} isError={q.isError} isEmpty={false} emptyText="" onRetry={() => q.refetch()}>
          {p && (
            <>
              {/* Header */}
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[20px] font-bold text-brand-deep">
                  {p.fullName.split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("")}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-h1 font-bold text-ink">{p.fullName}</h1>
                    <Badge tone={p.kind === "teacher" ? "violet" : p.kind === "student" ? "blue" : "rose"}>{t(`kind.${p.kind}`)}</Badge>
                    {!p.isActive && <Badge tone="slate">{t("inactive")}</Badge>}
                  </div>
                  <div className="mt-1">
                    <Row icon={Mail} label="Email" value={p.email} />
                    {p.phone && <Row icon={Phone} label={t("phone")} value={p.phone} />}
                    {p.kind === "student" && p.groupName && <Row icon={Users} label={t("group")} value={p.groupName} />}
                    {p.kind === "teacher" && p.departmentName && (
                      <Row icon={Building2} label={t("department")} value={p.departmentName} />
                    )}
                  </div>
                </div>
              </div>

              {/* Teacher: stats + courses */}
              {p.kind === "teacher" && p.stats && (
                <>
                  <div className="mt-6 grid grid-cols-3 gap-3">
                    <StatTile icon={BookOpen} value={p.stats.courses} label={t("courses")} tone="bg-brand-soft text-brand-deep" />
                    <StatTile icon={GraduationCap} value={p.stats.students} label={t("students")} tone="bg-blue-soft text-blue" />
                    <StatTile icon={Layers} value={p.stats.publishedTopics} label={t("publishedTopics")} tone="bg-emerald-soft text-emerald" />
                  </div>
                  <section className="mt-6">
                    <h2 className="mb-3 text-section font-bold text-ink">{t("teacherCourses")}</h2>
                    {(p.courses ?? []).length === 0 ? (
                      <Card><p className="py-6 text-center text-[13.5px] text-ink-soft">{t("noCourses")}</p></Card>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {(p.courses as TeacherProfileCourse[]).map((c) => (
                          <Card key={c.id} interactive onClick={() => navigate(`/admin/courses/${c.id}`)} className="flex flex-col gap-2">
                            <h3 className="text-[15px] font-bold text-ink">{c.subjectName}</h3>
                            <div className="flex flex-wrap gap-1.5 text-[12px]">
                              <span className="rounded-pill bg-brand-soft px-2 py-0.5 font-semibold text-brand-deep">{c.semester}-semestr</span>
                              <span className="rounded-pill bg-bg px-2 py-0.5 text-ink-soft">{c.academicYear}</span>
                              {c.groups.map((g) => <span key={g} className="rounded-pill bg-bg px-2 py-0.5 text-ink-soft">{g}</span>)}
                            </div>
                            <span className="mt-auto flex items-center gap-1.5 text-[12.5px] text-ink-soft"><Icon icon={GraduationCap} size={14} /> {c.studentCount}</span>
                          </Card>
                        ))}
                      </div>
                    )}
                  </section>
                </>
              )}

              {/* Student: attendance + enrolled courses */}
              {p.kind === "student" && (
                <>
                  <div className="mt-6 grid grid-cols-2 gap-3 sm:max-w-sm">
                    <StatTile icon={BookOpen} value={(p.courses ?? []).length} label={t("courses")} tone="bg-brand-soft text-brand-deep" />
                    <StatTile icon={CalendarCheck} value={p.attendancePct !== null && p.attendancePct !== undefined ? `${p.attendancePct}%` : "—"} label={t("attendance")} tone="bg-blue-soft text-blue" />
                  </div>
                  <section className="mt-6">
                    <h2 className="mb-3 text-section font-bold text-ink">{t("studentCourses")}</h2>
                    {(p.courses ?? []).length === 0 ? (
                      <Card><p className="py-6 text-center text-[13.5px] text-ink-soft">{t("noCourses")}</p></Card>
                    ) : (
                      <div className="space-y-2">
                        {(p.courses as StudentProfileCourse[]).map((c) => (
                          <Card key={c.id} interactive onClick={() => navigate(`/admin/courses/${c.id}`)} className="flex flex-wrap items-center gap-4 py-3">
                            <span className="min-w-[140px] flex-1 text-[14px] font-semibold text-ink">{c.subjectName}</span>
                            <span className="text-[12.5px] text-ink-soft">{c.completed}/{c.total}</span>
                            <div className="h-1.5 w-28 overflow-hidden rounded-pill bg-bg">
                              <div className="h-full rounded-pill bg-brand" style={{ width: `${Math.max(c.progressPct, 2)}%` }} />
                            </div>
                            <span className="w-12 text-right text-[13px] font-bold tabular-nums text-ink">{c.progressPct}%</span>
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
    </div>
  );
}
