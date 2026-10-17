import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, CheckCircle2, ClipboardCheck, DoorClosed, Sparkles, Users2 } from "lucide-react";
import { Icon, cls } from "@meduni/ui";
import { useLocale } from "../../../lib/useLocale";
import { taskAge, taskIcon, type RollCallTarget } from "../tasks/TaskItemRow";
import { useSetTaskDone, type DerivedLesson, type TeacherTaskItem } from "../api";

const darkPill =
  "inline-flex h-10 items-center gap-2 rounded-pill bg-ink px-4 text-note font-semibold text-surface transition-colors hover:bg-ink-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-50";

/** Yo'qlama chizig'i: har talaba bitta segment emas — ulush (belgilangan / ro'yxat). */
function MarkedTrack({ marked, total }: { marked: number; total: number }) {
  if (total <= 0) return null;
  const pct = Math.round((marked / total) * 100);
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-pill bg-ink/10">
      {pct > 0 && <span className="block h-full rounded-pill bg-ink" style={{ width: `${pct}%` }} />}
    </span>
  );
}

function Shell({ children, side }: { children: ReactNode; side?: ReactNode }) {
  return (
    <section className="flex h-full flex-col gap-4 rounded-card bg-brand-soft p-5 sm:flex-row sm:items-stretch">
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      {side && (
        <div className="flex shrink-0 flex-row items-end justify-between gap-2 border-t border-ink/10 pt-3 sm:flex-col sm:items-end sm:justify-start sm:border-0 sm:pt-0 sm:text-right">
          {side}
        </div>
      )}
    </section>
  );
}

function Kicker({ icon, children }: { icon: typeof Users2; children: ReactNode }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 self-start truncate rounded-pill bg-surface/70 px-2.5 py-1 text-micro font-semibold text-brand-deep">
      <Icon icon={icon} size={13} />
      {children}
    </span>
  );
}

/**
 * Bosh sahifaning YAGONA yoritilgan yuzasi — "hozir eng muhimi nima".
 * Ustuvorlik: (1) bugungi yo'qlamasi to'liq bo'lmagan dars → bir bosishda
 * yo'qlama; (2) bo'lmasa — eng shoshilinch vazifa; (3) hammasi bajarilgan.
 */
