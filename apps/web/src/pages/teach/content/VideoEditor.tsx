import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Download, FileDown, RefreshCw } from "lucide-react";
import { Button, Card, Icon, Spinner, Textarea, useToast } from "@meduni/ui";
import { API_BASE, useRebuildVideo, useUpdateContent, type ContentFull, type ScriptSegment } from "../topics/api";

// Convert an SRT string to a WebVTT blob URL so <track> can render subtitles.
function srtToVttUrl(srt: string): string {
  const vtt = "WEBVTT\n\n" + srt.replace(/(\d\d:\d\d:\d\d),(\d\d\d)/g, "$1.$2");
  return URL.createObjectURL(new Blob([vtt], { type: "text/vtt" }));
}

export function VideoEditor({ content }: { content: ContentFull }) {
  const { t } = useTranslation(undefined, { keyPrefix: "videoEditor" });
  const navigate = useNavigate();
  const { show } = useToast();
  const video = content.video!;
  const update = useUpdateContent(content.id);
  const rebuild = useRebuildVideo(video.id);

  const [script, setScript] = useState<ScriptSegment[]>(video.script);
  const [vttUrl, setVttUrl] = useState<string | null>(null);

  // Keep the local script in sync if the server copy changes (after rebuild).
  useEffect(() => setScript(video.script), [video.script]);

  // Fetch SRT (auth cookie) and build a VTT track for the player.
  useEffect(() => {
    if (!video.hasSrt) return;
    let revoked: string | null = null;
    fetch(`${API_BASE}/api/v1/videos/${video.id}/srt`, { credentials: "include" })
      .then((r) => (r.ok ? r.text() : ""))
      .then((srt) => {
        if (srt) {
          const url = srtToVttUrl(srt);
          revoked = url;
          setVttUrl(url);
        }
      })
      .catch(() => {});
    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [video.id, video.hasSrt]);

  const building = ["pending", "script", "tts", "render"].includes(video.buildStatus);

  const save = () =>
    update.mutate(
      { script: script.map((s) => ({ narration: s.narration })) },
      { onSuccess: () => show(t("saved")) }
    );

  const visualTone: Record<string, string> = {
    title: "bg-brand-soft text-brand-deep",
    points: "bg-blue-soft text-blue",
    term: "bg-violet-soft text-violet",
    warning: "bg-amber-soft text-amber",
  };

  return (
    <div>
      <button
        onClick={() => navigate(`/teach/topics/${content.topicId}`)}
        className="text-[14.5px] font-medium text-brand-deep hover:underline"
      >
        {t("back")}
      </button>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h1 font-bold text-ink">{t("title")}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {video.hasMp4 && (
            <a href={`${API_BASE}/api/v1/videos/${video.id}/mp4`} download>
              <Button variant="ghost" size="sm" icon={<Icon icon={Download} size={15} />}>
                {t("downloadMp4")}
              </Button>
            </a>
          )}
          {video.hasSrt && (
            <a href={`${API_BASE}/api/v1/videos/${video.id}/srt`} download>
              <Button variant="ghost" size="sm" icon={<Icon icon={FileDown} size={15} />}>
                {t("downloadSrt")}
              </Button>
            </a>
          )}
          <Button
            variant="soft"
            size="sm"
            icon={<Icon icon={RefreshCw} size={15} />}
            onClick={() => rebuild.mutate()}
            disabled={building || rebuild.isPending}
          >
            {t("rebuild")}
          </Button>
        </div>
      </div>

      {/* Player / build status */}
      <div className="mt-3">
        {building ? (
          <Card>
            <div className="flex items-center gap-3 py-6">
              <Spinner size={22} />
              <span className="text-[14.5px] text-ink-soft">{t("building")}</span>
            </div>
          </Card>
        ) : video.buildStatus === "error" ? (
          <Card>
            <p className="py-6 text-center text-[14.5px] text-rose">{t("buildError", { stage: video.errorStage ?? "" })}</p>
          </Card>
        ) : video.hasMp4 ? (
          <div className="overflow-hidden rounded-card border border-line bg-black">
            <video controls className="aspect-video w-full" src={`${API_BASE}/api/v1/videos/${video.id}/mp4`}>
              {vttUrl && <track kind="subtitles" srcLang={content.language} src={vttUrl} default />}
            </video>
          </div>
        ) : null}
      </div>

      {/* Script editor */}
      <div className="mt-3 flex items-center justify-between">
        <h2 className="text-section font-bold text-ink">{t("script")}</h2>
        <Button onClick={save} disabled={update.isPending || building}>
          {t("save")}
        </Button>
      </div>

      <div className="mt-3 space-y-3">
        {script.map((seg, i) => (
          <Card key={i} className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[14px] font-bold text-ink-soft">{t("segment")} {i + 1}</span>
              {seg.visual && (
                <span className={`inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[12.5px] font-semibold ${visualTone[seg.visual.kind] ?? "bg-bg text-ink-soft"}`}>
                  {t(`visual.${seg.visual.kind}`)}: {seg.visual.title}
                </span>
              )}
            </div>
            <Textarea
              value={seg.narration}
              onChange={(e) => setScript((ss) => ss.map((s, j) => (j === i ? { ...s, narration: e.target.value } : s)))}
            />
          </Card>
        ))}
      </div>
    </div>
  );
}
