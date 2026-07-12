import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Captions, CheckCircle2 } from "lucide-react";
import { Icon } from "@meduni/ui";
import { API_URL } from "../../../lib/api";
import { useVideoProgress, type VideoTabData } from "../api";

// SRT (comma millis) -> WebVTT (dot millis) so the native <track> can render it.
function srtToVtt(srt: string): string {
  return "WEBVTT\n\n" + srt.replace(/(\d\d:\d\d:\d\d),(\d\d\d)/g, "$1.$2");
}

export function VideoTab({ topicId, data, threshold }: { topicId: number; data: VideoTabData; threshold: number }) {
  const { t } = useTranslation(undefined, { keyPrefix: "lesson" });
  const ref = useRef<HTMLVideoElement>(null);
  const progress = useVideoProgress(topicId);
  const qc = useQueryClient();
  const [failed, setFailed] = useState(false);
  const [captions, setCaptions] = useState(false);
  const [vttUrl, setVttUrl] = useState<string | null>(null);
  const [pct, setPct] = useState(data.watchedPct);
  const lastSent = useRef(0);
  const wasDone = useRef(data.done);

  const src = `${API_URL}/api/v1/me/videos/${data.videoId}/mp4`;

  // Build a VTT blob from the SRT endpoint the first time captions are turned on.
  useEffect(() => {
    if (!captions || vttUrl || !data.hasSrt) return;
    let revoked: string | null = null;
    fetch(`${API_URL}/api/v1/me/videos/${data.videoId}/srt`, { credentials: "include" })
      .then((r) => (r.ok ? r.text() : Promise.reject()))
      .then((srt) => {
        const url = URL.createObjectURL(new Blob([srtToVtt(srt)], { type: "text/vtt" }));
        revoked = url;
        setVttUrl(url);
      })
      .catch(() => {});
    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [captions, vttUrl, data.hasSrt, data.videoId]);

  const send = (watchedPct: number, positionSec: number) => {
    progress.mutate(
      { watchedPct, positionSec },
      {
        onSuccess: () => {
          if (!wasDone.current && watchedPct >= threshold) {
            wasDone.current = true;
            qc.invalidateQueries({ queryKey: ["me-lesson", topicId] });
            qc.invalidateQueries({ queryKey: ["me-course"] });
          }
        },
      }
    );
  };

  const onTime = () => {
    const v = ref.current;
    if (!v || !v.duration) return;
    const cur = Math.round((v.currentTime / v.duration) * 100);
    setPct((p) => Math.max(p, cur));
    if (v.currentTime - lastSent.current >= 5) {
      lastSent.current = v.currentTime;
      send(Math.max(pct, cur), Math.round(v.currentTime));
    }
  };

  const shownPct = Math.max(pct, data.watchedPct);
  const done = shownPct >= threshold;

  if (failed || !data.hasMp4) {
    return (
      <div className="rounded-card border border-line bg-surface p-8 text-center">
        <p className="text-[13.5px] text-ink-soft">{t("videoUnavailable")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-card bg-black">
        <video
          ref={ref}
          src={src}
          controls
          playsInline
          crossOrigin="use-credentials"
          className="aspect-video w-full"
          onLoadedMetadata={(e) => {
            if (data.positionSec > 0) e.currentTarget.currentTime = data.positionSec;
          }}
          onTimeUpdate={onTime}
          onPause={() => ref.current && send(shownPct, Math.round(ref.current.currentTime))}
          onEnded={() => send(100, ref.current?.duration ? Math.round(ref.current.duration) : 0)}
          onError={() => setFailed(true)}
        >
          {captions && vttUrl && <track kind="subtitles" src={vttUrl} default label="uz" />}
        </video>
      </div>

      <div className="flex items-center justify-between gap-2">
        {data.hasSrt && (
          <button
            onClick={() => setCaptions((c) => !c)}
            className={`inline-flex items-center gap-1.5 rounded-control border px-3 py-1.5 text-[13px] font-medium transition-colors ${
              captions ? "border-violet bg-violet-soft text-violet" : "border-line text-ink-soft hover:bg-bg"
            }`}
          >
            <Icon icon={Captions} size={15} />
            {t("subtitles")}
          </button>
        )}
        <div className="ml-auto text-right">
          {done ? (
            <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-emerald">
              <Icon icon={CheckCircle2} size={15} /> {t("videoDone")}
            </span>
          ) : (
            <span className="text-[12.5px] text-ink-soft">
              {t("videoNeed", { threshold })} <span className="font-bold text-ink">({shownPct}%)</span>
            </span>
          )}
        </div>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-pill bg-bg">
        <div className="h-full rounded-pill bg-violet transition-all" style={{ width: `${Math.max(shownPct, 2)}%` }} />
      </div>
    </div>
  );
}
