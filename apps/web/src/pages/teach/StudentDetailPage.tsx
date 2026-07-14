import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Check, ClipboardList, Mail, Stethoscope, Users } from "lucide-react";
import { Badge, Card, Icon, ProgressBar, ProgressRing, Spinner, StackedBar, cls, type BadgeTone } from "@meduni/ui";
import { AsyncSection } from "../../components/AsyncSection";
import { useLocale, pickName } from "../../lib/useLocale";
import { useStudentDetail, type CellState, type StudentDetail, type StudentDetailCourse } from "./api";

const stateTone: Record<CellState, BadgeTone> = { COMPLETED: "emerald", IN_PROGRESS: "amber", AVAILABLE: "blue", LOCKED: "slate" };

function CourseSection({ course, onReview }: { course: StudentDetailCourse; onReview: () => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "studentDetail" });
  const locale = useLocale();
  const a = course.attendance;

  return (
    <Card className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-section font-bold text-ink">{pickName(locale, course.subjectNameUz, course.subjectNameRu)}</h2>
          <span className="text-note font-semibold text-ink-soft">{course.completedCount}/{course.topicsTotal} {t("topicsDone")}</span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <ProgressBar value={course.overallPct} className="flex-1" />
          <span className="w-10 shrink-0 text-right text-[13px] font-bold tabular-nums text-ink-soft">{course.overallPct}%</span>
        </div>
      </div>

      {/* Attendance — stacked bar + breakdown */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <h3 className="text-note font-bold uppercase tracking-wide text-ink-soft">{t("attendance")}</h3>
          <span className={cls("text-[13px] font-bold tabular-nums", a.pct !== null && a.pct < 75 ? "text-rose" : "text-brand-deep")}>{a.pct !== null ? `${a.pct}%` : "—"}</span>
        </div>
        <StackedBar
          segments={[
            { value: a.present, tone: "emerald" },
            { value: a.late, tone: "amber" },
            { value: a.excused, tone: "blue" },
            { value: a.absent, tone: "rose" },
          ]}
        />
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-note">
          <span className="text-emerald">● {t("att.present")}: {a.present}</span>
          <span className="text-amber">● {t("att.late")}: {a.late}</span>
          <span className="text-blue">● {t("att.excused")}: {a.excused}</span>
          <span className="text-rose">● {t("att.absent")}: {a.absent}</span>
          {a.avgGrade !== null && <span className="text-ink-soft">{t("att.avgGrade")}: <b className="tabular-nums">{a.avgGrade}</b></span>}
        </div>
      </div>

      {/* Topics */}
      <div>
        <h3 className="mb-2 text-note font-bold uppercase tracking-wide text-ink-soft">{t("work")}</h3>
        {course.topics.length === 0 ? (
          <p className="text-body text-ink-faint">{t("noTopics")}</p>
        ) : (
          <div className="space-y-2">
            {course.topics.map((tp) => {
              const needsReview = tp.hasCase && tp.caseSubmitted && !tp.caseReviewed;
              return (
                <div key={tp.id} className="rounded-control border border-line p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-body font-semibold text-ink">{pickName(locale, tp.titleUz, tp.titleRu)}</p>
                    <Badge tone={stateTone[tp.state]}>{t(`state.${tp.state}`)}</Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <ProgressBar value={tp.pct} className="flex-1" tone={tp.state === "COMPLETED" ? "emerald" : "brand"} />
                    <span className="w-9 shrink-0 text-right text-[11.5px] font-semibold tabular-nums text-ink-faint">{tp.pct}%</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
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
                    {needsReview && (
                      <button onClick={onReview} className="ml-auto inline-flex items-center gap-1 rounded-pill bg-rose-soft px-2.5 py-0.5 font-semibold text-rose transition-colors hover:bg-rose hover:text-white">
                        {t("gradeNow")} →
                      </button>
                    )}
                  </div>
                  {tp.caseReviewed && tp.caseFeedback && <p className="mt-2 rounded-control bg-emerald-soft px-2.5 py-1.5 text-note text-ink">{tp.caseFeedback}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}

function Hero({ d, onGroup }: { d: StudentDetail; onGroup: () => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "studentDetail" });
  const initials = d.student.fullName.split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
  const overall = d.courses.length ? Math.round(d.courses.reduce((a, c) => a + c.overallPct, 0) / d.courses.length) : 0;
  const attVals = d.courses.map((c) => c.attendance.pct).filter((x): x is number => x !== null);
  const attPct = attVals.length ? Math.round(attVals.reduce((a, b) => a + b, 0) / attVals.length) : null;

  return (
    <Card className="flex flex-wrap items-center gap-5">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[18px] font-bold text-brand-deep">{initials}</div>
        <div className="min-w-0">
          <h1 className="truncate text-h1 font-bold text-ink">{d.student.fullName}</h1>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-note text-ink-faint">
            {d.student.groupName &&
              (d.student.groupId ? (
                <button onClick={onGroup} className="inline-flex items-center gap-1 text-brand-deep hover:underline">
                  <Icon icon={Users} size={12} /> {d.student.groupName}
                </button>
              ) : (
                <span className="inline-flex items-center gap-1"><Icon icon={Users} size={12} /> {d.student.groupName}</span>
              ))}
            <span className="inline-flex items-center gap-1"><Icon icon={Mail} size={12} /> {d.student.email}</span>
          </p>
        </div>
      </div>
      <div className="flex items-center gap-5">
        <ProgressRing value={overall} tone="brand" label={t("progress")} />
        <div className="text-center">
          <p className={cls("text-[26px] font-bold leading-none tabular-nums", attPct !== null && attPct < 75 ? "text-rose" : "text-blue")}>{attPct !== null ? `${attPct}%` : "—"}</p>
          <p className="mt-1 text-note text-ink-faint">{t("attendance")}</p>
        </div>
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
      <button onClick={() => navigate("/teach/groups")} className="mb-3 flex items-center gap-1 text-body font-medium text-brand-deep hover:underline">
        <Icon icon={ArrowLeft} size={15} /> {t("back")}
      </button>

      {q.isLoading ? (
        <div className="flex min-h-[40vh] items-center justify-center"><Spinner size={26} /></div>
      ) : (
        <AsyncSection isLoading={false} isError={q.isError} isEmpty={false} emptyText="" onRetry={() => q.refetch()}>
          {d && (
            <>
              <Hero d={d} onGroup={() => d.student.groupId && navigate(`/teach/groups/${d.student.groupId}`)} />
              <div className="mt-4 space-y-4">
                {d.courses.map((c) => (
                  <CourseSection key={c.courseId} course={c} onReview={() => navigate("/teach/cases/review")} />
                ))}
              </div>
            </>
          )}
        </AsyncSection>
      )}
    </div>
  );
}
