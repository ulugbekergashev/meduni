import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Pause, Play, TriangleAlert } from "lucide-react";
import { Icon, cls } from "@meduni/ui";
import { API_URL } from "../../../lib/api";
import { useVideoProgress, type VideoTabData } from "../api";

// ⚠️ 2026-08-02 — VIDEO ENDI MP4 FAYL EMAS.
//
// Sabab (o'lchangan): mp4 yig'ish uchun har segmentga 720p kadr chiziladi va
// x264 bilan kodlanadi — bu Render Free (0.1 CPU) konteynerini o'ldirardi
// (mahalliy mashinada 183 s, serverda umuman tugamasdi). Buyurtmachining
// hostida esa pullik tarif $25 dan boshlanadi.
//
// Yechim: og'ir qismni BRAUZERGA olib chiqamiz. Server faqat ovozni
// birlashtiradi (~5 s CPU), brauzer esa vaqt jadvali bo'yicha rasm/matnni
// almashtiradi. Talaba uchun natija deyarli bir xil: play → ovoz ketadi,
// kadrlar almashadi, matn ko'rinadi; oldinga/orqaga o'tish ham ishlaydi.

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

function fmt(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function SlideshowPlayer({
  topicId,
  data,
  threshold,
  seekTo,
}: {
  topicId: number;
  data: VideoTabData;
  threshold: number;
  seekTo?: number | null;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "lesson" });
  const audioRef = useRef<HTMLAudioElement>(null);
  const progress = useVideoProgress(topicId);
  const qc = useQueryClient();

  const segments = data.segments ?? [];
  const total = data.durationSec ?? segments.reduce((a, s) => a + s.durationSec, 0);

  const [time, setTime] = useState(data.positionSec ?? 0);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pct, setPct] = useState(data.watchedPct);
  const lastSent = useRef(0);
  const wasDone = useRef(data.done);
  const seeked = useRef(false);

  const current = useMemo(() => {
    if (!segments.length) return null;
    let i = 0;
    for (let k = 0; k < segments.length; k++) if (time + 0.25 >= segments[k].startSec) i = k;
    return { index: i, seg: segments[i] };
  }, [segments, time]);

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

  // Konspekt bo'lim chipidan kelgan ?t= — o'sha sekundga o'tамиз (bir marta).
  useEffect(() => {
    const el = audioRef.current;
    if (!el || seekTo == null || seeked.current) return;
    seeked.current = true;
    el.currentTime = seekTo;
    void el.play().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seekTo]);

  // Oxirgi pozitsiyadan davom ettirish.
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !data.positionSec) return;
    el.currentTime = data.positionSec;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onTime = () => {
    const el = audioRef.current;
    if (!el) return;
    setTime(el.currentTime);
    const dur = el.duration || total || 1;
    const p = Math.min(100, Math.round((el.currentTime / dur) * 100));
    if (p > pct) setPct(p);
    // Har 5 sekundda progress yuboriladi (video pleyeri bilan bir xil qoida).
    if (el.currentTime - lastSent.current >= 5) {
      lastSent.current = el.currentTime;
      send(Math.max(p, pct), Math.floor(el.currentTime));
    }
  };

  const jump = (dir: number) => {
    const el = audioRef.current;
    if (!el || !current) return;
    const next = Math.min(Math.max(current.index + dir, 0), segments.length - 1);
    el.currentTime = segments[next].startSec + 0.05;
    setTime(segments[next].startSec);
  };

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => setFailed(true));
    else el.pause();
  };

  if (failed || !data.hasAudio) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <Icon icon={TriangleAlert} size={22} className="text-amber" />
        <p className="text-note text-ink-soft">{t("videoUnavailable")}</p>
      </div>
    );
  }

  const seg = current?.seg;
  const frameSrc = seg?.hasImage ? `${API_URL}/api/v1/me/videos/${data.videoId}/frame/${seg.index}` : null;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {/* SAHNA — kadr rasmi yoki matnli karta (rasm bo'lmagan segmentlarda) */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-card bg-ink">
        {frameSrc ? (
          <img
            key={frameSrc}
            src={frameSrc}
            alt={seg?.title ?? ""}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-gradient-to-br from-brand-deep via-brand to-violet px-8 text-center">
            <p className="text-h1 font-extrabold leading-tight text-white">{seg?.title}</p>
            {!!seg?.points?.length && (
              <ul className="space-y-1.5">
                {seg.points.slice(0, 4).map((p, i) => (
                  <li key={i} className="rounded-pill bg-white/15 px-4 py-1.5 text-body font-semibold text-white">
                    {p}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Subtitr — ayni damdagi segment matni */}
        {seg?.narration && (
          <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink to-transparent px-4 pb-3 pt-8 text-center text-note leading-snug text-white">
            {seg.narration}
          </p>
        )}
      </div>

      {/* BOSHQARUV */}
      <div className="shrink-0 space-y-2 rounded-card border border-line bg-surface p-2.5">
        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            aria-label={playing ? t("pause") : t("play")}
            className={cls("flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-white transition-colors hover:bg-brand-deep", FOCUS)}
          >
            <Icon icon={playing ? Pause : Play} size={18} />
          </button>
          <span className="shrink-0 text-note font-bold tabular-nums text-ink-soft">
            {fmt(time)} / {fmt(total)}
          </span>

          {/* Vaqt chizig'i — segment chegaralari ko'rinadi */}
          <div
            className="relative h-2 min-w-0 flex-1 cursor-pointer rounded-pill bg-surface-raised"
            onClick={(e) => {
              const el = audioRef.current;
              if (!el) return;
              const r = e.currentTarget.getBoundingClientRect();
              el.currentTime = ((e.clientX - r.left) / r.width) * (el.duration || total);
            }}
          >
            <div className="h-full rounded-pill bg-brand" style={{ width: `${total ? (time / total) * 100 : 0}%` }} />
            {segments.map((s) => (
              <span
                key={s.index}
                className="absolute top-0 h-full w-px bg-surface"
                style={{ left: `${total ? (s.startSec / total) * 100 : 0}%` }}
              />
            ))}
          </div>

          <button onClick={() => jump(-1)} aria-label="prev" className={cls("flex h-9 w-9 items-center justify-center rounded-control text-ink-soft hover:bg-surface-raised", FOCUS)}>
            <Icon icon={ChevronLeft} size={17} />
          </button>
          <span className="shrink-0 text-micro font-bold tabular-nums text-ink-faint">
            {(current?.index ?? 0) + 1}/{segments.length}
          </span>
          <button onClick={() => jump(1)} aria-label="next" className={cls("flex h-9 w-9 items-center justify-center rounded-control text-ink-soft hover:bg-surface-raised", FOCUS)}>
            <Icon icon={ChevronRight} size={17} />
          </button>
        </div>
      </div>

      <audio
        ref={audioRef}
        src={`${API_URL}/api/v1/me/videos/${data.videoId}/audio`}
        preload="metadata"
        onTimeUpdate={onTime}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onError={() => setFailed(true)}
        onEnded={() => {
          setPlaying(false);
          send(100, Math.floor(total));
        }}
        className="hidden"
      />
    </div>
  );
}
