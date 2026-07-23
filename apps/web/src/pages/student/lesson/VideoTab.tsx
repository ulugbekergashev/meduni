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

  const [isPlaying, setIsPlaying] = useState(false);
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = Math.floor(sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const playVideo = () => {
    if (ref.current) {
      ref.current.play();
      setIsPlaying(true);
    }
  };

  if (failed || !data.hasMp4) {
    return (
      <div className="rounded-card border border-line bg-surface p-4 text-center shadow-sm">
        <p className="text-[14.5px] font-medium text-ink-soft">{t("videoUnavailable")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      {/* Kino rejimi (Theater mode) uslubidagi media player */}
      <div className="relative overflow-hidden rounded-[16px] bg-black shadow-2xl ring-1 ring-black/5">
        <video
          ref={ref}
          src={src}
          controls={isPlaying || data.positionSec === 0}
          playsInline
          crossOrigin="use-credentials"
          className="aspect-video w-full outline-none"
          onLoadedMetadata={(e) => {
            if (data.positionSec > 0) e.currentTarget.currentTime = data.positionSec;
          }}
          onPlay={() => setIsPlaying(true)}
          onTimeUpdate={onTime}
          onPause={() => ref.current && send(shownPct, Math.round(ref.current.currentTime))}
          onEnded={() => send(100, ref.current?.duration ? Math.round(ref.current.duration) : 0)}
          onError={() => setFailed(true)}
        >
          {captions && vttUrl && <track kind="subtitles" src={vttUrl} default label="uz" />}
        </video>

        {/* Continue Watching Overlay */}
        {!isPlaying && data.positionSec > 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 transition-all duration-300 hover:bg-black/40">
            <button
              onClick={playVideo}
              className="group flex flex-col items-center gap-4 transition-transform hover:scale-105 active:scale-95"
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand text-white shadow-[0_0_40px_rgba(0,184,148,0.5)] transition-all group-hover:bg-brand-deep group-hover:shadow-[0_0_60px_rgba(0,184,148,0.7)]">
                <svg className="ml-2 h-10 w-10 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              </div>
              <span className="rounded-full border border-white/20 bg-black/40 px-5 py-2 text-[15px] font-bold text-white shadow-sm">
                Davom etish ({formatTime(data.positionSec)})
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Ostki boshqaruv va status paneli */}
      <div className="flex items-center justify-between gap-4 rounded-[12px] bg-surface p-4 shadow-sm border border-line">
        {data.hasSrt && (
          <button
            onClick={() => setCaptions((c) => !c)}
            className={`inline-flex items-center gap-2 rounded-pill border px-4 py-2 text-[14px] font-bold transition-all ${
              captions ? "border-violet bg-violet-soft text-violet" : "border-line text-ink-soft hover:bg-surface-raised hover:text-ink"
            }`}
          >
            <Icon icon={Captions} size={18} />
            {t("subtitles")}
          </button>
        )}
        <div className="ml-auto flex-1 max-w-[280px]">
          <div className="mb-2 flex items-center justify-between">
            {done ? (
              <span className="inline-flex items-center gap-1.5 text-[14px] font-bold text-emerald">
                <Icon icon={CheckCircle2} size={16} /> {t("videoDone")}
              </span>
            ) : (
              <span className="text-[13.5px] font-medium text-ink-soft">
                {t("videoNeed", { threshold })} <span className="font-bold text-ink">({shownPct}%)</span>
              </span>
            )}
          </div>
          <div className="h-2 w-full overflow-hidden rounded-pill bg-surface-raised">
            <div className="h-full rounded-pill bg-gradient-to-r from-violet to-violet-soft transition-all duration-500" style={{ width: `${Math.max(shownPct, 2)}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}
