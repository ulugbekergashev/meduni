import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Check, FileStack, Lock } from "lucide-react";
import { Badge, Card, Icon, Spinner, cls } from "@meduni/ui";
import { useLocale } from "../../../lib/useLocale";
import { MaterialsSection } from "./MaterialsSection";
import { useTopicDetail } from "./api";

type StepState = "done" | "current" | "locked";

function ProgressTrack({ materialDone }: { materialDone: boolean }) {
  const { t } = useTranslation(undefined, { keyPrefix: "constructor.steps" });
  const steps: { key: string; state: StepState }[] = [
    { key: "material", state: materialDone ? "done" : "current" },
    { key: "digest", state: "locked" },
    { key: "generate", state: "locked" },
    { key: "factcheck", state: "locked" },
    { key: "publish", state: "locked" },
  ];

  return (
    <div className="flex items-center gap-2 overflow-x-auto">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <span
              className={cls(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold",
                s.state === "done" && "bg-emerald text-white",
                s.state === "current" && "bg-brand text-white",
                s.state === "locked" && "bg-bg text-ink-faint"
              )}
            >
              {s.state === "done" ? <Icon icon={Check} size={15} /> : i + 1}
            </span>
            <span
              className={cls(
                "whitespace-nowrap text-[13px] font-medium",
                s.state === "locked" ? "text-ink-faint" : "text-ink"
              )}
            >
              {t(s.key)}
            </span>
          </div>
          {i < steps.length - 1 && <span className="h-px w-6 bg-line" />}
        </div>
      ))}
    </div>
  );
}

function LockedSection({ titleKey, hintKey }: { titleKey: string; hintKey: string }) {
  const { t } = useTranslation(undefined, { keyPrefix: "constructor" });
  return (
    <Card className="opacity-70">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-bg text-ink-faint">
          <Icon icon={Lock} size={16} />
        </div>
        <div>
          <p className="text-section font-bold text-ink-soft">{t(titleKey)}</p>
          <p className="text-[12.5px] text-ink-faint">{t(hintKey)}</p>
        </div>
      </div>
    </Card>
  );
}

export function TopicConstructor() {
  const { id } = useParams();
  const topicId = Number(id);
  const { t } = useTranslation(undefined, { keyPrefix: "constructor" });
  const { t: tt } = useTranslation(undefined, { keyPrefix: "topics" });
  const locale = useLocale();
  const navigate = useNavigate();

  const detail = useTopicDetail(topicId);

  if (detail.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner size={28} />
      </div>
    );
  }
  if (detail.isError || !detail.data) {
    return (
      <div>
        <button onClick={() => navigate("/teach")} className="text-[13.5px] font-medium text-brand-deep hover:underline">
          {t("back")}
        </button>
        <Card className="mt-4">
          <p className="py-6 text-center text-[13.5px] text-rose">{tt("empty")}</p>
        </Card>
      </div>
    );
  }

  const topic = detail.data;

  return (
    <div>
      <button
        onClick={() => navigate(`/teach/courses/${topic.courseId}/topics`)}
        className="text-[13.5px] font-medium text-brand-deep hover:underline"
      >
        {t("back")}
      </button>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h1 font-bold text-ink">{locale === "ru" ? topic.titleRu : topic.titleUz}</h1>
          <p className="text-[13.5px] text-ink-faint">{locale === "ru" ? topic.titleUz : topic.titleRu}</p>
        </div>
        <Badge tone={topic.status === "published" ? "emerald" : "slate"}>{tt(`status.${topic.status}`)}</Badge>
      </div>

      {/* Progress track */}
      <Card className="mt-6">
        <ProgressTrack materialDone={topic.digestUnlocked} />
      </Card>

      {/* Section 1 — Materials (fully working) */}
      <section className="mt-6">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-brand-deep">
            <Icon icon={FileStack} size={16} />
          </div>
          <h2 className="text-section font-bold text-ink">1. {t("sections.materials")}</h2>
        </div>
        <MaterialsSection topicId={topicId} materials={topic.materials} />
      </section>

      {/* Locked sections (next modules) */}
      <div className="mt-6 space-y-3">
        <LockedSection titleKey="sections.digest" hintKey="sectionLocked.digest" />
        <LockedSection titleKey="sections.generate" hintKey="sectionLocked.generate" />
        <LockedSection titleKey="sections.factcheck" hintKey="sectionLocked.factcheck" />
        <LockedSection titleKey="sections.publish" hintKey="sectionLocked.publish" />
      </div>
    </div>
  );
}
