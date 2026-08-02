import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle, ArrowLeft, BookOpen, Check, ClipboardList, GraduationCap, ListPlus,
  Lock, LockOpen, Mail, MessageCircle, Stethoscope, Users, X,
} from "lucide-react";
import {
  Badge, Button, Card, Icon, Input, ProgressBar, ProgressRing, Spinner, StackedBar,
  cls, useToast, type BadgeTone,
} from "@meduni/ui";
import { AsyncSection } from "../../components/AsyncSection";
import { SubNav } from "../../components/SubNav";
import { QuickTaskModal, type QuickTaskPrefill } from "../../components/QuickTaskModal";
import { formatDate } from "../../lib/date";
import { useLocale } from "../../lib/useLocale";
import { apiErrorMessage } from "../../lib/api";
import {
  useGradeSession, useStudentDetail, useUnlockForStudent,
  type AttStatus, type CellState, type StudentDetailCourse,
  type StudentDetailSession, type StudentDetailTopic,
} from "./api";

const stateTone: Record<CellState, BadgeTone> = { COMPLETED: "emerald", IN_PROGRESS: "amber", AVAILABLE: "blue", LOCKED: "slate" };
const attTone: Record<AttStatus, string> = {
  PRESENT: "bg-emerald-soft text-emerald",
  ABSENT: "bg-rose-soft text-rose",
  LATE: "bg-amber-soft text-amber",
  EXCUSED: "bg-blue-soft text-blue",
};

type TabKey = "overview" | "courses" | "journal";

/* ============================ Amaliyot faolligi ============================ */
function PracticeRow({ icon, tone, label, hint, value, sub }: {
  icon: any; tone: string; label: string; hint: string; value: React.ReactNode; sub?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-control bg-bg px-3 py-2.5">
      <span className={cls("flex h-9 w-9 shrink-0 items-center justify-center rounded-control", tone)}><Icon icon={icon} size={16} /></span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-note font-semibold text-ink">{label}</p>
        <p className="truncate text-micro text-ink-faint">{hint}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-body font-bold tabular-nums text-ink">{value}</p>
        {sub && <p className="text-micro font-semibold text-ink-soft">{sub}</p>}
      </div>
    </div>
  );
}

/* ============================ Diqqat talab qiladigan ishlar ============================ */
interface Attention {
  courseId: number; courseName: string; topic: StudentDetailTopic;
  kind: "grade" | "unlock";
}

