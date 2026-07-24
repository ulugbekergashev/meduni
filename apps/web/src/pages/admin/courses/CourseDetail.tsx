import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BookOpen, CalendarDays, ClipboardCheck, DoorClosed, Download, GraduationCap, Users } from "lucide-react";
import { Badge, Button, Card, ChipSelect, Icon, LegendRow, Spinner, StackedBar, cls, useToast } from "@meduni/ui";
import { Avatar } from "../../../components/Avatar";
import { DataTable } from "../../../components/DataTable";
import { API_URL, apiErrorMessage } from "../../../lib/api";
import { useList } from "../../../lib/crud";
import { useLocale } from "../../../lib/useLocale";
import { useCourse, useUpdateCourse } from "./api";

interface GroupLite {
  id: number;
  name: string;
}

const WEEKDAYS_UZ = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"];
const WEEKDAYS_RU = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];

function StatItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-3 rounded-card border border-line bg-surface px-4 py-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-brand-deep">
        {icon}
      </div>
      <div>
        <p className="text-[13px] text-ink-faint">{label}</p>
        <p className="text-[16px] font-bold text-ink">{value}</p>
      </div>
    </div>
  );
}

export function CourseDetail() {
  const { id } = useParams();
  const courseId = Number(id);
  const { t } = useTranslation(undefined, { keyPrefix: "courses" });
  const { t: tc } = useTranslation(undefined, { keyPrefix: "common" });
  const locale = useLocale();
  const { show } = useToast();
  const navigate = useNavigate();

  const course = useCourse(courseId);
  const groups = useList<GroupLite>("groups");
  const update = useUpdateCourse();

  const [selectedGroups, setSelectedGroups] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Sync chip selection with the course's current groups when it loads.
  useEffect(() => {
    if (course.data) setSelectedGroups(course.data.groups.map((g) => g.id));
  }, [course.data]);

  if (course.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner size={28} />
      </div>
    );
  }
  if (course.isError || !course.data) {
    return (
      <div>
        <button onClick={() => navigate("/admin/courses")} className="text-[14.5px] text-brand-deep hover:underline">
          {t("detail.back")}
        </button>
        <p className="mt-4 text-[14.5px] text-rose">{tc("loadError")}</p>
      </div>
    );
  }

  const c = course.data;
  const groupOptions = groups.data ?? [];
  const currentIds = c.groups.map((g) => g.id).sort().join(",");
  const dirty = selectedGroups.slice().sort().join(",") !== currentIds;

  const saveGroups = () => {
    setError(null);
    update.mutate(
      { id: courseId, body: { groupIds: selectedGroups } },
      {
        onSuccess: () => show(tc("saved")),
        onError: (err) => setError(apiErrorMessage(err, locale) ?? tc("genericError")),
      }
    );
  };

  const toggleGroup = (gid: number) =>
    setSelectedGroups((prev) => (prev.includes(gid) ? prev.filter((g) => g !== gid) : [...prev, gid]));

  return (
    <div>
      <button onClick={() => navigate("/admin/courses")} className="text-[14.5px] font-medium text-brand-deep hover:underline">
        {t("detail.back")}
      </button>

      <h1 className="mt-3 text-h1 font-bold text-ink">
        {c.name}
      </h1>
      <p className="mt-1 text-[14.5px] text-ink-soft">
        {c.departmentName} ·{" "}
        <button onClick={() => navigate(`/admin/users/${c.teacherId}`)} className="font-medium text-brand-deep hover:underline">
          {c.teacherName}
        </button>{" "}
        · {t("semester")} {c.semester} · {c.academicYear}
      </p>

      {/* Stat tiles */}
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <StatItem icon={<Icon icon={Users} size={18} />} label={t("students")} value={c.studentCount} />
        <StatItem icon={<Icon icon={GraduationCap} size={18} />} label={t("groups")} value={c.groups.length} />
        <StatItem icon={<Icon icon={BookOpen} size={18} />} label={t("detail.topicCount")} value={c.topicCount} />
      </div>

      {/* Manage groups */}
      <Card className="mt-3">
        <h2 className="mb-4 text-section font-bold text-ink">{t("detail.manageGroups")}</h2>
        <ChipSelect
          options={groupOptions.map((g) => ({ id: g.id, label: g.name }))}
          selected={selectedGroups}
          onToggle={toggleGroup}
        />
        {error && <p className="mt-3 text-[14px] text-rose">{error}</p>}
        <div className="mt-4">
          <Button disabled={!dirty || update.isPending || selectedGroups.length === 0} onClick={saveGroups}>
            {t("detail.saveGroups")}
          </Button>
        </div>
      </Card>

      {/* Attendance summary + read-only weekly schedule */}
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Icon icon={ClipboardCheck} size={16} className="text-blue" />
            <h2 className="text-section font-bold text-ink">{t("detail.attendanceTitle")}</h2>
            {c.attendanceSummary.pct !== null && (
              <span className={cls("rounded-pill px-2.5 py-1 text-note font-bold tabular-nums", c.attendanceSummary.pct < 75 ? "bg-rose-soft text-rose" : "bg-emerald-soft text-emerald")}>
                {c.attendanceSummary.pct}%
              </span>
            )}
            {c.attendanceSummary.marked > 0 && (
              <a href={`${API_URL}/api/v1/courses/${courseId}/attendance.xlsx?view=list`} className="ml-auto inline-flex items-center gap-1.5 rounded-control border border-line px-3 py-1.5 text-note font-medium text-ink-soft transition-colors hover:bg-bg">
                <Icon icon={Download} size={15} /> {t("detail.exportExcel")}
              </a>
            )}
          </div>
          {c.attendanceSummary.marked === 0 ? (
            <p className="py-4 text-center text-note text-ink-faint">{t("detail.noAttendance")}</p>
          ) : (
            <>
              <StackedBar
                segments={[
                  { value: c.attendanceSummary.present, tone: "emerald" },
                  { value: c.attendanceSummary.late, tone: "amber" },
                  { value: c.attendanceSummary.excused, tone: "blue" },
                  { value: c.attendanceSummary.absent, tone: "rose" },
                ]}
              />
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
                <LegendRow tone="emerald" label={t("detail.attPresent")} value={c.attendanceSummary.present} />
                <LegendRow tone="amber" label={t("detail.attLate")} value={c.attendanceSummary.late} />
                <LegendRow tone="blue" label={t("detail.attExcused")} value={c.attendanceSummary.excused} />
                <LegendRow tone="rose" label={t("detail.attAbsent")} value={c.attendanceSummary.absent} />
              </div>
            </>
          )}
        </Card>

        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Icon icon={CalendarDays} size={16} className="text-brand-deep" />
            <h2 className="text-section font-bold text-ink">{t("detail.scheduleTitle")}</h2>
          </div>
          {c.schedule.every((g) => g.slots.length === 0) ? (
            <p className="py-4 text-center text-note text-ink-faint">{t("detail.noSchedule")}</p>
          ) : (
            <div className="space-y-3">
              {c.schedule.filter((g) => g.slots.length > 0).map((g) => (
                <div key={g.groupId}>
                  <p className="mb-1 text-note font-bold text-ink">{g.groupName}</p>
                  <div className="space-y-1">
                    {g.slots.map((s, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-control border border-line bg-surface px-3 py-1.5 text-note">
                        <span className="w-24 shrink-0 font-semibold text-ink">{(locale === "ru" ? WEEKDAYS_RU : WEEKDAYS_UZ)[s.weekday]}</span>
                        <span className="shrink-0 font-bold tabular-nums text-brand-deep">{s.startTime}</span>
                        {s.room && <span className="inline-flex items-center gap-1 text-ink-faint"><Icon icon={DoorClosed} size={12} /> {s.room}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Enrolled students */}
      <div className="mt-3">
        <h2 className="mb-3 text-section font-bold text-ink">{t("detail.enrolledStudents")}</h2>
        {c.students.length === 0 ? (
          <Card>
            <p className="py-6 text-center text-[14.5px] text-ink-soft">{t("detail.noStudents")}</p>
          </Card>
        ) : (
          <DataTable headers={[t("students"), t("groups"), t("status")]}>
            {c.students.map((s) => (
              <tr key={s.enrollmentId} className="border-b border-line last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={s.fullName} />
                    <div>
                      <p className="font-medium text-ink">{s.fullName}</p>
                      <p className="text-[13px] text-ink-faint">{s.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-ink-soft">{s.groupName ?? "—"}</td>
                <td className="px-4 py-3">
                  <Badge tone={s.status === "ACTIVE" ? "emerald" : "slate"}>
                    {s.status === "ACTIVE" ? t("detail.statusActive") : t("detail.statusDropped")}
                  </Badge>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>
    </div>
  );
}
