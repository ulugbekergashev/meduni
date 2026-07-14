import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Check, ShieldCheck, ShieldAlert, TriangleAlert } from "lucide-react";
import { Badge, Button, Card, Icon, Spinner, type BadgeTone } from "@meduni/ui";
import {
  useResolveFlag,
  useRunFactcheck,
  type ContentSummary,
  type TopicDetail,
} from "./api";

const kindKey: Record<string, string> = {
  quiz: "quizTitle",
  case: "caseTitle",
  presentation: "presentationTitle",
  video: "videoTitle",
};
const sevTone: Record<string, BadgeTone> = { high: "rose", medium: "amber", low: "slate" };

function ContentFactcheck({ topicId, item }: { topicId: number; item: ContentSummary }) {
  const { t } = useTranslation(undefined, { keyPrefix: "factcheck" });
  const { t: tg } = useTranslation(undefined, { keyPrefix: "generate" });
  const navigate = useNavigate();
  const run = useRunFactcheck(topicId);
  const resolve = useResolveFlag(topicId);

  const kindName = tg(kindKey[item.kind] ?? "quizTitle");
  const running = run.isPending || item.factcheckStatus === "checking";

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-section font-bold text-ink">{kindName}</h3>
        {item.factcheckStatus === "clean" && (
          <span className="inline-flex items-center gap-1.5 text-body font-semibold text-emerald">
            <Icon icon={ShieldCheck} size={16} /> {t("clean")}
          </span>
        )}
        {(item.factcheckStatus === "flagged" || item.factcheckStatus === "resolved") && (
          <Badge tone={item.factcheckStatus === "resolved" ? "emerald" : "amber"}>
            {t("flagged", { n: item.factcheckFlags.length })}
          </Badge>
        )}
      </div>

      {running ? (
        <div className="flex items-center gap-2 text-body text-ink-soft">
          <Spinner size={15} /> {t("running")}
        </div>
      ) : (
        <>
          {(item.factcheckStatus === "flagged" || item.factcheckStatus === "resolved") &&
            item.factcheckFlags.map((flag, i) => (
              <div
                key={i}
                className={
                  "rounded-control border p-3 " + (flag.resolved ? "border-line bg-bg" : "border-amber/30 bg-amber-soft")
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Icon icon={TriangleAlert} size={15} className={flag.resolved ? "text-ink-faint" : "text-amber"} />
                    <Badge tone={sevTone[flag.severity]}>{t(`sev.${flag.severity}`)}</Badge>
                    <span className="text-note text-ink-faint">
                      {t("at")}: {flag.location}
                    </span>
                  </div>
                  {flag.resolved && (
                    <span className="inline-flex items-center gap-1 text-note font-semibold text-emerald">
                      <Icon icon={Check} size={13} />
                      {flag.resolution === "fixed" ? t("resolvedFixed") : t("resolvedConfirmed")}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-body text-ink">{flag.claim}</p>
                {!flag.resolved && (
                  <div className="mt-2 flex gap-2">
                    <Button
                      variant="soft"
                      size="sm"
                      onClick={() => resolve.mutate({ contentId: item.id, flagIndex: i, resolution: "confirmed" })}
                    >
                      {t("confirm")}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/teach/content/${item.id}`)}>
                      {t("fix")}
                    </Button>
                  </div>
                )}
              </div>
            ))}

          <div>
            <Button
              variant={item.factcheckStatus === "none" ? "primary" : "ghost"}
              size="sm"
              icon={<Icon icon={ShieldAlert} size={15} />}
              onClick={() => run.mutate(item.id)}
            >
              {item.factcheckStatus === "none" ? t("run") : t("rerun")}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

export function FactcheckSection({ topic }: { topic: TopicDetail }) {
  const { t } = useTranslation(undefined, { keyPrefix: "factcheck" });

  if (topic.content.length === 0) {
    return <p className="text-body text-ink-soft">{t("needContent")}</p>;
  }
  return (
    <div className="space-y-3">
      {topic.content.map((item) => (
        <ContentFactcheck key={item.id} topicId={topic.id} item={item} />
      ))}
    </div>
  );
}
