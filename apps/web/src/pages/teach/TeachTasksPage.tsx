import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  FileClock,
  FileStack,
  ShieldAlert,
  Sparkles,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { Card, Icon, Spinner } from "@meduni/ui";
import { TaskCard } from "../../components/TaskCard";
import { useTeachTasks } from "./api";

const META: Record<string, { icon: LucideIcon; labelKey: string }> = {
  cases_review: { icon: ClipboardCheck, labelKey: "casesReview" },
  material_missing: { icon: FileStack, labelKey: "materialMissing" },
  digest_approve: { icon: BookOpen, labelKey: "digestApprove" },
  content_create: { icon: Sparkles, labelKey: "contentCreate" },
  content_publish: { icon: FileClock, labelKey: "contentPublish" },
  factcheck: { icon: ShieldAlert, labelKey: "factcheck" },
  attendance_unmarked: { icon: CalendarCheck, labelKey: "attendanceUnmarked" },
  students_behind: { icon: UserX, labelKey: "studentsBehind" },
};

export function TeachTasksPage() {
  const { t } = useTranslation(undefined, { keyPrefix: "tasks" });
  const navigate = useNavigate();
  const q = useTeachTasks();
  const auto = q.data?.auto ?? [];

  return (
    <div>
      <h1 className="text-h1 font-bold text-ink">{t("myTasks")}</h1>
      <p className="mt-0.5 text-note text-ink-faint">{t("myTasksHint")}</p>

      <section className="mt-6">
        <h2 className="mb-3 text-section font-bold text-ink">{t("autoSection")}</h2>
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
            <Icon icon={CheckCircle2} size={22} className="text-emerald" />
            <p className="text-body font-semibold text-emerald">{t("allDone")}</p>
          </Card>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {auto.map((task) => {
              const meta = META[task.type];
              if (!meta) return null;
              return (
                <TaskCard
                  key={task.type}
                  icon={meta.icon}
                  tone={task.tone}
                  value={task.count}
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
