import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CalendarDays, ChevronLeft, ChevronRight, ClipboardCheck, DoorClosed, Plus, Search, Users2 } from "lucide-react";
import { Button, Card, Icon, Select, Spinner, cls } from "@meduni/ui";
import { AsyncSection } from "../../components/AsyncSection";
import { formatDate } from "../../lib/date";
import { useLocale } from "../../lib/useLocale";
import { AttendanceModal } from "./course/attendance/AttendanceModal";
import { SessionModal } from "./course/attendance/SessionModal";
import { useTeacherSessions, useTeachCourses, type TeacherSession } from "./api";

const WEEKDAYS_UZ = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"];
const WEEKDAYS_RU = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];

/** Mahalliy kun kaliti (TZ drift bo'lmasin). */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function mondayOf(base: Date, weekOffset: number): Date {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - dow + weekOffset * 7);
  return d;
}

function StatusPill({ s, t }: { s: TeacherSession["status"]; t: (k: string) => string }) {
  const map = {
    UNMARKED: "bg-bg text-ink-faint ring-1 ring-line",
    PARTIAL: "bg-amber-soft text-amber",
    FULL: "bg-emerald-soft text-emerald",
  } as const;
  const label = { UNMARKED: t("stUnmarked"), PARTIAL: t("stPartial"), FULL: t("stFull") } as const;
  return <span className={cls("shrink-0 rounded-pill px-2.5 py-1 text-[12.5px] font-bold", map[s])}>{label[s]}</span>;
}

function SessionCard({ s, onMark }: { s: TeacherSession; onMark: () => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "teachSchedule" });
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-control border border-line bg-surface px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-bold text-ink">{s.title ?? s.courseName}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-ink-soft">
          <span className="font-semibold text-brand-deep">{s.courseName}</span>
          {s.groupName && <span className="inline-flex items-center gap-1"><Icon icon={Users2} size={12} /> {s.groupName}</span>}
          {s.room && <span className="inline-flex items-center gap-1"><Icon icon={DoorClosed} size={12} /> {s.room}</span>}
        </p>
      </div>
      <span className="shrink-0 text-[12.5px] tabular-nums text-ink-faint">{s.markedCount}/{s.rosterSize}</span>
      <StatusPill s={s.status} t={t} />
      <Button size="sm" variant={s.status === "FULL" ? "ghost" : "primary"} icon={<Icon icon={ClipboardCheck} size={15} />} onClick={onMark}>
        {s.status === "UNMARKED" ? t("mark") : t("edit")}
      </Button>
    </div>
  );
}

