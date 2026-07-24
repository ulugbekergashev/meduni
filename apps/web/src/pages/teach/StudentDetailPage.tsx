import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Check, ClipboardList, ListPlus, Mail, Stethoscope, Users, BookOpen } from "lucide-react";
import { Badge, Icon, ProgressBar, ProgressRing, Spinner, StackedBar, cls, type BadgeTone } from "@meduni/ui";
import { AsyncSection } from "../../components/AsyncSection";
import { QuickTaskModal } from "../../components/QuickTaskModal";
import { useStudentDetail, type CellState, type StudentDetail, type StudentDetailCourse } from "./api";

const stateTone: Record<CellState, BadgeTone> = { COMPLETED: "emerald", IN_PROGRESS: "amber", AVAILABLE: "blue", LOCKED: "slate" };

function CourseSection({ course, onReview }: { course: StudentDetailCourse; onReview: () => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "studentDetail" });
  const a = course.attendance;

  return (
    <div className="group/course space-y-7 rounded-[28px] border border-line bg-surface p-6 shadow-sm ring-1 ring-line transition-all duration-300 hover:bg-surface-raised hover:shadow-md sm:p-8">
      <div>
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="min-w-0 flex-1">
            <h2 className="text-[24px] font-black tracking-tight text-ink drop-shadow-sm transition-colors group-hover/course:text-brand-deep sm:text-[28px]">{course.subjectName}</h2>
            <p className="mt-2 flex items-center gap-2 text-[14px] font-bold text-ink-soft">
              <span className="rounded-full bg-brand-soft px-3 py-1 text-[13px] text-brand-deep shadow-sm ring-1 ring-brand/10">{course.completedCount}/{course.topicsTotal}</span>
              {t("topicsDone")}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-[40%]">
            <div className="flex items-center justify-between text-[14px] font-black text-ink-soft">
              <span>{t("progress")}</span>
              <span className="text-[16px] text-brand-deep">{course.overallPct}%</span>
            </div>
            <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-black/5 shadow-inner">
              <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-brand via-brand-tint to-violet transition-all duration-700 ease-out" style={{ width: `${Math.max(course.overallPct, 2)}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Attendance — stacked bar + breakdown */}
      <div className="rounded-[20px] bg-surface-glass p-5 ring-1 ring-line">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-[14px] font-black uppercase tracking-widest text-ink-soft">
            <Icon icon={ClipboardList} size={16} className="text-brand-soft" /> {t("attendance")}
          </h3>
          <span className={cls("flex items-center justify-center rounded-full bg-surface px-4 py-1.5 text-[15.5px] font-black tabular-nums shadow-sm ring-1 ring-line", a.pct !== null && a.pct < 75 ? "text-rose" : "text-brand-deep")}>{a.pct !== null ? `${a.pct}%` : "—"}</span>
        </div>
        <div className="h-3 rounded-full shadow-inner overflow-hidden">
          <StackedBar
            segments={[
              { value: a.present, tone: "emerald" },
              { value: a.late, tone: "amber" },
              { value: a.excused, tone: "blue" },
              { value: a.absent, tone: "rose" },
            ]}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[13px] font-bold">
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 ring-1 ring-emerald/20"><div className="h-2 w-2 rounded-full bg-emerald shadow-sm" /> {t("att.present")}: {a.present}</span>
          <span className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-amber-700 ring-1 ring-amber/20"><div className="h-2 w-2 rounded-full bg-amber shadow-sm" /> {t("att.late")}: {a.late}</span>
          <span className="flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-blue-700 ring-1 ring-blue/20"><div className="h-2 w-2 rounded-full bg-blue shadow-sm" /> {t("att.excused")}: {a.excused}</span>
          <span className="flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-rose-700 ring-1 ring-rose/20"><div className="h-2 w-2 rounded-full bg-rose shadow-sm" /> {t("att.absent")}: {a.absent}</span>
          {a.avgGrade !== null && <span className="ml-auto flex items-center gap-2 rounded-full bg-surface px-3 py-1 text-ink-soft ring-1 ring-line">{t("att.avgGrade")}: <b className="text-[14px] tabular-nums text-ink">{a.avgGrade}</b></span>}
        </div>
      </div>

      {/* Topics */}
      <div>
        <h3 className="mb-4 flex items-center gap-2 text-[14px] font-black uppercase tracking-widest text-ink-soft">
          <Icon icon={BookOpen} size={16} className="text-violet-400" /> {t("work")}
        </h3>
        {course.topics.length === 0 ? (
          <p className="rounded-[16px] border border-dashed border-line bg-surface-glass py-8 text-center text-[15px] font-medium text-ink-faint">{t("noTopics")}</p>
        ) : (
          <div className="space-y-3">
            {course.topics.map((tp) => {
              const needsReview = tp.hasCase && tp.caseSubmitted && !tp.caseReviewed;
              return (
                <div key={tp.id} className="group/topic overflow-hidden rounded-[20px] border border-line bg-surface px-5 py-5 shadow-sm ring-1 ring-line transition-all hover:-translate-y-1 hover:bg-surface-glass hover:shadow-md hover:ring-brand/20">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="min-w-0 flex-1 truncate text-[17px] font-bold text-ink transition-colors group-hover/topic:text-brand-deep">{tp.title}</p>
                    <Badge tone={stateTone[tp.state]}>{t(`state.${tp.state}`)}</Badge>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <ProgressBar value={tp.pct} className="flex-1 h-2 shadow-inner" tone={tp.state === "COMPLETED" ? "emerald" : "brand"} />
                    <span className="w-10 shrink-0 text-right text-[13.5px] font-bold tabular-nums text-ink-soft">{tp.pct}%</span>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2.5 text-[13px]">
                    {tp.hasQuiz && (
                      <span className={cls("inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-bold shadow-sm ring-1", tp.quizScore !== null ? "bg-blue-50 text-blue-700 ring-blue/20" : "bg-bg text-ink-faint ring-line")}>
                        <Icon icon={ClipboardList} size={14} /> {t("quiz")}: {tp.quizScore !== null ? `${tp.quizScore}%` : "—"}
                      </span>
                    )}
                    {tp.hasCase && (
                      <span className={cls("inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-bold shadow-sm ring-1", tp.caseReviewed ? "bg-emerald-50 text-emerald-700 ring-emerald/20" : tp.caseSubmitted ? "bg-amber-50 text-amber-700 ring-amber/20" : "bg-bg text-ink-faint ring-line")}>
                        <Icon icon={tp.caseReviewed ? Check : Stethoscope} size={14} /> {t("case")}: {tp.caseReviewed ? tp.caseScore : tp.caseSubmitted ? t("underReview") : "—"}
                      </span>
                    )}
                    {needsReview && (
                      <button onClick={onReview} className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-rose px-4 py-1 font-bold text-white shadow-sm ring-1 ring-rose/50 transition-all hover:-translate-y-0.5 hover:bg-rose-600 hover:shadow-md">
                        {t("gradeNow")} &rarr;
                      </button>
                    )}
                  </div>
                  {tp.caseReviewed && tp.caseFeedback && (
                    <div className="mt-4 flex gap-3 rounded-[16px] bg-emerald-50/50 p-4 ring-1 ring-emerald/10">
                      <Icon icon={Check} size={18} className="shrink-0 text-emerald" />
                      <p className="text-[14px] font-medium leading-relaxed text-emerald-900">{tp.caseFeedback}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, subtext, icon, tone }: { label: string; value: React.ReactNode; subtext?: string; icon: any; tone: "brand" | "emerald" | "amber" | "rose" | "blue" | "violet" }) {
  const tones: Record<string, string> = {
    brand: "bg-brand-soft text-brand-deep",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-600",
    blue: "bg-blue-50 text-blue-600",
    violet: "bg-violet-50 text-violet-600",
  };
  return (
    <div className="flex flex-col justify-between rounded-[24px] bg-surface p-5 shadow-sm ring-1 ring-line transition-all hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-black uppercase tracking-widest text-ink-faint">{label}</p>
          <p className="mt-1 text-[24px] font-black tabular-nums text-ink sm:text-[28px]">{value}</p>
        </div>
        <div className={cls("flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-sm ring-1 ring-black/5", tones[tone])}>
          <Icon icon={icon} size={20} />
        </div>
      </div>
      {subtext && <p className="mt-4 text-[12px] font-bold text-ink-soft">{subtext}</p>}
    </div>
  );
}

function ProfileCard({ d, onGroup, onAssign }: { d: StudentDetail; onGroup: () => void; onAssign: () => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "studentDetail" });
  const initials = d.student.fullName.split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
  const overall = d.courses.length ? Math.round(d.courses.reduce((a, c) => a + c.overallPct, 0) / d.courses.length) : 0;

  return (
    <div className="overflow-hidden rounded-[32px] bg-surface shadow-sm ring-1 ring-line">
      {/* Top Banner */}
      <div className="h-[140px] w-full bg-gradient-to-br from-brand via-brand-tint to-violet-500" />
      
      {/* Profile Details */}
      <div className="px-6 pb-8 text-center">
        {/* Avatar */}
        <div className="mx-auto -mt-[60px] mb-5 flex h-[120px] w-[120px] items-center justify-center rounded-[36px] bg-surface p-2 shadow-sm ring-1 ring-line">
          <div className="flex h-full w-full items-center justify-center rounded-[28px] bg-gradient-to-br from-brand-soft to-violet-100 text-[40px] font-black text-brand-deep shadow-inner ring-1 ring-brand/20">
            {initials}
          </div>
        </div>

        <h1 className="text-[22px] font-black tracking-tight text-ink drop-shadow-sm">{d.student.fullName}</h1>
        <p className="mb-5 mt-1 flex items-center justify-center gap-1.5 text-[14px] font-bold text-ink-faint">
          <Icon icon={Mail} size={14} /> {d.student.email}
        </p>

        <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
          <Badge tone="emerald">FAOL</Badge>
          {d.student.groupName && (
            <button onClick={onGroup} className="transition-transform hover:scale-105">
               <Badge tone="brand"><div className="flex items-center gap-1.5"><Icon icon={Users} size={12}/> {d.student.groupName}</div></Badge>
            </button>
          )}
        </div>

        <div className="mb-6 rounded-[20px] bg-surface-glass p-5 text-center shadow-sm ring-1 ring-line">
          <p className="text-[11px] font-black uppercase tracking-widest text-ink-faint mb-3">O'ZLASHTIRISH</p>
          <div className="flex justify-center">
            <ProgressRing value={overall} size={84} stroke={8} tone="brand" />
          </div>
        </div>

        <button onClick={onAssign} className="flex w-full items-center justify-center gap-2 rounded-full bg-brand px-5 py-3.5 text-[14.5px] font-bold text-white shadow-sm ring-1 ring-brand/50 transition-all hover:-translate-y-1 hover:bg-brand-deep hover:shadow-md hover:ring-brand">
          <Icon icon={ListPlus} size={18} /> {t("assignTask")}
        </button>
      </div>
    </div>
  );
}

export function StudentDetailPage() {
  const { id } = useParams();
  const studentId = Number(id);
  const { t } = useTranslation(undefined, { keyPrefix: "studentDetail" });
  const navigate = useNavigate();
  const q = useStudentDetail(studentId);
  const d = q.data;
  const [assign, setAssign] = useState(false);

  return (
    <div className="relative z-0 min-h-[80vh] pb-10">
      {/* Background blobs for premium feel */}
      <div className="pointer-events-none fixed left-0 top-0 -z-10 h-full w-full overflow-hidden bg-bg">
        <div className="absolute right-[5%] top-[10%] h-[500px] w-[500px] rounded-full bg-brand/5 blur-[100px]" />
        <div className="absolute bottom-[10%] left-[5%] h-[400px] w-[400px] rounded-full bg-violet-400/5 blur-[120px]" />
      </div>

      <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
        <button onClick={() => navigate("/teach/groups")} className="mb-6 inline-flex items-center gap-2 rounded-full bg-surface-raised px-4 py-2 text-[14px] font-bold text-ink-soft shadow-sm ring-1 ring-line transition-all hover:-translate-x-1 hover:bg-surface-glass hover:text-brand hover:shadow-md hover:ring-brand/30">
          <Icon icon={ArrowLeft} size={16} /> {t("back")}
        </button>

        {q.isLoading ? (
          <div className="flex min-h-[40vh] items-center justify-center"><Spinner size={32} className="text-brand" /></div>
        ) : (
          <AsyncSection isLoading={false} isError={q.isError} isEmpty={false} emptyText="" onRetry={() => q.refetch()}>
            {d && (() => {
              const attVals = d.courses.map((c) => c.attendance.pct).filter((x): x is number => x !== null);
              const attPct = attVals.length ? Math.round(attVals.reduce((a, b) => a + b, 0) / attVals.length) : null;
              
              return (
                <div className="flex flex-col items-start gap-6 lg:flex-row lg:gap-8">
                  {/* Left Column: Profile Card */}
                  <div className="w-full shrink-0 lg:w-[320px] xl:w-[360px]">
                    <ProfileCard
                      d={d}
                      onGroup={() => d.student.groupId && navigate(`/teach/groups/${d.student.groupId}`)}
                      onAssign={() => setAssign(true)}
                    />
                  </div>

                  {/* Right Column: Stats and Courses */}
                  <div className="min-w-0 flex-1 space-y-6 w-full">
                    {/* Top Stats Row */}
                    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                      <StatCard label={t("attendance")} value={attPct !== null ? `${attPct}%` : "—"} subtext="O'rtacha ko'rsatkich" icon={ClipboardList} tone="blue" />
                      <StatCard 
                        label={t("practicePatient")} 
                        value={
                          <span className="flex items-baseline gap-1.5">
                            <span>{d.practiceSignals.patientSessions}</span>
                            {d.practiceSignals.patientAvgScore !== null && (
                              <span className="text-[13px] font-bold text-rose-600">Avg: {d.practiceSignals.patientAvgScore}</span>
                            )}
                          </span>
                        } 
                        subtext="Virtual bemor seansi" 
                        icon={Stethoscope} 
                        tone="rose" 
                      />
                      <StatCard 
                        label={t("practiceCards")} 
                        value={
                          <span className="flex items-baseline gap-1.5">
                            <span>{d.practiceSignals.cardsReviewed}</span>
                            {d.practiceSignals.cardsKnownPct !== null && (
                              <span className="text-[13px] font-bold text-emerald">{d.practiceSignals.cardsKnownPct}%</span>
                            )}
                          </span>
                        } 
                        subtext="Fleshkarta takrorlash" 
                        icon={Check} 
                        tone="emerald" 
                      />
                      <StatCard label={t("practiceTutor")} value={d.practiceSignals.tutorQuestions} subtext="Tutor savollari" icon={BookOpen} tone="violet" />
                    </div>

                    {/* Split Content Area to utilize screen space */}
                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                      {/* Active Courses List (takes 2 cols) */}
                      <div className="space-y-4 xl:col-span-2">
                        <div className="flex items-center justify-between">
                          <h3 className="text-[14px] font-black uppercase tracking-widest text-ink-soft">FAOL KURSLAR</h3>
                          <span className="text-[12px] font-bold text-ink-faint">{d.courses.length} ta kurs</span>
                        </div>
                        <div className="space-y-4">
                          {d.courses.map((c) => (
                            <CourseSection key={c.courseId} course={c} onReview={() => navigate("/teach/cases/review")} />
                          ))}
                        </div>
                      </div>

                      {/* Practice Details & Additional stats sidebar (takes 1 col) */}
                      <div className="space-y-6">
                        {/* Practice Signals detail list */}
                        <div className="rounded-[24px] bg-surface p-6 ring-1 ring-line shadow-sm">
                          <h3 className="text-[13px] font-black uppercase tracking-widest text-ink-soft mb-4">AMALIYOT FAOLLIGI</h3>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 rounded-[16px] bg-surface-glass ring-1 ring-line">
                              <div className="flex items-center gap-3">
                                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-violet-600 shadow-sm"><Icon icon={Check} size={15} /></span>
                                <div>
                                  <p className="text-[13px] font-bold text-ink">{t("practiceCards")}</p>
                                  <p className="text-[10px] font-medium text-ink-faint">Ko'rib chiqilgan kartalar</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-[14px] font-black text-ink">{d.practiceSignals.cardsReviewed}</p>
                                {d.practiceSignals.cardsKnownPct !== null && <p className="text-[10px] font-bold text-emerald">{d.practiceSignals.cardsKnownPct}% biladi</p>}
                              </div>
                            </div>

                            <div className="flex items-center justify-between p-3 rounded-[16px] bg-surface-glass ring-1 ring-line">
                              <div className="flex items-center gap-3">
                                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-50 text-rose-600 shadow-sm"><Icon icon={Stethoscope} size={15} /></span>
                                <div>
                                  <p className="text-[13px] font-bold text-ink">{t("practicePatient")}</p>
                                  <p className="text-[10px] font-medium text-ink-faint">Mashq seanslari</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-[14px] font-black text-ink">{d.practiceSignals.patientSessions}</p>
                                {d.practiceSignals.patientAvgScore !== null && <p className="text-[10px] font-bold text-brand-deep">O'rtacha: {d.practiceSignals.patientAvgScore}</p>}
                              </div>
                            </div>

                            <div className="flex items-center justify-between p-3 rounded-[16px] bg-surface-glass ring-1 ring-line">
                              <div className="flex items-center gap-3">
                                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600 shadow-sm"><Icon icon={ClipboardList} size={15} /></span>
                                <div>
                                  <p className="text-[13px] font-bold text-ink">{t("practiceTutor")}</p>
                                  <p className="text-[10px] font-medium text-ink-faint">Tutor savollari</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-[14px] font-black text-ink">{d.practiceSignals.tutorQuestions}</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Guruh details widget */}
                        <div className="rounded-[24px] bg-surface p-6 ring-1 ring-line shadow-sm">
                          <h3 className="text-[13px] font-black uppercase tracking-widest text-ink-soft mb-4">AKADEMIK HOLAT</h3>
                          <div className="space-y-3 text-[13.5px]">
                            <div className="flex justify-between py-1.5 border-b border-line/50">
                              <span className="text-ink-faint">Guruh</span>
                              <span className="font-bold text-ink">{d.student.groupName ?? 'Kiritilmagan'}</span>
                            </div>
                            <div className="flex justify-between py-1.5 border-b border-line/50">
                              <span className="text-ink-faint">Kurslar soni</span>
                              <span className="font-bold text-ink">{d.courses.length} ta kurs</span>
                            </div>
                            <div className="flex justify-between py-1.5">
                              <span className="text-ink-faint">Davomat foizi</span>
                              <span className="font-bold text-ink">{attPct !== null ? `${attPct}%` : '—'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </AsyncSection>
        )}

      {d && (
        <QuickTaskModal
          open={assign}
          onClose={() => setAssign(false)}
          prefill={{ studentId: d.student.id, studentName: d.student.fullName }}
        />
      )}
      </div>
    </div>
  );
}
