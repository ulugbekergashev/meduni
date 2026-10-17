import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  CalendarCheck2,
  Check,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Medal,
  PlayCircle,
  Repeat,
  Sparkles,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";
import { Icon, Spinner } from "@meduni/ui";
import { BentoCard, BentoRow } from "../../../components/bento";
import { formatDate } from "../../../lib/date";
import { useLocale } from "../../../lib/useLocale";
import type { AssignedTask, AutoTask, Notification, ReviewDueTopic } from "../api";

/** Bosh sahifada ko'rinadigan qatorlar soni — qolgani "Barchasi" ortida. */
const MAX_ROWS = 5;

const AUTO_META: Record<string, { icon: LucideIcon; labelKey: string; tone: string }> = {
  study: { icon: PlayCircle, labelKey: "study", tone: "bg-brand-soft text-brand-tint" },
  quiz_todo: { icon: ClipboardList, labelKey: "quizTodo", tone: "bg-blue-soft text-blue" },
  case_todo: { icon: Stethoscope, labelKey: "caseTodo", tone: "bg-rose-soft text-rose" },
  case_graded: { icon: CheckCircle2, labelKey: "caseGraded", tone: "bg-emerald-soft text-emerald" },
  attendance_low: { icon: CalendarCheck2, labelKey: "attendanceLow", tone: "bg-amber-soft text-amber" },
};

type Row = {
  key: string;
  icon: LucideIcon;
  tone: string;
  title: string;
  sub?: string;
  right?: string;
  onOpen: () => void;
  onDone?: () => void;
  doneBusy?: boolean;
};

/**
 * Bugun nima qilish kerak — o'qituvchi topshiriqlari, takrorlash, avto vazifalar
 * va kelgan baholar BITTA ro'yxatda (ilgari uchta alohida kartochka edi).
 */
export function HomeTasks({
  assigned,
  auto,
  review,
  notifications,
  isLoading,
  isError,
  onRetry,
  onDone,
  doneId,
  className,
}: {
  assigned: AssignedTask[];
  auto: AutoTask[];
  review: ReviewDueTopic[];
  notifications: Notification[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onDone: (id: number) => void;
  doneId: number | null;
  className?: string;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "student" });
  const { t: tt } = useTranslation(undefined, { keyPrefix: "tasks" });
  const locale = useLocale();
  const lang = locale === "ru" ? "ru" : "uz";
  const navigate = useNavigate();

  const rows: Row[] = [
    ...assigned.map<Row>((a) => ({
      key: `as${a.id}`,
      icon: ClipboardCheck,
      tone: "bg-violet-soft text-violet",
      title: a.title,
      sub: a.dueDate ? `${tt("dueShort")}: ${formatDate(lang, a.dueDate, "short")}` : tt("fromTeacher"),
      onOpen: () => navigate(a.linkUrl ?? "/app/tasks"),
      onDone: () => onDone(a.id),
      doneBusy: doneId === a.id,
    })),
    ...review.map<Row>((r) => ({
      key: `rv${r.topicId}`,
      icon: Repeat,
      tone: "bg-violet-soft text-violet",
      title: t("reviewRow", { topic: r.topicTitle }),
      sub: r.subjectName,
      right: String(r.dueCount),
      onOpen: () => navigate(`/app/grades?sub=takrorlash&topic=${r.topicId}`),
    })),
    ...auto.flatMap<Row>((task) => {
      const meta = AUTO_META[task.type];
      if (!meta) return [];
      const items = task.items ?? [];
      if (items.length === 0) {
        return [{ key: task.type, icon: meta.icon, tone: meta.tone, title: tt(meta.labelKey), onOpen: () => navigate(task.link) }];
      }
      return items.map<Row>((it, i) => ({
        key: `${task.type}-${i}`,
        icon: meta.icon,
        tone: meta.tone,
        title: `${tt(meta.labelKey)}: ${it.topicTitle}`,
        sub: it.courseName,
        right: it.value !== undefined && it.value !== null ? String(it.value) : undefined,
        onOpen: () => navigate(it.link),
      }));
    }),
    ...notifications.map<Row>((n) => ({
      key: `nt${n.caseAttemptId}`,
      icon: Medal,
      tone: "bg-emerald-soft text-emerald",
      title: t("caseGraded"),
      sub: n.topic,
      right: n.score !== null ? String(n.score) : undefined,
      onOpen: () => navigate(`/app/topics/${n.topicId}?tab=case`),
    })),
  ];
  const shown = rows.slice(0, MAX_ROWS);

  return (
    <BentoCard
      className={className}
      title={t("tasksTitle")}
      count={rows.length}
      action={{ label: t("allTasks"), onClick: () => navigate("/app/tasks") }}
      isLoading={isLoading}
      isError={isError}
      onRetry={onRetry}
      bodyClassName="px-2 pb-3"
    >
      {shown.length === 0 ? (
        <div className="flex flex-1 items-center gap-3 px-2 py-6">
          <Icon icon={Sparkles} size={20} className="text-emerald" />
          <p className="text-body font-semibold text-emerald">{tt("studentAllDone")}</p>
        </div>
      ) : (
        <ul className="space-y-0.5">
          {shown.map((r) => (
            <li key={r.key}>
              <BentoRow
                icon={r.icon}
                iconTone={r.tone}
                title={r.title}
                sub={r.sub}
                right={r.right}
                onClick={r.onOpen}
                arrow={!r.onDone}
                trailing={
                  r.onDone && (
                    <button
                      type="button"
                      onClick={r.onDone}
                      disabled={r.doneBusy}
                      aria-label={tt("markDone")}
                      title={tt("markDone")}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line text-ink-soft transition-colors hover:border-emerald hover:bg-emerald-soft hover:text-emerald focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50"
                    >
                      {r.doneBusy ? <Spinner size={12} /> : <Icon icon={Check} size={13} />}
                    </button>
                  )
                }
              />
            </li>
          ))}
        </ul>
      )}
    </BentoCard>
  );
}
