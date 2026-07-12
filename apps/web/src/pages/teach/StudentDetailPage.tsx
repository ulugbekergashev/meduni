import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, CalendarCheck, Check, ClipboardList, Mail, Stethoscope, Users } from "lucide-react";
import { Badge, Card, Icon, Spinner, cls, type BadgeTone } from "@meduni/ui";
import { AsyncSection } from "../../components/AsyncSection";
import { useLocale, pickName } from "../../lib/useLocale";
import { useStudentDetail, type CellState, type StudentDetailCourse } from "./api";

const stateTone: Record<CellState, BadgeTone> = { COMPLETED: "emerald", IN_PROGRESS: "amber", AVAILABLE: "blue", LOCKED: "slate" };

function AttTile({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return (
    <div className="rounded-card border border-line bg-surface p-3 text-center">
      <p className={cls("text-[22px] font-bold leading-none tabular-nums", tone)}>{value}</p>
      <p className="mt-1 text-[11.5px] text-ink-soft">{label}</p>
    </div>
  );
}

function CourseSection({ course }: { course: StudentDetailCourse }) {
  const { t } = useTranslation(undefined, { keyPrefix: "studentDetail" });
  const locale = useLocale();
  const a = course.attendance;

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-section font-bold text-ink">{pickName(locale, course.subjectNameUz, course.subjectNameRu)}</h2>
        <span className="inline-flex items-center gap-1.5 rounded-pill bg-brand-soft px-3 py-1 text-[13px] font-semibold text-brand-deep">
          {t("progress")}: {course.overallPct}% · {course.completedCount}/{course.topicsTotal}
        </span>
      </div>

      {/* Attendance */}
      <div>
        <h3 className="mb-2 flex items-center gap-1.5 text-[12.5px] font-bold uppercase tracking-wide text-ink-soft"><Icon icon={CalendarCheck} size={14} /> {t("attendance")}</h3>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          <AttTile label={t("att.pct")} value={a.pct !== null ? `${a.pct}%` : "—"} tone={a.pct !== null && a.pct < 75 ? "text-rose" : "text-brand-deep"} />
          <AttTile label={t("att.present")} value={a.present} tone="text-emerald" />
          <AttTile label={t("att.absent")} value={a.absent} tone="text-rose" />
          <AttTile label={t("att.late")} value={a.late} tone="text-amber" />
          <AttTile label={t("att.excused")} value={a.excused} tone="text-blue" />
          <AttTile label={t("att.avgGrade")} value={a.avgGrade ?? "—"} tone="text-ink" />
        </div>
      </div>

      {/* Topics: progress + quiz + case */}
      <div>
        <h3 className="mb-2 text-[12.5px] font-bold uppercase tracking-wide text-ink-soft">{t("work")}</h3>
        {course.topics.length === 0 ? (
          <p className="text-[13px] text-ink-faint">{t("noTopics")}</p>
        ) : (
          <div className="space-y-2">
            {course.topics.map((tp) => (
              <div key={tp.id} className="rounded-control border border-line p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[13.5px] font-semibold text-ink">{pickName(locale, tp.titleUz, tp.titleRu)}</p>
                  <Badge tone={stateTone[tp.state]}>{t(`state.${tp.state}`)}</Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-[12px]">
                  {tp.hasQuiz && (
                    <span className={cls("inline-flex items-center gap-1 rounded-pill px-2 py-0.5 font-medium", tp.quizScore !== null ? "bg-blue-soft text-blue" : "bg-bg text-ink-faint")}>
                      <Icon icon={ClipboardList} size={12} /> {t("quiz")}: {tp.quizScore !== null ? `${tp.quizScore}%` : "—"}
                    </span>
                  )}
                  {tp.hasCase && (
                    <span className={cls("inline-flex items-center gap-1 rounded-pill px-2 py-0.5 font-medium", tp.caseReviewed ? "bg-emerald-soft text-emerald" : tp.caseSubmitted ? "bg-amber-soft text-amber" : "bg-bg text-ink-faint")}>
                      <Icon icon={tp.caseReviewed ? Check : Stethoscope} size={12} /> {t("case")}: {tp.caseReviewed ? tp.caseScore : tp.caseSubmitted ? t("underReview") : "—"}
                    </span>
                  )}
                </div>
                {tp.caseReviewed && tp.caseFeedback && <p className="mt-2 rounded-control bg-emerald-soft px-2.5 py-1.5 text-[12.5px] text-ink">{tp.caseFeedback}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

export function StudentDetailPage() {
  const { id } = useParams();
  const studentId = Number(id);
  const { t } = useTranslation(undefined, { keyPrefix: "studentDetail" });
  const navigate = useNavigate();
  const q = useStudentDetail(studentId);
  const d = q.data;

  return (
    <div className="mx-auto max-w-3xl">
      <button onClick={() => navigate("/teach/groups")} className="mb-3 flex items-center gap-1 text-[13.5px] font-medium text-brand-deep hover:underline">
        <Icon icon={ArrowLeft} size={15} /> {t("back")}
      </button>

      {q.isLoading ? (
        <div className="flex min-h-[40vh] items-center justify-center"><Spinner size={26} /></div>
      ) : (
        <AsyncSection isLoading={false} isError={q.isError} isEmpty={false} emptyText="" onRetry={() => q.refetch()}>
          {d && (
            <>
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[18px] font-bold text-brand-deep">
                  {d.student.fullName.split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("")}
                </div>
                <div className="min-w-0">
                  <h1 className="text-h1 font-bold text-ink">{d.student.fullName}</h1>
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12.5px] text-ink-faint">
                    {d.student.groupName && (
                      d.student.groupId ? (
                        <button onClick={() => navigate(`/teach/groups/${d.student.groupId}`)} className="inline-flex items-center gap-1 text-brand-deep hover:underline">
                          <Icon icon={Users} size={12} /> {d.student.groupName}
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1"><Icon icon={Users} size={12} /> {d.student.groupName}</span>
                      )
                    )}
                    <span className="inline-flex items-center gap-1"><Icon icon={Mail} size={12} /> {d.student.email}</span>
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {d.courses.map((c) => <CourseSection key={c.courseId} course={c} />)}
              </div>
            </>
          )}
        </AsyncSection>
      )}
    </div>
  );
}
