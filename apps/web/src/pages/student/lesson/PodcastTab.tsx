import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Headphones, Pause, Play, RotateCcw, RotateCw } from "lucide-react";
import { Icon, cls } from "@meduni/ui";
import { API_URL } from "../../../lib/api";
import type { LessonPodcast } from "../api";

// Audio-podkast (~20 daqiqa) — buyurtmachi 2026-08-02.
//
// Oddiy `<audio controls>` yetarli emas edi: 20 daqiqalik yozuvda talaba
// "qayerdaman?" degan savolga javob topa olmaydi. Shuning uchun pleyerda
// BOBLAR bor (konspekt bo'limlari bilan bir xil nomlar) — bosilsa o'sha
// joyga o'tadi, joriy bob esa yoritiladi.

const SPEEDS = [1, 1.25, 1.5] as const;

function fmt(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export function PodcastTab({ topicId, data }: { topicId: number; data: LessonPodcast }) {
  const { t } = useTranslation(undefined, { keyPrefix: "lesson" });
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(data.durationSec ?? 0);
  const [speed, setSpeed] = useState<number>(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onTime = () => setPos(el.currentTime);
    const onMeta = () => setDur(el.duration || data.durationSec || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
    };
  }, [data.durationSec]);

  const seek = (sec: number) => {
    const el = ref.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(dur || sec, sec));
    setPos(el.currentTime);
  };

  const toggle = () => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  };

  const setRate = (r: number) => {
    setSpeed(r);
    if (ref.current) ref.current.playbackRate = r;
  };

  // Joriy bob — boshlanish vaqti pozitsiyadan kichik bo'lgan OXIRGISI.
  const current = data.chapters.reduce((acc, c, i) => (pos + 0.5 >= c.startSec ? i : acc), -1);
  const pct = dur > 0 ? Math.min(100, (pos / dur) * 100) : 0;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <audio ref={ref} preload="metadata" src={`${API_URL}/api/v1/me/topics/${topicId}/podcast-audio`} className="hidden" />

      {/* Pleyer */}
      <div className="shrink-0 rounded-card border border-line bg-surface-raised p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-violet-soft text-violet">
            <Icon icon={Headphones} size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-body font-extrabold text-ink">{t("podcastTitle")}</p>
            <p className="text-micro text-ink-soft">
              {current >= 0 ? data.chapters[current].title : t("podcastHint")}
            </p>
          </div>
          <span className="shrink-0 tabular-nums text-note font-bold text-ink-soft">
            {fmt(pos)} / {fmt(dur)}
          </span>
        </div>

        {/* Progress — bosilsa o'sha joyga o'tadi */}
        <input
          type="range"
          min={0}
          max={Math.max(1, Math.floor(dur))}
          value={Math.floor(pos)}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label={t("podcastSeek")}
          className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-pill bg-line accent-violet focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          style={{ background: `linear-gradient(to right, rgb(var(--violet-rgb)) ${pct}%, rgb(var(--line-rgb)) ${pct}%)` }}
        />

        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => seek(pos - 15)}
            aria-label={t("podcastBack15")}
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <Icon icon={RotateCcw} size={17} />
          </button>
          <button
            onClick={toggle}
            aria-label={playing ? t("podcastPause") : t("podcastPlay")}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-violet text-white transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <Icon icon={playing ? Pause : Play} size={22} />
          </button>
          <button
            onClick={() => seek(pos + 15)}
            aria-label={t("podcastFwd15")}
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <Icon icon={RotateCw} size={17} />
          </button>

          <div className="ml-auto flex items-center gap-0.5 rounded-control border border-line p-0.5">
            {SPEEDS.map((r) => (
              <button
                key={r}
                onClick={() => setRate(r)}
                className={cls(
                  "rounded-[6px] px-2 py-1 text-micro font-extrabold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                  speed === r ? "bg-brand-soft text-brand-tint" : "text-ink-dim hover:text-ink"
                )}
              >
                {r}×
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Boblar */}
      {data.chapters.length > 0 && (
        <ol className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          {data.chapters.map((c, i) => {
            const on = i === current;
            return (
              <li key={i}>
                <button
                  onClick={() => {
                    seek(c.startSec);
                    void ref.current?.play();
                  }}
                  className={cls(
                    "flex w-full items-center gap-3 rounded-control px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                    on ? "bg-violet-soft" : "hover:bg-surface-raised"
                  )}
                >
                  <span className={cls("shrink-0 tabular-nums text-micro font-bold", on ? "text-violet" : "text-ink-faint")}>
                    {fmt(c.startSec)}
                  </span>
                  <span className={cls("min-w-0 flex-1 truncate text-note", on ? "font-bold text-ink" : "text-ink-soft")}>
                    {c.title}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
