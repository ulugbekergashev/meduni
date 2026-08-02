import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Rocket } from "lucide-react";
import { Badge, Button, Card, Icon, useToast } from "@meduni/ui";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { useLocale } from "../../../lib/useLocale";
import { apiErrorMessage } from "../../../lib/api";
import { useContent, usePublishContent, useResumeVideo, type ContentSummary, type TopicDetail } from "./api";

const kindKey: Record<string, string> = {
  quiz: "quizTitle",
  case: "caseTitle",
  presentation: "presentationTitle",
  video: "videoTitle",
};

/** Bitta kontent — bitta bosishda tasdiqlab chop etiladi (tayyorlik ro'yxati YO'Q;
 *  buyurtmachi qarori 2026-07-27). Yagona to'siq — tasdiq oynasi, chunki chop
 *  etilgan kontentni talaba darrov ko'radi. */
function ContentPublish({ topic, item }: { topic: TopicDetail; item: ContentSummary }) {
  const { t } = useTranslation(undefined, { keyPrefix: "publish" });
  const { t: tg } = useTranslation(undefined, { keyPrefix: "generate" });
  const locale = useLocale();
  const { show } = useToast();
  const publish = usePublishContent(topic.id);
  const [confirm, setConfirm] = useState(false);

  const kindName = tg(kindKey[item.kind] ?? "quizTitle");
  const published = item.status === "published";

  // ⚠️ 2026-08-02 (buyurtmachi: "videoni chop etishda xato berayapdi"): server
  // to'g'ri rad etardi (montaj tugamagan), lekin UI faqat umumiy "Xatolik yuz
  // berdi" chiqarardi — o'qituvchi sababni ham, yechimni ham bilmasdi. Endi
  // video kartasi montaj holatini O'ZI biladi: tugmani bermaydi, sababni
  // yozadi va "Davom ettirish" taklif qiladi.
  const isVideo = item.kind === "video";
  const videoDetail = useContent(isVideo && !published ? item.id : 0);
  const build = videoDetail.data?.video;
  const videoReady = !isVideo || published || (build?.buildStatus === "done" && build?.hasMp4);
  const resume = useResumeVideo(build?.id ?? 0);
  const publishError = publish.isError ? apiErrorMessage(publish.error, locale) : null;

  return (
    <Card className={published ? "border-emerald/30 bg-emerald-soft" : "space-y-3"}>
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
          <p className="text-note text-ink-soft">{t("hint")}</p>
          {videoReady ? (
            <Button
              variant="deep"
              icon={<Icon icon={Rocket} size={16} />}
              disabled={publish.isPending}
              onClick={() => setConfirm(true)}
            >
              {t("publishBtn")}
            </Button>
          ) : (
            <div className="space-y-2 rounded-control border border-amber bg-amber-soft px-3 py-2.5">
              <p className="text-note font-semibold text-amber">
                {t("videoNotBuilt")}
                {build?.errorStage ? ` (${build.errorStage})` : ""}
              </p>
              <Button
                size="sm"
                variant="soft"
                disabled={resume.isPending}
                onClick={() => resume.mutate()}
              >
                {t("videoResume")}
              </Button>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirm}
        title={t("confirmTitle")}
        message={t("confirmMsg")}
        confirmLabel={t("confirmBtn")}
        confirmVariant="primary"
        loading={publish.isPending}
        errorMessage={publishError}
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
