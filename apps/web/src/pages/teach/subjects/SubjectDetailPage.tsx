import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, BookMarked, ExternalLink, Users2 } from "lucide-react";
import { Card, Icon, Spinner, StackedBar } from "@meduni/ui";
import { TopicListSection } from "../topics/TopicListSection";
import { useSubject } from "../topics/api";

function MiniStat({ value, label, tone }: { value: number | string; label: string; tone: string }) {
  return (
    <div>
      <p className={`text-[24px] font-bold leading-none tabular-nums ${tone}`}>{value}</p>
      <p className="mt-1 text-note text-ink-soft">{label}</p>
    </div>
  );
}

/** Fan sahifasi — kafedra-markazlashgan kontent (mavzular fanga tegishli). */
export function SubjectDetailPage() {
  const { id } = useParams();
  const subjectId = Number(id);
  const { t } = useTranslation(undefined, { keyPrefix: "subjects" });
  const navigate = useNavigate();
  const q = useSubject(subjectId);
  const s = q.data;

  if (q.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner size={26} />
      </div>
    );
  }
  if (q.isError || !s) {
    return (
      <Card>
        <p className="py-8 text-center text-body text-rose">{t("loadError")}</p>
      </Card>
    );
  }

  return (
    <div>
      <button
        onClick={() => navigate("/teach/subjects")}
        className="mb-3 flex items-center gap-1 text-body font-medium text-brand-deep hover:underline"
      >
        <Icon icon={ArrowLeft} size={15} />
        {t("backToList")}
      </button>

      {/* Fan shapkasi */}
      <Card className="flex flex-wrap items-center justify-between gap-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-deep">
            <Icon icon={BookMarked} size={22} />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-h1 font-bold text-ink">{s.name}</h1>
            <p className="flex items-center gap-1.5 truncate text-body text-ink-soft">
              <Icon icon={Users2} size={14} /> {s.departmentName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-7">
          <MiniStat value={s.topicsTotal} label={t("topicsTotal")} tone="text-ink" />
          <MiniStat value={s.published} label={t("publishedTopics")} tone="text-emerald" />
          <MiniStat value={s.inProgress} label={t("inProgressTopics")} tone="text-amber" />
        </div>

        {s.myCourseId && (
          <button
            onClick={() => navigate(`/teach/courses/${s.myCourseId}`)}
            className="flex items-center gap-1.5 rounded-control border border-line px-3 py-2 text-body font-semibold text-ink-soft transition-colors hover:bg-bg hover:text-ink"
          >
            <Icon icon={ExternalLink} size={15} />
            {t("myCourse")}
          </button>
        )}
      </Card>

      {s.topicsTotal > 0 && (
        <div className="mt-3">
          <StackedBar
            total={s.topicsTotal}
            segments={[
              { value: s.published, tone: "emerald" },
              { value: s.inProgress, tone: "amber" },
            ]}
          />
        </div>
      )}

      <div className="mt-6">
        <TopicListSection scope={{ subjectId }} />
      </div>
    </div>
  );
}
