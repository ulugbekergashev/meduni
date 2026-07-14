import { useTranslation } from "react-i18next";
import { CheckCircle2, Trash2 } from "lucide-react";
import { Card, Icon } from "@meduni/ui";

export interface CreatedTaskGroupItem {
  key: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  createdAt: string;
  total: number;
  done: number;
  assignees: string[];
  taskIds: number[];
}

/** Assignments I created, one card per batch, with a k/N completion counter. */
export function CreatedTaskList({
  items,
  onDelete,
  locale,
}: {
  items: CreatedTaskGroupItem[];
  onDelete: (group: CreatedTaskGroupItem) => void;
  locale: string;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "adminTasks" });
  const { t: tc } = useTranslation(undefined, { keyPrefix: "common" });
  const fmt = (iso: string) => new Date(iso).toLocaleDateString(locale === "ru" ? "ru-RU" : "uz-UZ", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="space-y-2">
      {items.map((g) => {
        const allDone = g.done === g.total;
        return (
          <Card key={g.key} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-body font-semibold text-ink">{g.title}</p>
                {allDone && <Icon icon={CheckCircle2} size={16} className="text-emerald" />}
              </div>
              {g.description && <p className="mt-0.5 text-note text-ink-soft">{g.description}</p>}
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-note text-ink-faint">
                <span className={allDone ? "font-semibold text-emerald" : "font-semibold text-ink-soft"}>
                  {t("progressLabel")}: {g.done}/{g.total}
                </span>
                {g.dueDate && <span>{t("dueLabel")}: {fmt(g.dueDate)}</span>}
                <span className="truncate">
                  {g.assignees.slice(0, 3).join(", ")}
                  {g.assignees.length > 3 ? " +" + (g.assignees.length - 3) : ""}
                </span>
              </div>
            </div>
            <button
              onClick={() => onDelete(g)}
              className="shrink-0 rounded-control p-1.5 text-ink-soft transition-colors hover:bg-rose-soft hover:text-rose"
              aria-label={tc("delete")}
            >
              <Icon icon={Trash2} size={16} />
            </button>
          </Card>
        );
      })}
    </div>
  );
}
