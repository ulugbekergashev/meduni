import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CalendarCheck, CheckCircle2, ClipboardList, PlayCircle, Sparkles, Stethoscope, type LucideIcon } from "lucide-react";
import { Card, Icon, Spinner } from "@meduni/ui";
import { TaskCard } from "../../components/TaskCard";
import { AssignedTaskList } from "../../components/AssignedTaskList";
import { useLocale } from "../../lib/useLocale";
import { useMyTasks, useSetMyTaskDone } from "./api";

const META: Record<string, { icon: LucideIcon; labelKey: string }> = {
  study: { icon: PlayCircle, labelKey: "study" },
  quiz_todo: { icon: ClipboardList, labelKey: "quizTodo" },
  case_todo: { icon: Stethoscope, labelKey: "caseTodo" },
  case_graded: { icon: CheckCircle2, labelKey: "caseGraded" },
  attendance_low: { icon: CalendarCheck, labelKey: "attendanceLow" },
};

export function StudentTasksPage() {
  const { t } = useTranslation(undefined, { keyPrefix: "tasks" });
  const navigate = useNavigate();
  const locale = useLocale();
  const q = useMyTasks();
  const done = useSetMyTaskDone();
  const auto = q.data?.auto ?? [];
  const assigned = q.data?.assigned ?? [];

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-h1 font-bold text-ink">{t("studentTitle")}</h1>
      <p className="mt-0.5 text-note text-ink-faint">{t("studentHint")}</p>

      {/* Teacher assignments */}
      {assigned.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-section font-bold text-ink">{t("teacherAssignedSection")}</h2>
          <AssignedTaskList items={assigned} onDone={(id) => done.mutate(id)} pendingId={done.isPending ? (done.variables as number) : null} locale={locale} />
        </section>
      )}

      <section className="mt-6">
        {q.isLoading ? (
          <div className="flex h-24 items-center justify-center">
            <Spinner size={22} />
          </div>
        ) : q.isError ? (
          <Card>
            <p className="py-4 text-center text-body text-rose">{t("error")}</p>
          </Card>
        ) : auto.length === 0 ? (
          <Card className="flex items-center gap-3 border-emerald/40 bg-emerald-soft">
            <Icon icon={Sparkles} size={22} className="text-emerald" />
            <p className="text-body font-semibold text-emerald">{t("studentAllDone")}</p>
          </Card>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {auto.map((task) => {
              const meta = META[task.type];
              if (!meta) return null;
              const value = task.type === "attendance_low" ? `${task.count}%` : task.count;
              return (
                <TaskCard
                  key={task.type}
                  icon={meta.icon}
                  tone={task.tone}
                  value={value}
                  label={t(meta.labelKey)}
                  onClick={() => navigate(task.link)}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
