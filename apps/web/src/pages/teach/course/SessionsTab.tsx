import { useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BarChart3, CalendarDays } from "lucide-react";
import { Icon, cls } from "@meduni/ui";
import { SessionsView } from "./attendance/SessionsView";
import { ReportView } from "./attendance/ReportView";

export function SessionsTab() {
  const { id } = useParams();
  const courseId = Number(id);
  const { t } = useTranslation(undefined, { keyPrefix: "attendance" });
  const [params, setParams] = useSearchParams();
  const sub = params.get("sub") === "report" ? "report" : "sessions";

  return (
    <div>
      <div className="mb-4 flex gap-1 border-b border-line">
        {(["sessions", "report"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setParams({ sub: k }, { replace: true })}
            className={cls(
              "flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13.5px] font-semibold transition-colors",
              sub === k ? "border-brand text-brand-deep" : "border-transparent text-ink-soft hover:text-ink"
            )}
          >
            <Icon icon={k === "sessions" ? CalendarDays : BarChart3} size={16} />
            {t(k === "sessions" ? "tabSessions" : "tabReport")}
          </button>
        ))}
      </div>

      {sub === "sessions" ? <SessionsView courseId={courseId} /> : <ReportView courseId={courseId} />}
    </div>
  );
}
