import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, ChevronRight as Chev, ClipboardCheck, DoorClosed, GraduationCap, ListPlus, Settings2, Users2 } from "lucide-react";
import { Badge, Button, Card, Icon, Input, Modal, ProgressBar, ProgressRing, Select, Spinner, cls, useToast } from "@meduni/ui";
import { AsyncSection } from "../../../components/AsyncSection";
import { QuickTaskModal } from "../../../components/QuickTaskModal";
import { Field } from "../../../components/Field";
import { formatDate } from "../../../lib/date";
import { useLocale } from "../../../lib/useLocale";
import {
  useGroupTimetable,
  useSetupCycle,
  useTeachGroup,
  useTeacherLessons,
  type DerivedLesson,
  type GroupStudent,
  type TeachGroup,
} from "../api";
import { RollCallModal } from "../course/attendance/RollCallModal";

type TabKey = "timetable" | "students";
const WEEKDAYS_UZ = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"];
const WEEKDAYS_RU = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function mondayOf(base: Date, off: number): Date {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + off * 7);
  return d;
}

/* ---------------- Group metrics ---------------- */
function GroupStats({ group }: { group: TeachGroup }) {
  const { t } = useTranslation(undefined, { keyPrefix: "groupProfile" });
  return (
    <div className="mt-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      <Card className="flex items-center gap-3">
        <ProgressRing value={group.avgProgress} size={62} stroke={7} tone="brand" />
        <span className="text-note font-medium text-ink-soft">{t("avgProgress")}</span>
      </Card>
      <Card className="flex items-center gap-3">
        <ProgressRing value={group.avgAttendance ?? 0} size={62} stroke={7} tone="blue" />
        <span className="text-note font-medium text-ink-soft">{t("avgAttendance")}</span>
      </Card>
      <Card className={cls("flex flex-col justify-center", group.behindCount > 0 && "border-rose/30 bg-rose-soft")}>
        <span className={cls("text-[28px] font-bold leading-none tabular-nums", group.behindCount > 0 ? "text-rose" : "text-ink")}>{group.behindCount}</span>
        <span className="mt-1 text-note font-medium text-ink-soft">{t("behindCount")}</span>
      </Card>
      <Card className="flex flex-col justify-center">
        <span className="text-[28px] font-bold leading-none tabular-nums text-ink">{group.studentCount}</span>
        <span className="mt-1 text-note font-medium text-ink-soft">{t("studentsCount")}</span>
      </Card>
    </div>
  );
}

/* ---------------- Students ---------------- */
function StudentRow({ s, onClick, onAssign, tRel }: { s: GroupStudent; onClick: () => void; onAssign: () => void; tRel: (iso: string | null) => string }) {
  const { t } = useTranslation(undefined, { keyPrefix: "groupProfile" });
  const initials = s.fullName.split(" ").filter(Boolean).slice(0, 2).map((x) => x[0]?.toUpperCase()).join("");
  const lowAtt = s.attendancePct !== null && s.attendancePct < 75;
  return (
    <div className="flex w-full items-center gap-3 px-4 py-3 transition-colors hover:bg-bg">
      <span className={cls("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold tabular-nums", s.rank <= 3 ? "bg-brand-soft text-brand-deep" : "bg-bg text-ink-faint")} title={t("rankHint")}>
        {s.rank}
      </span>
      <button onClick={onClick} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[13px] font-bold text-brand-deep">{initials}</div>
        <div className="min-w-0 flex-[2]">
          <div className="flex items-center gap-2">
            <p className="truncate text-[15px] font-medium text-ink">{s.fullName}</p>
            {s.behind && <Badge tone="rose">{t("behind")}</Badge>}
          </div>
          <p className="mt-0.5 truncate text-note text-ink-faint">{tRel(s.lastActiveAt)}</p>
        </div>
        <div className="hidden min-w-0 flex-1 sm:block">
          <div className="flex items-center gap-2">
            <ProgressBar value={s.overallPct} className="flex-1" />
            <span className="w-9 shrink-0 text-right text-[13px] font-semibold tabular-nums text-ink-soft">{s.overallPct}%</span>
          </div>
        </div>
        <div className="hidden w-14 shrink-0 text-right sm:block">
          <span className="text-[13px] text-ink-faint">{t("quiz")}</span>
          <p className="text-[14px] font-bold tabular-nums text-ink">{s.avgQuizScore === null ? "—" : `${s.avgQuizScore}%`}</p>
        </div>
        <div className="w-14 shrink-0 text-right">
          <span className="text-[13px] text-ink-faint">{t("att")}</span>
          <p className={cls("text-[14px] font-bold tabular-nums", lowAtt ? "text-rose" : "text-ink")}>{s.attendancePct === null ? "—" : `${s.attendancePct}%`}</p>
        </div>
      </button>
      <button onClick={onAssign} title={t("assignToStudent")} aria-label={t("assignToStudent")} className="shrink-0 rounded-control p-1.5 text-ink-soft transition-colors hover:bg-brand-soft hover:text-brand-deep">
        <Icon icon={ListPlus} size={16} />
      </button>
      <Icon icon={Chev} size={16} className="shrink-0 text-ink-faint" />
    </div>
  );
}