export function TeachSchedulePage() {
  const { t } = useTranslation(undefined, { keyPrefix: "teachSchedule" });
  const { t: tt } = useTranslation(undefined, { keyPrefix: "teach" });
  const locale = useLocale();
  const navigate = useNavigate();

  const [weekOffset, setWeekOffset] = useState(0);
  const [search, setSearch] = useState("");
  const searching = search.trim().length > 0;

  const now = new Date();
  const monday = useMemo(() => mondayOf(now, weekOffset), [weekOffset]); // eslint-disable-line react-hooks/exhaustive-deps
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(d.getDate() + i); return d; }), [monday]);
  const todayKey = dayKey(now);

  // Qidiruvda — barcha sanalar; aks holda faqat shu hafta.
  const range = searching
    ? { search: search.trim() }
    : { from: dayKey(weekDays[0]), to: dayKey(weekDays[6]) };
  const q = useTeacherSessions(range);
  const courses = useTeachCourses();
  const sessions = q.data ?? [];

  const byDay = useMemo(() => {
    const m = new Map<string, TeacherSession[]>();
    for (const s of sessions) {
      const k = dayKey(new Date(s.date));
      (m.get(k) ?? m.set(k, []).get(k)!).push(s);
    }
    return m;
  }, [sessions]);

  const [mark, setMark] = useState<TeacherSession | null>(null);
  const [pickCourse, setPickCourse] = useState(false);
  const [newFor, setNewFor] = useState<number | null>(null);

  const startNew = () => {
    const list = courses.data ?? [];
    if (list.length === 1) setNewFor(list[0].id);
    else setPickCourse(true);
  };

  const weekLabel = `${formatDate(locale === "ru" ? "ru" : "uz", weekDays[0], "short")} – ${formatDate(locale === "ru" ? "ru" : "uz", weekDays[6], "short")}`;
  const dayNames = locale === "ru" ? WEEKDAYS_RU : WEEKDAYS_UZ;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-h1 font-bold text-ink">{t("title")}</h1>
          <p className="mt-1 text-[14.5px] text-ink-soft">{t("subtitle")}</p>
        </div>
        <Button icon={<Icon icon={Plus} size={16} />} onClick={startNew}>{t("newLesson")}</Button>
      </div>

      {/* Toolbar: qidiruv + hafta navigatsiyasi */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Icon icon={Search} size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-full rounded-control border border-line bg-surface py-2 pl-9 pr-3 text-[14.5px] outline-none focus:border-brand"
          />
        </div>
        {!searching && (
          <div className="flex items-center gap-1">
            <button onClick={() => setWeekOffset((w) => w - 1)} className="rounded-control p-2 text-ink-soft hover:bg-bg" aria-label="prev">
              <Icon icon={ChevronLeft} size={18} />
            </button>
            <span className="min-w-[150px] text-center text-[14px] font-semibold text-ink">{weekLabel}</span>
            <button onClick={() => setWeekOffset((w) => w + 1)} className="rounded-control p-2 text-ink-soft hover:bg-bg" aria-label="next">
              <Icon icon={ChevronRight} size={18} />
            </button>
            {weekOffset !== 0 && (
              <Button size="sm" variant="ghost" onClick={() => setWeekOffset(0)}>{t("today")}</Button>
            )}
          </div>
        )}
      </div>

      {q.isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center"><Spinner size={24} /></div>
      ) : searching ? (
        // Qidiruv natijasi — sana bo'yicha yassi ro'yxat
        <AsyncSection isLoading={false} isError={q.isError} isEmpty={sessions.length === 0} emptyIcon={<Icon icon={CalendarDays} size={22} />} emptyText={t("noMatch")} onRetry={() => q.refetch()}>
          <div className="space-y-2">
            {sessions.map((s) => <SessionCard key={s.id} s={s} onMark={() => setMark(s)} />)}
          </div>
        </AsyncSection>
      ) : (
        // Hafta ko'rinishi — har kun bo'limi, bugun ajralib turadi
        <div className="space-y-3">
          {weekDays.map((d, i) => {
            const k = dayKey(d);
            const list = byDay.get(k) ?? [];
            const isToday = k === todayKey;
            if (list.length === 0 && !isToday) return null; // bo'sh kunlarni yashiramiz (bugundan tashqari)
            return (
              <Card key={k} className={cls("!p-0 overflow-hidden", isToday && "ring-2 ring-brand")}>
                <div className={cls("flex items-center gap-2 px-4 py-2.5", isToday ? "bg-brand-soft" : "bg-bg")}>
                  <span className={cls("text-[14px] font-bold", isToday ? "text-brand-deep" : "text-ink")}>{dayNames[i]}</span>
                  <span className="text-[13px] text-ink-faint">{formatDate(locale === "ru" ? "ru" : "uz", d, "short")}</span>
                  {isToday && <span className="rounded-pill bg-brand px-2 py-0.5 text-[11.5px] font-bold text-white">{t("today")}</span>}
                  <span className="ml-auto text-[12.5px] text-ink-faint">{list.length ? t("nLessons", { n: list.length }) : t("noLessons")}</span>
                </div>
                {list.length > 0 && (
                  <div className="space-y-2 p-3">
                    {list.map((s) => <SessionCard key={s.id} s={s} onMark={() => setMark(s)} />)}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Yo'qlama oynasi (tez) */}
      {mark && (
        <AttendanceModal
          courseId={mark.courseId}
          sessionId={mark.id}
          groupId={mark.groupId ?? undefined}
          onClose={() => setMark(null)}
        />
      )}

      {/* Yangi dars — avval kurs tanlanadi (bir nechta bo'lsa) */}
      {pickCourse && (
        <CoursePickModal
          courses={(courses.data ?? []).map((c) => ({ id: c.id, name: c.subjectName }))}
          onPick={(id) => { setPickCourse(false); setNewFor(id); }}
          onClose={() => setPickCourse(false)}
          title={t("pickCourse")}
          emptyText={tt("empty")}
          onGoCreate={() => { setPickCourse(false); navigate("/teach/courses"); }}
        />
      )}
      {newFor !== null && <SessionModal courseId={newFor} edit={null} onClose={() => setNewFor(null)} />}
    </div>
  );
}

/** Yangi dars uchun kurs tanlash (o'qituvchida bir nechta kurs bo'lsa). */
function CoursePickModal({
  courses, onPick, onClose, title, emptyText, onGoCreate,
}: {
  courses: { id: number; name: string }[];
  onPick: (id: number) => void;
  onClose: () => void;
  title: string;
  emptyText: string;
  onGoCreate: () => void;
}) {
  const { t: tc } = useTranslation(undefined, { keyPrefix: "common" });
  const [id, setId] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-card bg-surface p-5 shadow-card" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 text-section font-bold text-ink">{title}</h3>
        {courses.length === 0 ? (
          <div className="space-y-3">
            <p className="text-[14px] text-ink-soft">{emptyText}</p>
            <Button onClick={onGoCreate}>+ {tc("add")}</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Select value={id} onChange={(e) => setId(e.target.value)}>
              <option value="" disabled>—</option>
              {courses.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </Select>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>{tc("cancel")}</Button>
              <Button disabled={!id} onClick={() => onPick(Number(id))}>{tc("continue")}</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