export function TeachHero({
  lesson,
  task,
  waitingCount,
  avgProgress,
  onRollCall,
}: {
  lesson: DerivedLesson | null;
  task: TeacherTaskItem | null;
  /** Hero'dagi vazifadan tashqari yana nechta ochiq vazifa bor. */
  waitingCount: number;
  avgProgress: number | null;
  onRollCall: (target: RollCallTarget) => void;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "teach" });
  const { t: tk } = useTranslation(undefined, { keyPrefix: "tasks" });
  const navigate = useNavigate();
  const locale = useLocale();
  const done = useSetTaskDone();

  if (lesson) {
    return (
      <Shell
        side={
          <>
            <p className="text-display font-semibold tabular-nums text-ink">{lesson.startTime}</p>
            <p className="text-micro text-ink-2">{t("heroStartsAt")}</p>
          </>
        }
      >
        <Kicker icon={ClipboardCheck}>{t("heroNextLesson")}</Kicker>
        <h2 className="mt-3 truncate text-h1 font-semibold text-ink">{lesson.courseName}</h2>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 text-note text-ink-2">
          {lesson.groupName && (
            <span className="inline-flex items-center gap-1">
              <Icon icon={Users2} size={14} /> {lesson.groupName}
            </span>
          )}
          {lesson.room && (
            <span className="inline-flex items-center gap-1">
              <Icon icon={DoorClosed} size={14} /> {lesson.room}
            </span>
          )}
        </p>
        <div className="mt-auto pt-4">
          {lesson.rosterSize > 0 && (
            <div className="mb-4 max-w-md">
              <MarkedTrack marked={lesson.markedCount} total={lesson.rosterSize} />
              <p className="mt-1.5 text-micro text-ink-2">
                {t("heroMarkedOf", { m: lesson.markedCount, n: lesson.rosterSize })}
              </p>
            </div>
          )}
          <button
            type="button"
            className={darkPill}
            onClick={() =>
              onRollCall({
                courseId: lesson.courseId,
                date: lesson.dayKey,
                startTime: lesson.startTime,
                groupId: lesson.groupId,
                heading: `${lesson.courseName} · ${lesson.startTime}`,
              })
            }
          >
            <Icon icon={ClipboardCheck} size={16} />
            {t("heroRollCall")}
          </button>
        </div>
      </Shell>
    );
  }

  if (task) {
    const meta = taskIcon(task);
    const qa = task.quickAction;
    const days = task.sinceIso ? Math.floor((Date.now() - new Date(task.sinceIso).getTime()) / 86_400_000) : null;
    const age = taskAge(task, locale === "ru" ? "ru" : "uz", tk);
    const open = () => {
      if (qa?.type === "attendance") {
        onRollCall({
          courseId: qa.courseId,
          date: qa.date,
          startTime: qa.startTime,
          groupId: qa.groupId,
          heading: `${task.title}${task.subtitle ? " · " + task.subtitle : ""}`,
        });
      } else if (task.link) {
        navigate(task.link);
      }
    };
    const canOpen = qa?.type === "attendance" || !!task.link;

    return (
      <Shell
        side={
          days !== null && days > 0 ? (
            <>
              <p className="text-display font-semibold tabular-nums text-ink">{days}</p>
              <p className="text-micro text-ink-2">{t("heroDaysWaiting")}</p>
            </>
          ) : undefined
        }
      >
        <Kicker icon={meta.icon}>
          {t("heroFirst")} · {tk(meta.labelKey)}
        </Kicker>
        <h2 className="mt-3 truncate text-h1 font-semibold text-ink">{task.title}</h2>
        {(task.subtitle || task.description) && (
          <p className="mt-1 truncate text-note text-ink-2">{task.subtitle ?? task.description}</p>
        )}
        {age.overdue && <p className="mt-1 text-note font-semibold text-rose">{age.text}</p>}
        <div className="mt-auto flex flex-wrap items-center gap-3 pt-4">
          {qa?.type === "done" ? (
            <button type="button" className={darkPill} disabled={done.isPending} onClick={() => done.mutate(qa.taskId)}>
              <Icon icon={CheckCircle2} size={16} />
              {tk("markDone")}
            </button>
          ) : canOpen ? (
            <button type="button" className={darkPill} onClick={open}>
              {qa?.type === "attendance" ? tk("markAttendanceBtn") : t("heroOpen")}
              <Icon icon={ArrowRight} size={16} />
            </button>
          ) : null}
          {waitingCount > 0 && (
            <span className="text-note text-ink-2">{t("heroMoreTasks", { n: waitingCount })}</span>
          )}
        </div>
      </Shell>
    );
  }

  return (
    <Shell
      side={
        avgProgress !== null ? (
          <>
            <p className="text-display font-semibold tabular-nums text-ink">{avgProgress}%</p>
            <p className="text-micro text-ink-2">{t("statAvgProgress")}</p>
          </>
        ) : undefined
      }
    >
      <Kicker icon={Sparkles}>{t("navToday")}</Kicker>
      <h2 className={cls("mt-3 truncate text-h1 font-semibold text-ink")}>{t("heroAllDone")}</h2>
      <p className="mt-1 text-note text-ink-2">{t("heroAllDoneSub")}</p>
      <div className="mt-auto pt-4">
        <button type="button" className={darkPill} onClick={() => navigate("/teach/courses")}>
          {t("heroGoCourses")}
          <Icon icon={ArrowRight} size={16} />
        </button>
      </div>
    </Shell>
  );
}