function StudentsTab({ group }: { group: TeachGroup }) {
  const { t } = useTranslation(undefined, { keyPrefix: "groupProfile" });
  const navigate = useNavigate();
  const locale = useLocale();
  const [assign, setAssign] = useState<{ studentId?: number; studentName?: string } | null>(null);

  const relTime = (iso: string | null) => {
    if (!iso) return t("neverActive");
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
    if (days <= 0) return t("activeToday");
    if (days === 1) return t("activeYesterday");
    return locale === "ru" ? `${days} дн. назад` : `${days} kun oldin`;
  };

  if (group.students.length === 0) return <Card><p className="py-4 text-center text-body text-ink-soft">{t("noStudents")}</p></Card>;
  const sorted = [...group.students].sort((a, b) => Number(b.behind) - Number(a.behind) || b.overallPct - a.overallPct);
  return (
    <>
      <div className="mb-2.5 flex justify-end">
        <Button variant="soft" size="sm" icon={<Icon icon={ListPlus} size={15} />} onClick={() => setAssign({})}>{t("assignToGroup")}</Button>
      </div>
      <Card className="divide-y divide-line p-0">
        {sorted.map((s) => (
          <StudentRow key={s.id} s={s} onClick={() => navigate(`/teach/students/${s.id}`)} onAssign={() => setAssign({ studentId: s.id, studentName: s.fullName })} tRel={relTime} />
        ))}
      </Card>
      <QuickTaskModal open={assign !== null} onClose={() => setAssign(null)} prefill={{ ...(assign ?? {}), groupId: group.id }} />
    </>
  );
}

/* ---------------- Timetable (haftalik jadval + yo'qlama) ---------------- */
function statusTone(s: DerivedLesson["status"]): string {
  return s === "FULL" ? "border-l-emerald bg-emerald-soft/40" : s === "PARTIAL" ? "border-l-amber bg-amber-soft/40" : "border-l-brand bg-surface";
}

