import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BookOpen, Check, FileStack, Lock } from "lucide-react";
import { Badge, Card, Icon, Spinner, cls } from "@meduni/ui";
import { useLocale } from "../../../lib/useLocale";
import { MaterialsSection } from "./MaterialsSection";
import { DigestSection } from "./DigestSection";
import { useTopicDetail } from "./api";

type StepState = "done" | "current" | "locked";

function ProgressTrack({ materialDone, digestApproved }: { materialDone: boolean; digestApproved: boolean }) {
  const { t } = useTranslation(undefined, { keyPrefix: "constructor.steps" });
  const steps: { key: string; state: StepState }[] = [
    { key: "material", state: materialDone ? "done" : "current" },
    { key: "digest", state: digestApproved ? "done" : materialDone ? "current" : "locked" },
    { key: "generate", state: digestApproved ? "current" : "locked" },
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

function SectionHeader({ n, icon, title }: { n: number; icon: typeof Lock; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-brand-deep">
        <Icon icon={icon} size={16} />
      </div>
      <h2 className="text-section font-bold text-ink">
        {n}. {title}
      </h2>
    </div>
  );
}

function LockedSection({ n, titleKey, hintKey }: { n: number; titleKey: string; hintKey: string }) {
  const { t } = useTranslation(undefined, { keyPrefix: "constructor" });
  return (
    <Card className="opacity-70">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-bg text-ink-faint">
          <Icon icon={Lock} size={16} />
        </div>
        <div>
          <p className="text-section font-bold text-ink-soft">
            {n}. {t(titleKey)}
          </p>
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
        <ProgressTrack materialDone={topic.digestUnlocked} digestApproved={topic.generateUnlocked} />
      </Card>

      {/* Section 1 — Materials (fully working) */}
      <section className="mt-6">
        <SectionHeader n={1} icon={FileStack} title={t("sections.materials")} />
        <MaterialsSection topicId={topicId} materials={topic.materials} />
      </section>

      {/* Section 2 — Konspekt (digest): unlocks once a material is DONE */}
      <section className="mt-6">
        {topic.digestUnlocked ? (
          <>
            <SectionHeader n={2} icon={BookOpen} title={t("sections.digest")} />
            <DigestSection topic={topic} />
          </>
        ) : (
          <LockedSection n={2} titleKey="sections.digest" hintKey="sectionLocked.digest" />
        )}
      </section>

      {/* Section 3 — Generatsiya: first lock — needs an APPROVED digest */}
      <section className="mt-6">
        {topic.generateUnlocked ? (
          <Card>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-brand-deep">
                <span className="text-[13px] font-bold">3</span>
              </div>
              <div>
                <p className="text-section font-bold text-ink">{t("sections.generate")}</p>
                <p className="text-[12.5px] text-ink-soft">{t("generateSoon")}</p>
              </div>
            </div>
          </Card>
        ) : (
          <LockedSection n={3} titleKey="sections.generate" hintKey="sectionLocked.generate" />
        )}
      </section>

      {/* Remaining locked sections */}
      <div className="mt-6 space-y-3">
        <LockedSection n={4} titleKey="sections.factcheck" hintKey="sectionLocked.factcheck" />
        <LockedSection n={5} titleKey="sections.publish" hintKey="sectionLocked.publish" />
      </div>
    </div>
  );
}
