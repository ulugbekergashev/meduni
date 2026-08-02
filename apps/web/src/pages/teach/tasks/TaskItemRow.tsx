import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock,
  FileClock,
  FileStack,
  Send,
  Sparkles,
  Trash2,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { Button, Icon } from "@meduni/ui";
import { TaskFeedRow } from "../../../components/TaskFeedRow";
import { formatDate } from "../../../lib/date";
import { useLocale } from "../../../lib/useLocale";
import { useSetTaskDone, type TeacherTaskItem } from "../api";

/** Yo'qlama modalini ochish uchun kerakli ma'lumot (chaqiruvchi modalni o'zi chizadi). */
export interface RollCallTarget {
  courseId: number;
  date: string;
  startTime: string;
  groupId: number | null;
  heading: string;
}

const KIND_META: Record<string, { icon: LucideIcon; labelKey: string }> = {
  cases_review: { icon: ClipboardCheck, labelKey: "casesReview" },
  material_missing: { icon: FileStack, labelKey: "materialMissing" },
  digest_approve: { icon: BookOpen, labelKey: "digestApprove" },
  content_create: { icon: Sparkles, labelKey: "contentCreate" },
  content_publish: { icon: FileClock, labelKey: "contentPublish" },
  attendance_unmarked: { icon: CalendarCheck, labelKey: "attendanceUnmarked" },
  students_behind: { icon: UserX, labelKey: "studentsBehind" },
  assigned: { icon: ClipboardList, labelKey: "assignedKind" },
  students_assignment: { icon: Send, labelKey: "studentsAssignmentKind" },
};

/**
 * Vazifa borti qatori — `/teach/tasks` va Bosh sahifadagi "Bugun bajarish kerak"
 * ro'yxati AYNAN shu komponentni ishlatadi (bitta manba: aks holda ~80 qator
 * nusxa bo'lardi va ikki joyda ayri-ayri buzilardi).
 */
export function TaskItemRow({
  item,
  onRollCall,
  onDelete,
}: {
  item: TeacherTaskItem;
  onRollCall: (target: RollCallTarget) => void;
  /** Berilmasa — o'chirish tugmasi chizilmaydi (masalan Bosh sahifadagi qisqa ro'yxat). */
  onDelete?: (item: TeacherTaskItem) => void;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "tasks" });
  const { t: tc } = useTranslation(undefined, { keyPrefix: "common" });
  const navigate = useNavigate();
  const locale = useLocale();
  const done = useSetTaskDone();

  const meta = KIND_META[item.kind] ?? KIND_META.assigned;
  const qa = item.quickAction;

  const age = ((): { text: string | null; overdue: boolean } => {
    if (item.status === "done") {
      const iso = item.completedIso ?? item.sinceIso;
      return { text: iso ? formatDate(locale === "ru" ? "ru" : "uz", iso, "short") : null, overdue: false };
    }
    if (item.dueIso) {
      const overdue = new Date(item.dueIso) < new Date();
      return { text: `${t("dueShort")}: ${formatDate(locale === "ru" ? "ru" : "uz", item.dueIso, "short")}`, overdue };
    }
    if (!item.sinceIso) return { text: null, overdue: false };
    const days = Math.floor((Date.now() - new Date(item.sinceIso).getTime()) / 86_400_000);
    if (days <= 0) return { text: t("todayShort"), overdue: false };
    if (days === 1) return { text: t("yesterdayShort"), overdue: false };
    if (days < 30) return { text: t("daysAgo", { n: days }), overdue: false };
    return { text: formatDate(locale === "ru" ? "ru" : "uz", item.sinceIso, "short"), overdue: false };
  })();

  const handleClick = () => {
    if (qa?.type === "attendance") {
      onRollCall({
        courseId: qa.courseId,
        date: qa.date,
        startTime: qa.startTime,
        groupId: qa.groupId,
        heading: `${item.title}${item.subtitle ? " · " + item.subtitle : ""}`,
      });
      return;
    }
    if (item.link) navigate(item.link);
  };

  const badge =
    item.status === "done" ? (
      <span className="inline-flex items-center gap-1 text-micro font-semibold text-emerald">
        <Icon icon={CheckCircle2} size={12} /> {t("statusDone")}
      </span>
    ) : item.status === "overdue" ? (
      <span className="inline-flex items-center gap-1 text-micro font-semibold text-rose">
        <Icon icon={Clock} size={12} /> {t("statusOverdue")}
      </span>
    ) : item.progress ? (
      <span className="text-micro font-semibold text-ink-faint tabular-nums">
        {item.progress.done}/{item.progress.total}
      </span>
    ) : null;

  const trailing =
    qa?.type === "attendance" ? (
      <Button size="sm" variant="soft">
        {t("markAttendanceBtn")}
      </Button>
    ) : qa?.type === "done" ? (
      <Button
        size="sm"
        variant="soft"
        icon={<Icon icon={CheckCircle2} size={14} />}
        disabled={done.isPending}
        onClick={(e) => {
          e.stopPropagation();
          done.mutate(qa.taskId);
        }}
      >
        {t("markDone")}
      </Button>
    ) : onDelete && item.deletableTaskIds && item.deletableTaskIds.length > 0 ? (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(item);
        }}
        className="rounded-control p-1.5 text-ink-soft transition-colors hover:bg-rose-soft hover:text-rose"
        aria-label={tc("delete")}
      >
        <Icon icon={Trash2} size={16} />
      </button>
    ) : item.link ? (
      <Icon icon={ChevronRight} size={16} className="text-ink-faint" />
    ) : undefined;

  return (
    <TaskFeedRow
      icon={meta.icon}
      tone={item.tone}
      kicker={t(meta.labelKey)}
      title={item.title}
      subtitle={item.subtitle}
      description={item.description}
      meta={age.text}
      metaTone={age.overdue ? "rose" : null}
      badge={badge}
      done={item.status === "done"}
      onClick={qa || item.link ? handleClick : undefined}
      trailing={trailing}
    />
  );
}
