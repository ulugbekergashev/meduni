import { useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BarChart3, CalendarDays, NotebookPen } from "lucide-react";
import { Icon, cls } from "@meduni/ui";
import { SessionsView } from "./attendance/SessionsView";
import { ReportView } from "./attendance/ReportView";
import { JournalView } from "./attendance/JournalView";

const SUBS = [
  { key: "sessions", icon: CalendarDays, label: "tabSessions" },
  { key: "journal", icon: NotebookPen, label: "tabJournal" },
  { key: "report", icon: BarChart3, label: "tabReport" },
] as const;

export function SessionsTab() {
  const { id } = useParams();
  const courseId = Number(id);
  const { t } = useTranslation(undefined, { keyPrefix: "attendance" });
  const [params, setParams] = useSearchParams();
  const raw = params.get("sub");
  const sub = raw === "report" || raw === "journal" ? raw : "sessions";

  return (
    <div>
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-line">
        {SUBS.map((s) => (
          <button
            key={s.key}
            onClick={() => setParams({ sub: s.key }, { replace: true })}
            className={cls(
              "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13.5px] font-semibold transition-colors",
              sub === s.key ? "border-brand text-brand-deep" : "border-transparent text-ink-soft hover:text-ink"
            )}
          >
            <Icon icon={s.icon} size={16} />
            {t(s.label)}
          </button>
        ))}
      </div>

      {sub === "sessions" && <SessionsView courseId={courseId} />}
      {sub === "journal" && <JournalView courseId={courseId} />}
      {sub === "report" && <ReportView courseId={courseId} />}
    </div>
  );
}
