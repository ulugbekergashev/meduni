import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Rocket, X } from "lucide-react";
import { Badge, Button, Card, Icon, useToast } from "@meduni/ui";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { useLocale } from "../../../lib/useLocale";
import { usePublishContent, type ContentSummary, type TopicDetail } from "./api";

const kindKey: Record<string, string> = {
  quiz: "quizTitle",
  case: "caseTitle",
  presentation: "presentationTitle",
  video: "videoTitle",
};

function CheckRow({ ok, label, doHint }: { ok: boolean; label: string; doHint: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon icon={ok ? Check : X} size={16} className={ok ? "mt-0.5 text-emerald" : "mt-0.5 text-rose"} />
      <div>
        <span className={"text-body " + (ok ? "text-ink" : "text-ink-soft")}>{label}</span>
        {!ok && <p className="text-note text-ink-faint">{doHint}</p>}
      </div>
    </div>
  );
}

function ContentPublish({ topic, item }: { topic: TopicDetail; item: ContentSummary }) {
  const { t } = useTranslation(undefined, { keyPrefix: "publish" });
  const { t: tg } = useTranslation(undefined, { keyPrefix: "generate" });
  const locale = useLocale();
  const { show } = useToast();
  const publish = usePublishContent(topic.id);
  const [confirm, setConfirm] = useState(false);

  const kindName = tg(kindKey[item.kind] ?? "quizTitle");
  const digestOk = topic.generateUnlocked;
  const reviewedOk = item.reviewOpened;
  const allOk = digestOk && reviewedOk;
  const published = item.status === "published";

  return (
    <Card className={published ? "border-emerald/30 bg-emerald-soft" : "space-y-4"}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-section font-bold text-ink">{kindName}</h3>
        {published && <Badge tone="emerald">{t("published")}</Badge>}
      </div>

      {published ? (
        <p className="mt-1 text-note text-emerald">
          {t("stamp", {
            name: item.approvedByName ?? "",
            date: item.approvedAt ? new Date(item.approvedAt).toLocaleDateString(locale === "ru" ? "ru" : "uz") : "",
          })}
        </p>
      ) : (
        <>
          <div className="space-y-2">
            <CheckRow ok={digestOk} label={t("cDigest")} doHint={t("cDigestDo")} />
            <CheckRow ok={reviewedOk} label={t("cReviewed")} doHint={t("cReviewedDo")} />
          </div>
          <Button
            variant="deep"
            icon={<Icon icon={Rocket} size={16} />}
            disabled={!allOk || publish.isPending}
            onClick={() => setConfirm(true)}
          >
            {t("publishBtn")}
          </Button>
        </>
      )}

      <ConfirmDialog
        open={confirm}
        title={t("confirmTitle")}
        message={t("confirmMsg")}
        confirmLabel={t("confirmBtn")}
        confirmVariant="primary"
        loading={publish.isPending}
        onConfirm={() =>
          publish.mutate(item.id, {
            onSuccess: () => {
              setConfirm(false);
              show(t("publishedMsg"));
            },
          })
        }
        onClose={() => setConfirm(false)}
      />
    </Card>
  );
}

export function PublishSection({ topic }: { topic: TopicDetail }) {
  const { t } = useTranslation(undefined, { keyPrefix: "publish" });
  if (topic.content.length === 0) {
    return <p className="text-body text-ink-soft">{t("needContent")}</p>;
  }
  return (
    <div className="space-y-3">
      {topic.content.map((item) => (
        <ContentPublish key={item.id} topic={topic} item={item} />
      ))}
    </div>
  );
}
