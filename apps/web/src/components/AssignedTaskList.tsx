import { useTranslation } from "react-i18next";
import { CheckCircle2, Clock, UserRound } from "lucide-react";
import { Button, Card, Icon } from "@meduni/ui";
import { formatDate } from "../lib/date";

export interface AssignedTaskItem {
  id: number;
  title: string;
  description: string | null;
  dueDate: string | null;
  createdByName: string;
  createdAt: string;
  linkUrl: string | null;
}

/** Inbox of manually-assigned tasks with a "mark done" action. */
export function AssignedTaskList({
  items,
  onDone,
  pendingId,
  locale,
}: {
  items: AssignedTaskItem[];
  onDone: (id: number) => void;
  pendingId?: number | null;
  locale: string;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "tasks" });
  const fmt = (iso: string) => formatDate(locale === "ru" ? "ru" : "uz", iso, "short");

  return (
    <div className="space-y-2">
      {items.map((task) => {
        const overdue = task.dueDate && new Date(task.dueDate) < new Date();
        return (
          <Card key={task.id} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-body font-semibold text-ink">{task.title}</p>
              {task.description && <p className="mt-0.5 text-note text-ink-soft">{task.description}</p>}
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-note text-ink-faint">
                <span className="inline-flex items-center gap-1">
                  <Icon icon={UserRound} size={13} /> {task.createdByName}
                </span>
                {task.dueDate && (
                  <span className={`inline-flex items-center gap-1 ${overdue ? "font-semibold text-rose" : ""}`}>
                    <Icon icon={Clock} size={13} /> {fmt(task.dueDate)}
                  </span>
                )}
              </div>
            </div>
            <Button
              variant="soft"
              size="sm"
              icon={<Icon icon={CheckCircle2} size={15} />}
              onClick={() => onDone(task.id)}
              disabled={pendingId === task.id}
            >
              {t("markDone")}
            </Button>
          </Card>
        );
      })}
    </div>
  );
}
