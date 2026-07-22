import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlignLeft, CheckCircle2, ChevronLeft, ChevronRight, Download, GalleryHorizontal } from "lucide-react";
import { Icon, cls } from "@meduni/ui";
import { API_URL } from "../../../lib/api";
import { useSlidesViewed, type SlidesTabData } from "../api";

/** Ko'rinish: slayd karuseli yoki matn (mini-konspekt) — tanlov eslab qolinadi. */
const MODE_KEY = "meduni.slidesMode";

export function SlidesTab({ topicId, data }: { topicId: number; data: SlidesTabData }) {
  const { t } = useTranslation(undefined, { keyPrefix: "lesson" });
  const [i, setI] = useState(0);
  const [outline, setOutline] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem(MODE_KEY) === "outline"
  );
  const viewed = useSlidesViewed(topicId);
  const marked = useRef(data.viewed);
  const touchX = useRef<number | null>(null);
  const total = data.slides.length;

  // Reaching the last slide (or downloading, or reading the whole outline) marks viewed.
  const markViewed = () => {
    if (!marked.current) {
      marked.current = true;
      viewed.mutate();
    }
  };
  useEffect(() => {
    if (i === total - 1) markViewed();
  }, [i, total]);
  // Matn ko'rinishida hamma slayd birdaniga ko'rinadi — ochilishi = ko'rildi.
  useEffect(() => {
    if (outline) markViewed();
  }, [outline]);

  const setMode = (o: boolean) => {
    setOutline(o);
    try {
      window.localStorage.setItem(MODE_KEY, o ? "outline" : "slides");
    } catch {}
  };

  if (total === 0) return null;
  const slide = data.slides[i];
  const go = (d: number) => setI((p) => Math.min(Math.max(p + d, 0), total - 1));

  return (
    <div className="space-y-3">
      {/* Ko'rinish almashtirish + PDF */}
      <div className="flex items-center gap-1.5">
        <div className="flex rounded-control border border-line p-0.5">
          {([false, true] as const).map((o) => (
            <button
              key={String(o)}
              onClick={() => setMode(o)}
              className={cls(
                "inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-1 text-micro font-extrabold transition-colors",
                outline === o ? "bg-brand-soft text-brand-tint" : "text-ink-dim hover:text-ink"
              )}
            >
              <Icon icon={o ? AlignLeft : GalleryHorizontal} size={12} />
              {o ? t("slidesOutline") : t("slidesCarousel")}
            </button>
          ))}
        </div>
        <a
          href={`${API_URL}/api/v1/me/presentations/${data.presentationId}/pdf`}
          onClick={markViewed}
          className="ml-auto inline-flex items-center gap-1.5 rounded-control border border-line px-2.5 py-1 text-micro font-bold text-ink-soft transition-colors hover:bg-surface-raised"
        >
          <Icon icon={Download} size={12} />
          {t("downloadPdf")}
        </a>
        {(marked.current || data.done) && (
          <span className="inline-flex items-center gap-1 text-micro font-bold text-emerald">
            <Icon icon={CheckCircle2} size={13} /> {t("slidesDone")}
          </span>
        )}
      </div>

      {outline ? (
        /* ---- Matn ko'rinishi (mini-konspekt): hamma slayd birdaniga ---- */
        <div className="mx-auto max-w-[68ch] space-y-4">
          {data.slides.map((s, si) => (
            <section key={s.id} className="rounded-card border border-line p-4">
              <div className="mb-2 flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-control bg-surface-raised text-micro font-extrabold tabular-nums text-ink-soft">
                  {si + 1}
                </span>
                <h3 className="text-body font-extrabold leading-snug text-ink">{s.title}</h3>
              </div>
              {s.imageUrl && (
                <img
                  src={`${API_URL}${s.imageUrl}`}
                  alt=""
                  className="my-2 max-h-56 w-full rounded-control border border-line object-contain"
                />
              )}
              <ul className="space-y-1.5">
                {s.bullets.map((b, bi) => (
                  <li key={bi} className="flex gap-2.5 text-note leading-relaxed text-ink-strong">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                    {b}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        /* ---- Slayd karuseli ---- */
        <>
          <div
            className="relative overflow-hidden rounded-card border border-line bg-surface-raised"
            onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
            onTouchEnd={(e) => {
              if (touchX.current === null) return;
              const dx = e.changedTouches[0].clientX - touchX.current;
              if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
              touchX.current = null;
            }}
          >
            <div className="min-h-[280px] p-4">
              <div className="mb-3 flex items-start gap-3">
                <div className="mt-1 h-7 w-1 shrink-0 rounded-pill bg-brand" />
                <h3 className="text-[19px] font-extrabold leading-snug text-ink">{slide.title}</h3>
              </div>
              {slide.imageUrl && (
                <img
                  src={`${API_URL}${slide.imageUrl}`}
                  alt=""
                  className="my-4 max-h-72 w-full rounded-control border border-line object-contain"
                />
              )}
              <ul className="mt-3 space-y-2.5">
                {slide.bullets.map((b, bi) => (
                  <li key={bi} className="flex gap-2.5 text-body leading-relaxed text-ink-strong">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
            <div className="h-1 w-full bg-line">
              <div className="h-full bg-brand transition-all duration-300" style={{ width: `${((i + 1) / total) * 100}%` }} />
            </div>
          </div>

          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => go(-1)}
              disabled={i === 0}
              className="flex h-9 w-9 items-center justify-center rounded-control border border-line text-ink-soft transition-colors hover:bg-surface-raised hover:text-ink disabled:opacity-30"
              aria-label="prev"
            >
              <Icon icon={ChevronLeft} size={17} />
            </button>
            <span className="text-note font-extrabold tabular-nums text-ink-soft">
              {i + 1} / {total}
            </span>
            <button
              onClick={() => go(1)}
              disabled={i === total - 1}
              className="flex h-9 w-9 items-center justify-center rounded-control border border-line text-ink-soft transition-colors hover:bg-surface-raised hover:text-ink disabled:opacity-30"
              aria-label="next"
            >
              <Icon icon={ChevronRight} size={17} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
