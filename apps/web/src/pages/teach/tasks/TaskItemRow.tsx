import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  BookOpen,
  CalendarCheck,
  CheckCircle2,
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
import { Button, Icon, cls } from "@meduni/ui";
import { BentoRow } from "../../../components/bento";
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

/** Ikonka doirasi va tur yorlig'i — `item.tone` bo'yicha (semantik rang). */
const ICON_TONE: Record<string, string> = {
  rose: "bg-rose-soft text-rose",
  amber: "bg-amber-soft text-amber",
  blue: "bg-blue-soft text-blue",
  brand: "bg-brand-soft text-brand-tint",
  violet: "bg-violet-soft text-violet",
  emerald: "bg-emerald-soft text-emerald",
};
const KICKER_TONE: Record<string, string> = {
  rose: "text-rose",
  amber: "text-amber",
  blue: "text-blue",
  brand: "text-brand-tint",
  violet: "text-violet",
  emerald: "text-emerald",
};

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

/** Vazifaning "yoshi" — muddat, bajarilgan sana yoki necha kun oldin paydo bo'lgani. */
export function taskAge(
  item: TeacherTaskItem,
  lang: "uz" | "ru",
  t: TFunction
): { text: string | null; overdue: boolean } {
  if (item.status === "done") {
    const iso = item.completedIso ?? item.sinceIso;
    return { text: iso ? formatDate(lang, iso, "short") : null, overdue: false };
  }
  if (item.dueIso) {
    const overdue = new Date(item.dueIso) < new Date();
    return { text: `${t("dueShort")}: ${formatDate(lang, item.dueIso, "short")}`, overdue };
  }
  if (!item.sinceIso) return { text: null, overdue: false };
  const days = Math.floor((Date.now() - new Date(item.sinceIso).getTime()) / 86_400_000);
  if (days <= 0) return { text: t("todayShort"), overdue: false };
  if (days === 1) return { text: t("yesterdayShort"), overdue: false };
  if (days < 30) return { text: t("daysAgo", { n: days }), overdue: false };
  return { text: formatDate(lang, item.sinceIso, "short"), overdue: false };
}

export function taskIcon(item: TeacherTaskItem): { icon: LucideIcon; tone: string; labelKey: string } {
  const meta = KIND_META[item.kind] ?? KIND_META.assigned;
  return { icon: meta.icon, tone: ICON_TONE[item.tone] ?? ICON_TONE.brand, labelKey: meta.labelKey };
}

/**
 * Vazifa borti qatori — Bosh sahifadagi "Bugun bajarish kerak" ro'yxati va
 * to'liq bort AYNAN shu komponentni ishlatadi (Dizayn v3: `BentoRow`).
 * Qatorning o'zi `<button>`; tez amallar (yo'qlama, "Bajardim", o'chirish)
 * qatordan TASHQARIDA — ichma-ich tugma yo'q.
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

  const meta = taskIcon(item);
  const qa = item.quickAction;
  const age = taskAge(item, locale === "ru" ? "ru" : "uz", t);
  const isDone = item.status === "done";

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

  // Holat yoki yosh — o'ng chetdagi BITTA qiymat.
  const right =
    item.status === "overdue" ? (
      <span className="inline-flex items-center gap-1 font-sans text-micro font-semibold text-rose">
        <Icon icon={Clock} size={12} /> {age.text ?? t("statusOverdue")}
      </span>
    ) : isDone ? (
      <span className="inline-flex items-center gap-1 font-sans text-micro font-semibold text-emerald">
        <Icon icon={CheckCircle2} size={12} /> {age.text ?? t("statusDone")}
      </span>
    ) : item.progress ? (
      <span className="text-micro">
        {item.progress.done}/{item.progress.total}
      </span>
    ) : age.text ? (
      <span className={cls("font-sans text-micro", age.overdue ? "font-semibold text-rose" : "font-normal text-ink-soft")}>
        {age.text}
      </span>
    ) : null;

  const trailing =
    qa?.type === "attendance" ? (
      <Button
        size="sm"
        variant="soft"
        className="shrink-0"
        icon={<Icon icon={ClipboardCheck} size={14} />}
        onClick={handleClick}
        aria-label={t("markAttendanceBtn")}
      >
        <span className="hidden sm:inline">{t("markAttendanceBtn")}</span>
      </Button>
    ) : qa?.type === "done" ? (
      <Button
        size="sm"
        variant="soft"
        className="shrink-0"
        icon={<Icon icon={CheckCircle2} size={14} />}
        disabled={done.isPending}
        onClick={() => done.mutate(qa.taskId)}
        aria-label={t("markDone")}
      >
        <span className="hidden sm:inline">{t("markDone")}</span>
      </Button>
    ) : onDelete && item.deletableTaskIds && item.deletableTaskIds.length > 0 ? (
      <button
        type="button"
        onClick={() => onDelete(item)}
        className="shrink-0 rounded-control p-1.5 text-ink-soft transition-colors hover:bg-rose-soft hover:text-rose focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        aria-label={tc("delete")}
      >
        <Icon icon={Trash2} size={16} />
      </button>
    ) : undefined;

  /**
   * ⚠️ Qator FAQAT haqiqiy amal bo'lganda bosiladi.
   * Dekanat/admin bergan vazifada `quickAction.type === "done"` bo'ladi (u —
   * o'ngdagi alohida "Bajardim" tugmasi), `link` esa HAR DOIM bo'sh satr:
   * backend `linkUrl` ni to'ldirmaydi. Shart `qa || link` bo'lsa qator
   * hover olardi-yu, bosilganda HECH NARSA sodir bo'lmasdi.
   */
  const clickable = qa?.type === "attendance" || !!item.link;

  return (
    <BentoRow
      icon={meta.icon}
      iconTone={meta.tone}
      muted={isDone}
      title={<span className={cls(isDone && "line-through decoration-ink-faint")}>{item.title}</span>}
      sub={
        <>
          <span className={cls("font-semibold", KICKER_TONE[item.tone] ?? KICKER_TONE.brand)}>{t(meta.labelKey)}</span>
          {item.subtitle ? ` · ${item.subtitle}` : item.description ? ` · ${item.description}` : ""}
        </>
      }
      right={right}
      onClick={clickable ? handleClick : undefined}
      arrow={!qa}
      trailing={trailing}
    />
  );
}