function AttentionList({ items, onGrade, onUnlock, onAssign, unlockPending }: {
  items: Attention[];
  onGrade: (caseAttemptId: number) => void;
  onUnlock: (courseId: number, topicId: number) => void;
  onAssign: (p: QuickTaskPrefill) => void;
  unlockPending: number | null;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "studentDetail" });
  const locale = useLocale();
  if (items.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-control bg-emerald-soft px-4 py-3">
        <Icon icon={Check} size={18} className="text-emerald" />
        <p className="text-note font-semibold text-emerald">{t("noAttention")}</p>
      </div>
    );
  }
  return (
    <div className="divide-y divide-line">
      {items.map((a) => (
        <div key={`${a.kind}-${a.courseId}-${a.topic.id}`} className="flex flex-wrap items-center gap-2 py-2.5">
          <span className={cls("flex h-8 w-8 shrink-0 items-center justify-center rounded-control", a.kind === "grade" ? "bg-rose-soft text-rose" : "bg-slate-100 text-ink-soft")}>
            <Icon icon={a.kind === "grade" ? Stethoscope : Lock} size={15} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-note font-semibold text-ink">{a.topic.title}</p>
            <p className="truncate text-micro text-ink-faint">
              {a.courseName} · {a.kind === "grade" ? t("caseWaiting") : a.topic.reason ? a.topic.reason[locale] : t("state.LOCKED")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {a.kind === "grade" ? (
              <Button size="sm" variant="danger" onClick={() => a.topic.caseAttemptId && onGrade(a.topic.caseAttemptId)}>{t("gradeNow")}</Button>
            ) : (
              <Button size="sm" variant="soft" icon={<Icon icon={LockOpen} size={14} />} disabled={unlockPending === a.topic.id} onClick={() => onUnlock(a.courseId, a.topic.id)}>{t("unlock")}</Button>
            )}
            <Button size="sm" variant="ghost" icon={<Icon icon={ListPlus} size={14} />} onClick={() => onAssign({ title: a.topic.title })}>{t("task")}</Button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============================ Kurs → mavzular ro'yxati ============================ */
function TopicRow({ tp, courseId, onGrade, onUnlock, onAssign, unlockPending }: {
  tp: StudentDetailTopic; courseId: number;
  onGrade: (id: number) => void;
  onUnlock: (courseId: number, topicId: number) => void;
  onAssign: (p: QuickTaskPrefill) => void;
  unlockPending: number | null;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "studentDetail" });
  const locale = useLocale();
  const needsReview = tp.hasCase && tp.caseSubmitted && !tp.caseReviewed;
  return (
    <div className="px-3 py-3 transition-colors hover:bg-bg">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-note font-semibold text-ink">{tp.title}</p>
        <Badge tone={stateTone[tp.state]}>{t(`state.${tp.state}`)}</Badge>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <ProgressBar value={tp.pct} className="flex-1" tone={tp.state === "COMPLETED" ? "emerald" : "brand"} />
        <span className="w-9 shrink-0 text-right text-micro font-bold tabular-nums text-ink-soft">{tp.pct}%</span>
      </div>
      {tp.state === "LOCKED" && tp.reason && (
        <p className="mt-1.5 flex items-center gap-1.5 text-micro text-ink-faint"><Icon icon={Lock} size={12} /> {tp.reason[locale]}</p>
      )}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {tp.hasQuiz && (
          <span className={cls("inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-micro font-semibold", tp.quizScore !== null ? "bg-blue-soft text-blue" : "bg-bg text-ink-faint")}>
            <Icon icon={ClipboardList} size={12} /> {t("quiz")}: {tp.quizScore !== null ? `${tp.quizScore}%` : "—"}
          </span>
        )}
        {tp.hasCase && (
          <span className={cls("inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-micro font-semibold", tp.caseReviewed ? "bg-emerald-soft text-emerald" : tp.caseSubmitted ? "bg-amber-soft text-amber" : "bg-bg text-ink-faint")}>
            <Icon icon={tp.caseReviewed ? Check : Stethoscope} size={12} /> {t("case")}: {tp.caseReviewed ? tp.caseScore : tp.caseSubmitted ? t("underReview") : "—"}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {needsReview && <Button size="sm" variant="danger" onClick={() => tp.caseAttemptId && onGrade(tp.caseAttemptId)}>{t("gradeNow")}</Button>}
          {tp.state === "LOCKED" && (
            <Button size="sm" variant="soft" icon={<Icon icon={LockOpen} size={13} />} disabled={unlockPending === tp.id} onClick={() => onUnlock(courseId, tp.id)}>{t("unlock")}</Button>
          )}
          <button onClick={() => onAssign({ title: tp.title })} title={t("task")} className="rounded-control p-1.5 text-ink-soft transition-colors hover:bg-brand-soft hover:text-brand-deep">
            <Icon icon={ListPlus} size={15} />
          </button>
        </div>
      </div>
      {tp.caseReviewed && tp.caseFeedback && (
        <div className="mt-2 flex gap-2 rounded-control bg-emerald-soft/60 px-3 py-2">
          <Icon icon={MessageCircle} size={14} className="mt-0.5 shrink-0 text-emerald" />
          <p className="text-micro leading-relaxed text-ink">{tp.caseFeedback}</p>
        </div>
      )}
    </div>
  );
}

function CourseBlock({ course, children, right }: { course: StudentDetailCourse; children: React.ReactNode; right?: React.ReactNode }) {
  const { t } = useTranslation(undefined, { keyPrefix: "studentDetail" });
  return (
    <Card className="!p-0">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-section font-bold text-ink">{course.subjectName}</h3>
          <p className="text-micro text-ink-soft">{course.completedCount}/{course.topicsTotal} {t("topicsDone")}</p>
        </div>
        {right ?? (
          <div className="flex w-40 items-center gap-2">
            <ProgressBar value={course.overallPct} className="flex-1" />
            <span className="w-9 shrink-0 text-right text-note font-bold tabular-nums text-brand-deep">{course.overallPct}%</span>
          </div>
        )}
      </div>
      {children}
    </Card>
  );
}

/* ============================ Davomat jurnali (inline baho) ============================ */
function JournalRow({ s, studentId, courseId }: { s: StudentDetailSession; studentId: number; courseId: number }) {
  const { t } = useTranslation(undefined, { keyPrefix: "studentDetail" });
  const { t: tc } = useTranslation(undefined, { keyPrefix: "common" });
  const locale = useLocale();
  const { show } = useToast();
  const grade = useGradeSession(studentId);
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(s.grade === null ? "" : String(s.grade));

  const save = () => {
    const n = val.trim() === "" ? null : Number(val);
    if (n !== null && (!Number.isFinite(n) || n < 0 || n > 100)) { show(t("gradeRange"), "warn"); return; }
    grade.mutate(
      { courseId, date: s.date, startTime: s.time, groupId: s.groupId, status: s.status, grade: n },
      { onSuccess: () => { show(t("gradeSaved")); setEditing(false); }, onError: (e) => show(apiErrorMessage(e, locale) ?? tc("genericError"), "warn") }
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
      <div className="w-24 shrink-0">
        <p className="text-note font-semibold text-ink">{formatDate(locale === "ru" ? "ru" : "uz", s.date, "short")}</p>
        <p className="text-micro tabular-nums text-ink-faint">{s.time}</p>
      </div>
      <p className="min-w-0 flex-1 truncate text-micro text-ink-soft">{s.topicTitle ?? "—"}</p>
      <span className={cls("shrink-0 rounded-pill px-2.5 py-0.5 text-micro font-semibold", attTone[s.status])}>{t(`att.${s.status}`)}</span>
      {editing ? (
        <div className="flex shrink-0 items-center gap-1">
          <Input value={val} onChange={(e) => setVal(e.target.value)} inputMode="numeric" placeholder="0–100" className="w-16 !py-1 text-center" autoFocus onKeyDown={(e) => e.key === "Enter" && save()} />
          <button onClick={save} disabled={grade.isPending} className="rounded-control p-1.5 text-emerald transition-colors hover:bg-emerald-soft" aria-label={t("gradeSaveBtn")}><Icon icon={Check} size={15} /></button>
          <button onClick={() => { setEditing(false); setVal(s.grade === null ? "" : String(s.grade)); }} className="rounded-control p-1.5 text-ink-faint transition-colors hover:bg-bg" aria-label="cancel"><Icon icon={X} size={15} /></button>
        </div>
      ) : (
        <button onClick={() => setEditing(true)} className="flex w-16 shrink-0 items-center justify-end gap-1 rounded-control px-2 py-1 text-note font-bold tabular-nums text-ink transition-colors hover:bg-brand-soft hover:text-brand-deep">
          {s.grade === null ? <span className="text-micro font-semibold text-ink-faint">{t("setGrade")}</span> : s.grade}
        </button>
      )}
    </div>
  );
}

function AttendanceSummary({ course }: { course: StudentDetailCourse }) {
  const { t } = useTranslation(undefined, { keyPrefix: "studentDetail" });
  const a = course.attendance;
  const legend: { tone: string; label: string; value: number }[] = [
    { tone: "bg-emerald", label: t("att.PRESENT"), value: a.present },
    { tone: "bg-amber", label: t("att.LATE"), value: a.late },
    { tone: "bg-blue", label: t("att.EXCUSED"), value: a.excused },
    { tone: "bg-rose", label: t("att.ABSENT"), value: a.absent },
  ];
  return (
    <div className="px-4 py-3">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="text-micro font-semibold uppercase tracking-wider text-ink-soft">{t("attendance")}</span>
        <span className={cls("text-note font-bold tabular-nums", a.pct !== null && a.pct < 75 ? "text-rose" : "text-emerald")}>{a.pct !== null ? `${a.pct}%` : "—"}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full">
        <StackedBar segments={[{ value: a.present, tone: "emerald" }, { value: a.late, tone: "amber" }, { value: a.excused, tone: "blue" }, { value: a.absent, tone: "rose" }]} />
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1">
        {legend.map((l) => (
          <span key={l.label} className="inline-flex items-center gap-1.5 text-micro font-semibold text-ink-soft">
            <span className={cls("h-2 w-2 rounded-full", l.tone)} /> {l.label}: <span className="tabular-nums text-ink">{l.value}</span>
          </span>
        ))}
        {a.avgGrade !== null && (
          <span className="ml-auto inline-flex items-center gap-1.5 text-micro font-semibold text-ink-soft">
            {t("att.avgGrade")}: <span className="text-note font-bold tabular-nums text-ink">{a.avgGrade}</span>
          </span>
        )}
      </div>
    </div>
  );
}

/* ============================ Sahifa ============================ */
export function StudentDetailPage() {
  const { id } = useParams();
  const studentId = Number(id);
  const { t } = useTranslation(undefined, { keyPrefix: "studentDetail" });
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const q = useStudentDetail(studentId);
  const d = q.data;

  const [assign, setAssign] = useState<QuickTaskPrefill | null>(null);
  const unlock = useUnlockForStudent(studentId);
  const { show } = useToast();
  const locale = useLocale();
  const { t: tc } = useTranslation(undefined, { keyPrefix: "common" });

  const tab: TabKey = ((): TabKey => {
    const r = params.get("tab");
    return r === "courses" || r === "journal" ? r : "overview";
  })();

  const doGrade = (caseAttemptId: number) => navigate(`/teach/cases/review?open=${caseAttemptId}`);
  const doUnlock = (courseId: number, topicId: number) =>
    unlock.mutate({ courseId, topicId }, {
      onSuccess: () => show(t("unlocked")),
      onError: (e) => show(apiErrorMessage(e, locale) ?? tc("genericError"), "warn"),
    });

  const overall = d && d.courses.length ? Math.round(d.courses.reduce((a, c) => a + c.overallPct, 0) / d.courses.length) : 0;
  const attPct = useMemo(() => {
    if (!d) return null;
    const vals = d.courses.map((c) => c.attendance.pct).filter((x): x is number => x !== null);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  }, [d]);
  const completedTotal = d ? d.courses.reduce((a, c) => a + c.completedCount, 0) : 0;
  const topicsTotal = d ? d.courses.reduce((a, c) => a + c.topicsTotal, 0) : 0;

  const attention: Attention[] = useMemo(() => {
    if (!d) return [];
    const out: Attention[] = [];
    for (const c of d.courses) {
      for (const tp of c.topics) {
        if (tp.hasCase && tp.caseSubmitted && !tp.caseReviewed) out.push({ courseId: c.courseId, courseName: c.subjectName, topic: tp, kind: "grade" });
        else if (tp.state === "LOCKED") out.push({ courseId: c.courseId, courseName: c.subjectName, topic: tp, kind: "unlock" });
      }
    }
    // Baholash (rose) yuqorida, keyin qulflar.
    return out.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "grade" ? -1 : 1));
  }, [d]);

  const initials = d ? d.student.fullName.split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") : "";

  const TABS: { key: TabKey; icon: typeof BookOpen }[] = [
    { key: "overview", icon: GraduationCap },
    { key: "courses", icon: BookOpen },
    { key: "journal", icon: ClipboardList },
  ];

  return (
    <div className="pb-8">
      <button onClick={() => navigate("/teach/groups")} className="mb-3 inline-flex items-center gap-1.5 text-note font-medium text-brand-deep transition-colors hover:text-brand">
        <Icon icon={ArrowLeft} size={15} /> {t("back")}
      </button>

      {q.isLoading ? (
        <div className="flex min-h-[40vh] items-center justify-center"><Spinner size={28} className="text-brand" /></div>
      ) : (
        <AsyncSection isLoading={false} isError={q.isError} isEmpty={false} emptyText="" onRetry={() => q.refetch()}>
          {d && (
            <div className="space-y-3">
              {/* ===== Identity + o'zlashtirish ===== */}
              <Card className="flex flex-wrap items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-card bg-brand-soft text-h1 font-extrabold text-brand-deep">{initials}</div>
                <div className="min-w-0 flex-1">
                  <h1 className="truncate text-h1 font-bold text-ink">{d.student.fullName}</h1>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-note text-ink-soft">
                    <span className="inline-flex items-center gap-1.5"><Icon icon={Mail} size={14} /> {d.student.email}</span>
                    {d.student.groupName && (
                      <button onClick={() => d.student.groupId && navigate(`/teach/groups/${d.student.groupId}`)} className="inline-flex items-center gap-1 rounded-pill bg-brand-soft px-2.5 py-0.5 text-micro font-semibold text-brand-deep transition-colors hover:bg-brand/10">
                        <Icon icon={Users} size={12} /> {d.student.groupName}
                      </button>
                    )}
                    <span className="inline-flex items-center gap-1.5">
                      <Icon icon={BookOpen} size={14} /> {t("topicsCompleted")}: {completedTotal}/{topicsTotal}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <div className="flex flex-col items-center">
                    <ProgressRing value={overall} size={64} stroke={7} tone="brand" />
                    <span className="mt-1 text-micro font-semibold text-ink-soft">{t("overallShort")}</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className={cls("text-stat font-extrabold leading-none tabular-nums", attPct !== null && attPct < 75 ? "text-rose" : "text-blue")}>
                      {attPct !== null ? `${attPct}%` : "—"}
                    </span>
                    <span className="mt-1 text-micro font-semibold text-ink-soft">{t("attendance")}</span>
                  </div>
                  <Button icon={<Icon icon={ListPlus} size={17} />} onClick={() => setAssign({ studentId: d.student.id, studentName: d.student.fullName })}>{t("assignTask")}</Button>
                </div>
              </Card>

              {/* Bo'limlar — xususiy pill-bar o'rniga umumiy SubNav (ilovadagi
                  YAGONA ikkinchi daraja mexanizmi; desktopda yon panel, mobilda tasma).
                  Eski 5 kartali strip olib tashlandi: mavzu/amaliyot raqamlari o'z
                  tabida yorlig'i va konteksti bilan turadi (STAT DIETASI). */}
              <SubNav
                title={d.student.fullName}
                activeKey={tab}
                items={TABS.map((x) => ({
                  key: x.key,
                  label: t(`tabs.${x.key}`),
                  to: `/teach/students/${d.student.id}?tab=${x.key}`,
                  icon: <Icon icon={x.icon} size={16} />,
                  badge: x.key === "overview" ? attention.length : undefined,
                }))}
              />

              {/* ===== Tab content ===== */}
              {tab === "overview" && (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_340px]">
                  <Card className="!p-0">
                    <div className="flex items-center gap-2 border-b border-line px-4 py-3">
                      <Icon icon={AlertTriangle} size={16} className="text-amber" />
                      <h3 className="text-section font-bold text-ink">{t("attention")}</h3>
                      {attention.length > 0 && <span className="text-micro font-semibold text-ink-faint">{attention.length}</span>}
                    </div>
                    <div className="px-4 py-2">
                      <AttentionList items={attention} onGrade={doGrade} onUnlock={doUnlock} onAssign={setAssign} unlockPending={unlock.isPending ? unlock.variables?.topicId ?? null : null} />
                    </div>
                  </Card>
                  <Card className="!p-0">
                    <div className="border-b border-line px-4 py-3">
                      <h3 className="text-section font-bold text-ink">{t("practiceTitle")}</h3>
                    </div>
                    <div className="space-y-2 p-3">
                      <PracticeRow icon={Check} tone="bg-emerald-soft text-emerald" label={t("practiceCards")} hint={t("practiceCardsHint")} value={d.practiceSignals.cardsReviewed} sub={d.practiceSignals.cardsKnownPct !== null ? `${d.practiceSignals.cardsKnownPct}% ${t("known")}` : undefined} />
                      <PracticeRow icon={Stethoscope} tone="bg-rose-soft text-rose" label={t("practicePatient")} hint={t("practicePatientHint")} value={d.practiceSignals.patientSessions} sub={d.practiceSignals.patientAvgScore !== null ? t("avgN", { n: d.practiceSignals.patientAvgScore }) : undefined} />
                      <PracticeRow icon={BookOpen} tone="bg-violet-soft text-violet" label={t("practiceTutor")} hint={t("practiceTutorHint")} value={d.practiceSignals.tutorQuestions} />
                    </div>
                  </Card>
                </div>
              )}

              {tab === "courses" && (
                <div className="space-y-3">
                  {d.courses.length === 0 ? (
                    <Card><p className="py-6 text-center text-note text-ink-soft">{t("noCourses")}</p></Card>
                  ) : d.courses.map((c) => (
                    <CourseBlock key={c.courseId} course={c}>
                      {c.topics.length === 0 ? (
                        <p className="px-4 py-6 text-center text-note text-ink-faint">{t("noTopics")}</p>
                      ) : (
                        <div className="divide-y divide-line">
                          {c.topics.map((tp) => (
                            <TopicRow key={tp.id} tp={tp} courseId={c.courseId} onGrade={doGrade} onUnlock={doUnlock} onAssign={setAssign} unlockPending={unlock.isPending ? unlock.variables?.topicId ?? null : null} />
                          ))}
                        </div>
                      )}
                    </CourseBlock>
                  ))}
                </div>
              )}

              {tab === "journal" && (
                <div className="space-y-3">
                  {d.courses.length === 0 ? (
                    <Card><p className="py-6 text-center text-note text-ink-soft">{t("noCourses")}</p></Card>
                  ) : d.courses.map((c) => (
                    <CourseBlock key={c.courseId} course={c} right={<span />}>
                      <AttendanceSummary course={c} />
                      {c.sessions.length === 0 ? (
                        <p className="border-t border-line px-4 py-6 text-center text-note text-ink-faint">{t("noSessions")}</p>
                      ) : (
                        <div className="divide-y divide-line border-t border-line">
                          {c.sessions.map((s, i) => (
                            <JournalRow key={`${c.courseId}-${s.date}-${i}`} s={s} studentId={studentId} courseId={c.courseId} />
                          ))}
                        </div>
                      )}
                    </CourseBlock>
                  ))}
                </div>
              )}
            </div>
          )}
        </AsyncSection>
      )}

      <QuickTaskModal
        open={assign !== null}
        onClose={() => setAssign(null)}
        prefill={{ studentId: d?.student.id, studentName: d?.student.fullName, ...(assign ?? {}) }}
      />
    </div>
  );
}
