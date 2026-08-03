import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Rocket } from "lucide-react";
import { Badge, Button, Card, Icon, Spinner, useToast } from "@meduni/ui";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { useLocale } from "../../../lib/useLocale";
import { apiErrorMessage } from "../../../lib/api";
import { useContent, usePublishContent, useResumeVideo, type ContentFull, type ContentSummary, type TopicDetail } from "./api";

const kindKey: Record<string, string> = {
  quiz: "quizTitle",
  case: "caseTitle",
  presentation: "presentationTitle",
  video: "videoTitle",
};

/**
 * Kontent TARKIBI bir qatorda — o'qituvchi har birini ochmasdan nima chop
 * etayotganini ko'radi (buyurtmachi 2026-08-03).
 *
 * Rasm yetishmasa yoki video fayli yo'q bo'lsa — amber, chunki aynan shu ikki
 * holat talabada "bo'sh ekran" bo'lib chiqadi (o'lchandi: topic 7 videosining
 * ovoz fayli jonli xotirada yo'q edi, karta esa "Chop etilgan" derdi).
 */
function ReadyLine({ detail, loading }: { detail?: ContentFull; loading: boolean }) {
  const { t } = useTranslation(undefined, { keyPrefix: "publish" });
  if (loading || !detail) return <p className="mt-0.5 text-micro text-ink-faint">…</p>;

  const parts: { text: string; warn?: boolean }[] = [];

  if (detail.quiz) parts.push({ text: t("nQuestions", { n: detail.quiz.questions.length }) });

  if (detail.clinicalCase) {
    const steps = (detail.clinicalCase.caseJson as { steps?: unknown[] })?.steps?.length ?? 0;
    parts.push({ text: steps ? t("nSteps", { n: steps }) : t("caseReady") });
  }

  if (detail.presentation) {
    const slides = detail.presentation.slides.length;
    const withImg = detail.presentation.slides.filter((s) => s.imageSlots.some((x) => x.status === "DONE")).length;
    parts.push({ text: t("nSlides", { n: slides }) });
    parts.push({ text: t("nImages", { n: withImg, total: slides }), warn: withImg < slides });
  }

  if (detail.video) {
    const d = detail.video.durationSec ?? 0;
    if (d > 0) parts.push({ text: `${Math.floor(d / 60)}:${String(d % 60).padStart(2, "0")}` });
    const frames = (detail.video.script ?? []).filter((s) => !!s.visualImageUrl).length;
    if (frames) parts.push({ text: t("nFrames", { n: frames }) });
    parts.push({
      text: detail.video.hasAudio || detail.video.hasMp4 ? t("audioReady") : t("audioMissing"),
      warn: !(detail.video.hasAudio || detail.video.hasMp4),
    });
  }

  if (!parts.length) return null;
  return (
    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-micro">
      {parts.map((p, i) => (
        <span key={i} className={p.warn ? "font-semibold text-amber" : "text-ink-soft"}>
          {i > 0 && <span className="mr-1.5 text-ink-faint">·</span>}
          {p.text}
        </span>
      ))}
    </p>
  );
}

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

  // ⚠️ 2026-08-03 (buyurtmachi: "chop etishdan oldin video, prezentatsiya va
  // boshqalar tayyorligini o'qituvchi ko'rsin, ichiga kirishi shart emas"):
  // har karta o'z TARKIBINI qisqa fakt qatorida ko'rsatadi — nechta savol,
  // nechta slayd va ulardan nechtasida rasm bor, video necha daqiqa.
  // Ilgari buni bilish uchun har birini alohida ochish kerak edi.
  const detail = useContent(item.id);

  // ⚠️ 2026-08-02 (buyurtmachi: "videoni chop etishda xato berayapdi"): server
  // to'g'ri rad etardi (montaj tugamagan), lekin UI faqat umumiy "Xatolik yuz
  // berdi" chiqarardi — o'qituvchi sababni ham, yechimni ham bilmasdi. Endi
  // video kartasi montaj holatini O'ZI biladi: tugmani bermaydi, sababni
  // yozadi va "Davom ettirish" taklif qiladi.
  const isVideo = item.kind === "video";
  const build = detail.data?.video;
  const stage = build?.buildStatus ?? "";
  /** Ayni damda ishlayaptimi (server fon-jobi) — polling bilan jonli yangilanadi. */
  const building = ["pending", "script", "tts", "render"].includes(stage);
  const stopped = stage === "error";
  const videoReady = !isVideo || published || (stage === "done" && (build?.hasAudio || build?.hasMp4));
  const resume = useResumeVideo(build?.id ?? 0);
  const publishError = publish.isError ? apiErrorMessage(publish.error, locale) : null;

  return (
    <Card className={published ? "border-emerald/30 bg-emerald-soft" : "space-y-3"}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-section font-bold text-ink">{kindName}</h3>
          <ReadyLine detail={detail.data} loading={detail.isLoading} />
        </div>
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
          ) : building ? (
            /* ⚠️ Buyurtmachi: "bir video generatsiya bo'ldimi? yoqmi? to'xtab
               qoldimi — bilmay o'tiribman". Endi karta AYNI DAMDAGI holatni
               ko'rsatadi va o'zi yangilanib turadi (2s polling). */
            <div className="space-y-2 rounded-control border border-brand bg-brand-soft px-3 py-2.5">
              <p className="flex items-center gap-2 text-note font-semibold text-brand-tint">
                <Spinner size={14} />
                {tg(`vStep.${stage === "pending" ? "script" : stage}`)}
                {stage === "tts" && build?.progress?.total
                  ? ` — ${build.progress.done}/${build.progress.total}`
                  : ""}
              </p>
              {stage === "tts" && !!build?.progress?.total && (
                <div className="h-1 overflow-hidden rounded-pill bg-surface">
                  <div
                    className="h-full rounded-pill bg-brand transition-[width] duration-500"
                    style={{ width: `${Math.max(Math.round((build.progress.done / build.progress.total) * 100), 3)}%` }}
                  />
                </div>
              )}
              <p className="text-micro text-ink-soft">{tg("vLongHint")}</p>
            </div>
          ) : (
            <div className="space-y-2 rounded-control border border-amber bg-amber-soft px-3 py-2.5">
              <p className="text-note font-semibold text-amber">
                {stopped ? t("videoStopped") : t("videoNotBuilt")}
              </p>
              {stopped && build?.errorStage && (
                <p className="break-words text-micro text-ink-soft">{build.errorStage}</p>
              )}
              <Button size="sm" variant="soft" disabled={resume.isPending} onClick={() => resume.mutate()}>
                {resume.isPending ? tg("vStep.script") : t("videoResume")}
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