function TimetableTab({ group }: { group: TeachGroup }) {
  const { t } = useTranslation(undefined, { keyPrefix: "groupProfile" });
  const locale = useLocale();
  const dayNames = locale === "ru" ? WEEKDAYS_RU : WEEKDAYS_UZ;
  const now = new Date();
  const [weekOffset, setWeekOffset] = useState(0);
  const [setup, setSetup] = useState(false);
  const [roll, setRoll] = useState<DerivedLesson | null>(null);

  const monday = useMemo(() => mondayOf(now, weekOffset), [weekOffset]); // eslint-disable-line react-hooks/exhaustive-deps
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(d.getDate() + i); return d; }), [monday]);
  const todayKey = dayKey(now);

  const lessonsQ = useTeacherLessons({ from: dayKey(weekDays[0]), to: dayKey(weekDays[6]) });
  const lessons = (lessonsQ.data ?? []).filter((l) => l.groupId === group.id);
  const byDay = useMemo(() => {
    const m = new Map<string, DerivedLesson[]>();
    for (const l of lessons) (m.get(l.dayKey) ?? m.set(l.dayKey, []).get(l.dayKey)!).push(l);
    return m;
  }, [lessons]);
  const hasAnyLesson = lessons.length > 0;

  const weekLabel = `${formatDate(locale === "ru" ? "ru" : "uz", weekDays[0], "short")} – ${formatDate(locale === "ru" ? "ru" : "uz", weekDays[6], "short")}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button onClick={() => setWeekOffset((w) => w - 1)} className="rounded-control p-2 text-ink-soft hover:bg-bg" aria-label="prev"><Icon icon={ChevronLeft} size={18} /></button>
          <span className="min-w-[150px] text-center text-[14px] font-semibold text-ink">{weekLabel}</span>
          <button onClick={() => setWeekOffset((w) => w + 1)} className="rounded-control p-2 text-ink-soft hover:bg-bg" aria-label="next"><Icon icon={ChevronRight} size={18} /></button>
          {weekOffset !== 0 && <Button size="sm" variant="ghost" onClick={() => setWeekOffset(0)}>{t("today")}</Button>}
        </div>
        <Button size="sm" variant="soft" icon={<Icon icon={Settings2} size={15} />} onClick={() => setSetup(true)}>{t("setupTimetable")}</Button>
      </div>

      {lessonsQ.isLoading ? (
        <div className="flex h-40 items-center justify-center"><Spinner size={22} /></div>
      ) : !hasAnyLesson ? (
        <Card className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-control bg-brand-soft text-brand-deep"><Icon icon={CalendarDays} size={24} /></span>
          <p className="text-[15px] font-semibold text-ink">{t("noTimetable")}</p>
          <p className="max-w-sm text-[13.5px] text-ink-soft">{t("noTimetableHint")}</p>
          <Button size="sm" icon={<Icon icon={Settings2} size={15} />} onClick={() => setSetup(true)}>{t("setupTimetable")}</Button>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {weekDays.map((d, i) => {
            const k = dayKey(d);
            const list = byDay.get(k) ?? [];
            if (list.length === 0) return null;
            const isToday = k === todayKey;
            return (
              <Card key={k} className={cls("!p-0 overflow-hidden", isToday && "ring-2 ring-brand")}>
                <div className={cls("flex items-center gap-2 px-4 py-2", isToday ? "bg-brand-soft" : "bg-bg")}>
                  <span className={cls("text-[13.5px] font-bold", isToday ? "text-brand-deep" : "text-ink")}>{dayNames[i]}</span>
                  <span className="text-[12.5px] text-ink-faint">{formatDate(locale === "ru" ? "ru" : "uz", d, "short")}</span>
                  {isToday && <span className="rounded-pill bg-brand px-2 py-0.5 text-[11px] font-bold text-white">{t("today")}</span>}
                </div>
                <div className="divide-y divide-line">
                  {list.map((l) => (
                    <div key={l.slotId + l.dayKey} className={cls("flex flex-wrap items-center gap-3 border-l-4 px-4 py-2.5", statusTone(l.status))}>
                      <span className="w-12 shrink-0 text-[14px] font-bold tabular-nums text-ink">{l.startTime}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14.5px] font-semibold text-ink">{l.courseName}</p>
                        {l.room && <p className="flex items-center gap-1 text-[12.5px] text-ink-faint"><Icon icon={DoorClosed} size={11} /> {l.room}</p>}
                      </div>
                      <span className="shrink-0 text-[12.5px] tabular-nums text-ink-faint">{l.markedCount}/{l.rosterSize}</span>
                      <Button size="sm" variant={l.status === "FULL" ? "ghost" : "primary"} icon={<Icon icon={ClipboardCheck} size={15} />} onClick={() => setRoll(l)}>
                        {l.status === "UNMARKED" ? t("rollCall") : t("editRollCall")}
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {setup && <TimetableSetupModal group={group} onClose={() => setSetup(false)} />}
      {roll && (
        <RollCallModal
          courseId={roll.courseId}
          date={roll.dayKey}
          startTime={roll.startTime}
          groupId={group.id}
          heading={`${roll.courseName} · ${formatDate(locale === "ru" ? "ru" : "uz", new Date(roll.date), "short")} · ${roll.startTime}`}
          onClose={() => setRoll(null)}
        />
      )}
    </div>
  );
}

/** SIKL MASTERI — bir marta: kurs + sana oralig'i + har kun (o'z vaqti/xonasi) →
 *  butun sikl jadvali yaratiladi (RRULE uslubi: haftalik, tanlangan kunlar, oxirgi
 *  sanagacha). Har dars uchun alohida qo'shish shart emas. */
function TimetableSetupModal({ group, onClose }: { group: TeachGroup; onClose: () => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "groupProfile" });
  const { t: tc } = useTranslation(undefined, { keyPrefix: "common" });
  const locale = useLocale();
  const dayNames = locale === "ru" ? WEEKDAYS_RU : WEEKDAYS_UZ;
  const { show } = useToast();
  const ttQ = useGroupTimetable(group.id);
  const save = useSetupCycle();

  const [courseId, setCourseId] = useState(String(group.courses[0]?.id ?? ""));
  const [cycleStart, setCycleStart] = useState("");
  const [cycleEnd, setCycleEnd] = useState("");
  const [days, setDays] = useState(() => Array.from({ length: 7 }, () => ({ on: false, time: "09:00", room: "" })));
  const [err, setErr] = useState<string | null>(null);

  // Tanlangan kursning MAVJUD siklini prefill qilamiz (tahrirlash uchun).
  const courseData = ttQ.data?.courses.find((c) => String(c.courseId) === courseId);
  useEffect(() => {
    if (!ttQ.data) return;
    setCycleStart(courseData?.cycleStart ?? "");
    setCycleEnd(courseData?.cycleEnd ?? "");
    const next = Array.from({ length: 7 }, () => ({ on: false, time: "09:00", room: "" }));
    for (const s of courseData?.slots ?? []) next[s.weekday] = { on: true, time: s.startTime, room: s.room ?? "" };
    setDays(next);
  }, [courseId, ttQ.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const weeks = cycleStart && cycleEnd
    ? Math.max(1, Math.ceil(((new Date(cycleEnd).getTime() - new Date(cycleStart).getTime()) / 86_400_000 + 1) / 7))
    : 0;
  const setDay = (i: number, patch: Partial<{ on: boolean; time: string; room: string }>) =>
    setDays((d) => d.map((x, n) => (n === i ? { ...x, ...patch } : x)));

  const submit = () => {
    setErr(null);
    if (!cycleStart || !cycleEnd) { setErr(t("cycleNeedDates")); return; }
    const chosen = days.map((d, i) => ({ ...d, weekday: i })).filter((d) => d.on);
    if (chosen.length === 0) { setErr(t("cycleNeedDays")); return; }
    save.mutate(
      { courseId: Number(courseId), groupId: group.id, cycleStart, cycleEnd, days: chosen.map((d) => ({ weekday: d.weekday, startTime: d.time, room: d.room.trim() || undefined })) },
      { onSuccess: (r) => { show(t("cycleCreated", { n: r.days })); onClose(); }, onError: (e) => setErr((e as Error).message || tc("genericError")) }
    );
  };

  return (
    <Modal open onClose={onClose} title={t("setupTimetable")} className="max-w-xl">
      <div className="space-y-4">
        <p className="text-[13.5px] text-ink-soft">{t("cycleHint")}</p>

        <Field label={t("course")}>
          <Select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            {group.courses.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </Select>
        </Field>

        {/* 1-qadam: sikl davri */}
        <div>
          <p className="mb-1.5 text-[13px] font-bold text-ink">{t("cyclePeriod")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("cycleStart")}><Input type="date" value={cycleStart} onChange={(e) => setCycleStart(e.target.value)} /></Field>
            <Field label={t("cycleEnd")}><Input type="date" value={cycleEnd} onChange={(e) => setCycleEnd(e.target.value)} /></Field>
          </div>
          {weeks > 0 && <p className="mt-1 text-[13px] font-semibold text-brand-deep">≈ {t("cycleWeeks", { n: weeks })}</p>}
        </div>

        {/* 2-qadam: kunlar + har kunga o'z vaqti/xonasi */}
        <div>
          <p className="mb-1.5 text-[13px] font-bold text-ink">{t("cycleDays")}</p>
          <div className="space-y-1.5">
            {dayNames.map((dn, i) => (
              <div key={i} className={cls("flex flex-wrap items-center gap-2 rounded-control border px-3 py-2 transition-colors", days[i].on ? "border-brand/40 bg-brand-soft/30" : "border-line")}>
                <label className="flex w-28 shrink-0 cursor-pointer items-center gap-2 text-[14px] font-semibold text-ink">
                  <input type="checkbox" checked={days[i].on} onChange={(e) => setDay(i, { on: e.target.checked })} />
                  {dn}
                </label>
                {days[i].on ? (
                  <>
                    <Input type="time" value={days[i].time} onChange={(e) => setDay(i, { time: e.target.value })} className="w-28" />
                    <Input value={days[i].room} onChange={(e) => setDay(i, { room: e.target.value })} placeholder={t("room")} className="w-28" />
                  </>
                ) : (
                  <span className="text-[13px] text-ink-faint">{t("cycleDayOff")}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {err && <p className="text-[13.5px] text-rose">{err}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{tc("cancel")}</Button>
          <Button onClick={submit} disabled={save.isPending || !courseId}>{t("cycleCreate")}</Button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- Page ---------------- */
export function GroupProfile() {
  const { id } = useParams();
  const groupId = Number(id);
  const { t } = useTranslation(undefined, { keyPrefix: "groupProfile" });
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const q = useTeachGroup(groupId);
  const group = q.data;

  const raw = params.get("tab") as TabKey | null;
  const tab: TabKey = raw === "students" ? "students" : "timetable";
  const setTab = (k: TabKey) => setParams({ tab: k }, { replace: true });

  const TABS: { key: TabKey; icon: typeof Users2 }[] = [
    { key: "timetable", icon: CalendarDays },
    { key: "students", icon: Users2 },
  ];

  return (
    <div>
      <button onClick={() => navigate("/teach/groups")} className="mb-3 flex items-center gap-1 text-[14.5px] font-medium text-brand-deep hover:underline">
        <Icon icon={ArrowLeft} size={15} /> {t("back")}
      </button>

      {q.isLoading ? (
        <div className="flex min-h-[40vh] items-center justify-center"><Spinner size={26} /></div>
      ) : (
        <AsyncSection isLoading={false} isError={q.isError} isEmpty={false} emptyText="" onRetry={() => q.refetch()}>
          {group && (
            <>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-deep">
                  <Icon icon={Users2} size={26} />
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-h1 font-bold text-ink">{group.name}</h1>
                  <p className="flex flex-wrap items-center gap-x-2 text-[14px] text-ink-soft">
                    <span>{t("yearN", { n: group.yearOfStudy })}</span>
                    <span>·</span>
                    <span>{group.facultyName}</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1"><Icon icon={GraduationCap} size={14} /> {t("studentsN", { n: group.studentCount })}</span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {group.courses.map((c) => (
                    <button key={c.id} onClick={() => navigate(`/teach/courses/${c.id}`)} className="rounded-pill bg-brand-soft px-2.5 py-1 text-[13.5px] font-semibold text-brand-deep transition-colors hover:bg-brand/10">
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>

              <GroupStats group={group} />

              <div className="mt-3 inline-flex max-w-full gap-1 overflow-x-auto rounded-control border border-line bg-surface p-1 shadow-card">
                {TABS.map((x) => (
                  <button
                    key={x.key}
                    onClick={() => setTab(x.key)}
                    className={cls("flex shrink-0 items-center gap-2 whitespace-nowrap rounded-[8px] px-4 py-2 text-[15px] font-semibold transition-all", tab === x.key ? "bg-brand-soft text-brand-deep" : "text-ink-soft hover:bg-bg hover:text-ink")}
                  >
                    <Icon icon={x.icon} size={16} />
                    {t(`tabs.${x.key}`)}
                  </button>
                ))}
              </div>

              <div className="mt-5">
                {tab === "timetable" ? <TimetableTab group={group} /> : <StudentsTab group={group} />}
              </div>
            </>
          )}
        </AsyncSection>
      )}
    </div>
  );
}
