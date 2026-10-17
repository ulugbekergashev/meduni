import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CalendarDays, ClipboardCheck, DoorClosed, Download, Users } from "lucide-react";
import { Badge, Button, ChipSelect, EmptyState, Icon, LegendRow, Spinner, StackedBar, cls, useToast } from "@meduni/ui";
import { BentoCard, PageHeader } from "../../../components/bento";
import { AsyncSection } from "../../../components/AsyncSection";
import { Avatar } from "../../../components/Avatar";
import { DataTable } from "../../../components/DataTable";
import { API_URL, apiErrorMessage } from "../../../lib/api";
import { useList } from "../../../lib/crud";
import { useLocale } from "../../../lib/useLocale";
import { isLowAttendance } from "../../../lib/attendance";
import { BackLink, TableCard } from "../components";
import { useCourse, useUpdateCourse } from "./api";

interface GroupLite {
  id: number;
  name: string;
}

const WEEKDAYS_UZ = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"];
const WEEKDAYS_RU = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];

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

  const back = <BackLink label={t("detail.back")} onClick={() => navigate("/admin/courses")} />;

  if (course.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner size={28} />
      </div>
    );
  }
  if (course.isError || !course.data) {
    return (
      <div className="space-y-3">
        {back}
        <AsyncSection isLoading={false} isError isEmpty={false} emptyText="" onRetry={() => course.refetch()}>
          {null}
        </AsyncSection>
      </div>
    );
  }

  const c = course.data;
  const groupOptions = groups.data ?? [];
  const currentIds = c.groups.map((g) => g.id).sort().join(",");
  const dirty = selectedGroups.slice().sort().join(",") !== currentIds;
  const att = c.attendanceSummary;
  const hasSchedule = c.schedule.some((g) => g.slots.length > 0);

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
    <div className="space-y-3">
      <div>
        {back}
        {/* ⛔ STAT DIETASI: talaba/guruh/mavzu sonlari harakat bermaydi — shapkada MATN. */}
        <PageHeader
          className="mb-0"
          title={c.name}
          subtitle={
            <>
              {c.departmentName} ·{" "}
              <button
                type="button"
                onClick={() => navigate(`/admin/users/${c.teacherId}`)}
                className="rounded-control font-semibold text-brand-tint hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                {c.teacherName}
              </button>{" "}
              · {t("semester")} {c.semester} · {c.academicYear} · {c.studentCount} {t("students").toLowerCase()} · {c.topicCount}{" "}
              {t("topics").toLowerCase()}
            </>
          }
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-2">
        <div className="min-w-0 space-y-3">
        {/* Attendance summary */}
        <BentoCard
          title={
            <span className="inline-flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-soft text-blue">
                <Icon icon={ClipboardCheck} size={15} />
              </span>
              {t("detail.attendanceTitle")}
            </span>
          }
          right={
            <span className="flex items-center gap-2">
              {att.pct !== null && (
                <span
                  className={cls(
                    "rounded-pill px-2.5 py-1 font-data text-note font-semibold tabular-nums",
                    isLowAttendance(att.pct) ? "bg-rose-soft text-rose" : "bg-emerald-soft text-emerald"
                  )}
                >
                  {att.pct}%
                </span>
              )}
              {att.marked > 0 && (
                <a
                  href={`${API_URL}/api/v1/courses/${courseId}/attendance.xlsx?view=list`}
                  className="inline-flex items-center gap-1.5 rounded-pill border border-line-raised px-3 py-1 text-note font-semibold text-ink transition-colors hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <Icon icon={Download} size={14} /> {t("detail.exportExcel")}
                </a>
              )}
            </span>
          }
        >
          {att.marked === 0 ? (
            <p className="py-4 text-center text-note text-ink-soft">{t("detail.noAttendance")}</p>
          ) : (
            <div className="flex flex-1 flex-col justify-end">
              <StackedBar
                segments={[
                  { value: att.present, tone: "emerald" },
                  { value: att.late, tone: "amber" },
                  { value: att.excused, tone: "blue" },
                  { value: att.absent, tone: "rose" },
                ]}
              />
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
                <LegendRow tone="emerald" label={t("detail.attPresent")} value={att.present} />
                <LegendRow tone="amber" label={t("detail.attLate")} value={att.late} />
                <LegendRow tone="blue" label={t("detail.attExcused")} value={att.excused} />
                <LegendRow tone="rose" label={t("detail.attAbsent")} value={att.absent} />
              </div>
            </div>
          )}
        </BentoCard>

        {/* Manage groups */}
        <BentoCard
          title={t("detail.manageGroups")}
          count={c.groups.length}
          right={
            <Button size="sm" disabled={!dirty || update.isPending || selectedGroups.length === 0} onClick={saveGroups}>
              {t("detail.saveGroups")}
            </Button>
          }
        >
          <ChipSelect options={groupOptions.map((g) => ({ id: g.id, label: g.name }))} selected={selectedGroups} onToggle={toggleGroup} />
          {error && <p className="mt-3 text-note text-rose">{error}</p>}
        </BentoCard>
        </div>

        {/* Read-only weekly schedule */}
        <BentoCard
          title={
            <span className="inline-flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-brand-tint">
                <Icon icon={CalendarDays} size={15} />
              </span>
              {t("detail.scheduleTitle")}
            </span>
          }
        >
          {!hasSchedule ? (
            <p className="py-4 text-center text-note text-ink-soft">{t("detail.noSchedule")}</p>
          ) : (
            <div className="space-y-3">
              {c.schedule.filter((g) => g.slots.length > 0).map((g) => (
                <div key={g.groupId}>
                  <p className="mb-1 text-micro font-semibold uppercase tracking-wider text-ink-soft">{g.groupName}</p>
                  <div className="space-y-1">
                    {g.slots.map((s, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-control bg-surface-raised px-3 py-1.5 text-note">
                        <span className="w-24 shrink-0 font-semibold text-ink">{(locale === "ru" ? WEEKDAYS_RU : WEEKDAYS_UZ)[s.weekday]}</span>
                        <span className="shrink-0 font-data font-semibold tabular-nums text-ink">{s.startTime}</span>
                        {s.room && <span className="inline-flex items-center gap-1 text-ink-soft"><Icon icon={DoorClosed} size={12} /> {s.room}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </BentoCard>
      </div>

      {/* Enrolled students */}
      <TableCard title={t("detail.enrolledStudents")} count={c.students.length}>
        {c.students.length === 0 ? (
          <div className="p-3">
            <EmptyState icon={<Icon icon={Users} size={20} />} text={t("detail.noStudents")} />
          </div>
        ) : (
          <DataTable headers={[t("students"), t("groups"), t("status")]}>
            {c.students.map((s) => (
              <tr key={s.enrollmentId} className="border-b border-line last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={s.fullName} />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">{s.fullName}</p>
                      <p className="truncate text-micro text-ink-soft">{s.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-ink-2">{s.groupName ?? "—"}</td>
                <td className="px-4 py-3">
                  <Badge tone={s.status === "ACTIVE" ? "emerald" : "slate"}>
                    {s.status === "ACTIVE" ? t("detail.statusActive") : t("detail.statusDropped")}
                  </Badge>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </TableCard>
    </div>
  );
}
