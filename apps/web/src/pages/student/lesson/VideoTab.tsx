import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Captions, CheckCircle2, Maximize2 } from "lucide-react";
import { Icon } from "@meduni/ui";
import { API_URL, authedFetch } from "../../../lib/api";
import { useVideoProgress, type VideoTabData } from "../api";

// SRT (comma millis) -> WebVTT (dot millis) so the native <track> can render it.
function srtToVtt(srt: string): string {
  return "WEBVTT\n\n" + srt.replace(/(\d\d:\d\d:\d\d),(\d\d\d)/g, "$1.$2");
}

export function VideoTab({
  topicId,
  data,
  threshold,
  seekTo = null,
}: {
  topicId: number;
  data: VideoTabData;
  threshold: number;
  /** Faza 1: konspekt bo'lim chipidan kelgan boshlanish sekundi (?t=). */
  seekTo?: number | null;
}) {
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
    authedFetch(`${API_URL}/api/v1/me/videos/${data.videoId}/srt`)
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
        <p className="text-note font-medium text-ink-soft">{t("videoUnavailable")}</p>
      </div>
    );
  }

  /** To'liq ekran — mobilda asosiy tomosha rejimi (telefonni yon burib ko'rish). */
  const goFullscreen = () => {
    const el = ref.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (!el) return;
    // iOS Safari <video> uchun standart Fullscreen API'ni qo'llamaydi.
    if (typeof el.webkitEnterFullscreen === "function") el.webkitEnterFullscreen();
    else void el.requestFullscreen?.();
  };

  return (
    <div className="mx-auto max-w-5xl space-y-3">
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
            // Konspekt chipidan kelgan bo'lsa (?t=) — o'sha sekundga sakraydi va
            // o'ynatadi; aks holda oxirgi ko'rilgan pozitsiyadan davom etadi.
            if (seekTo !== null && Number.isFinite(seekTo)) {
              e.currentTarget.currentTime = Math.max(0, Math.min(seekTo, e.currentTarget.duration || seekTo));
              e.currentTarget.play().then(() => setIsPlaying(true)).catch(() => {});
            } else if (data.positionSec > 0) {
              e.currentTarget.currentTime = data.positionSec;
            }
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

      {/* Ostki boshqaruv va status paneli — mobilda ustma-ust, desktopda yonma-yon */}
      <div className="flex flex-col gap-3 rounded-control border border-line bg-surface p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-4">
        <div className="flex items-center gap-2">
          {data.hasSrt && (
            <button
              onClick={() => setCaptions((c) => !c)}
              className={`inline-flex min-h-[44px] items-center gap-2 rounded-pill border px-4 text-note font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                captions ? "border-violet bg-violet-soft text-violet" : "border-line text-ink-soft hover:bg-surface-raised hover:text-ink"
              }`}
            >
              <Icon icon={Captions} size={18} />
              {t("subtitles")}
            </button>
          )}
          {/* Mobilda to'liq ekran — telefonni yon burib ko'rish uchun asosiy tugma. */}
          <button
            onClick={goFullscreen}
            aria-label={t("fullscreen")}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-pill border border-line px-4 text-note font-bold text-ink-soft transition-all hover:bg-surface-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:hidden"
          >
            <Icon icon={Maximize2} size={18} />
            {t("fullscreen")}
          </button>
        </div>
        <div className="w-full sm:ml-auto sm:max-w-[280px] sm:flex-1">
          <div className="mb-2 flex items-center justify-between">
            {done ? (
              <span className="inline-flex items-center gap-1.5 text-note font-bold text-emerald">
                <Icon icon={CheckCircle2} size={16} /> {t("videoDone")}
              </span>
            ) : (
              <span className="text-note font-medium text-ink-soft">
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
