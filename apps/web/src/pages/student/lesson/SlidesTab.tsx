import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Icon } from "@meduni/ui";
import { API_URL } from "../../../lib/api";
import { useSlidesViewed, type SlidesTabData } from "../api";

export function SlidesTab({ topicId, data }: { topicId: number; data: SlidesTabData }) {
  const { t } = useTranslation(undefined, { keyPrefix: "lesson" });
  const [i, setI] = useState(0);
  const viewed = useSlidesViewed(topicId);
  const marked = useRef(data.viewed);
  const touchX = useRef<number | null>(null);
  const total = data.slides.length;

  // Reaching the last slide (or downloading) marks the presentation viewed.
  const markViewed = () => {
    if (!marked.current) {
      marked.current = true;
      viewed.mutate();
    }
  };
  useEffect(() => {
    if (i === total - 1) markViewed();
  }, [i, total]);

  if (total === 0) return null;
  const slide = data.slides[i];
  const go = (d: number) => setI((p) => Math.min(Math.max(p + d, 0), total - 1));

  return (
    <div className="space-y-5">
      <div
        className="relative overflow-hidden rounded-[16px] border-2 border-line bg-surface shadow-[0_10px_40px_rgba(0,0,0,0.05)]"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
          touchX.current = null;
        }}
      >
        <div className="p-6 sm:p-8 min-h-[300px]">
          <div className="mb-6 flex items-start gap-4">
            <div className="mt-1 h-8 w-1.5 shrink-0 rounded-full bg-brand" />
            <h3 className="text-[22px] font-black text-ink leading-snug">{slide.title}</h3>
          </div>
          {slide.imageUrl && (
            <img src={`${API_URL}${slide.imageUrl}`} alt="" className="my-5 max-h-72 w-full rounded-[12px] object-contain shadow-sm border border-line" />
          )}
          <ul className="mt-4 space-y-3">
            {slide.bullets.map((b, bi) => (
              <li key={bi} className="flex gap-3 text-[16px] font-medium text-ink-soft leading-relaxed">
                <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand/80" />
                {b}
              </li>
            ))}
          </ul>
        </div>
        {/* Progress Bar inside the card at the bottom */}
        <div className="h-1.5 w-full bg-bg">
          <div className="h-full bg-brand transition-all duration-300" style={{ width: `${((i + 1) / total) * 100}%` }} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 px-2">
        <button
          onClick={() => go(-1)}
          disabled={i === 0}
          className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-line bg-surface text-ink-soft shadow-sm transition-all hover:border-brand hover:text-brand disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink-soft"
          aria-label="prev"
        >
          <Icon icon={ChevronLeft} size={20} strokeWidth={2.5} />
        </button>
        <span className="rounded-pill bg-surface px-4 py-1.5 text-[15px] font-black tracking-widest text-ink-soft shadow-sm border border-line">
          {i + 1} <span className="opacity-50">/</span> {total}
        </span>
        <button
          onClick={() => go(1)}
          disabled={i === total - 1}
          className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-line bg-surface text-ink-soft shadow-sm transition-all hover:border-brand hover:text-brand disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink-soft"
          aria-label="next"
        >
          <Icon icon={ChevronRight} size={20} strokeWidth={2.5} />
        </button>
      </div>

      <div className="flex items-center justify-between gap-2">
        <a
          href={`${API_URL}/api/v1/me/presentations/${data.presentationId}/pdf`}
          onClick={markViewed}
          className="inline-flex items-center gap-1.5 rounded-control border border-line px-3 py-1.5 text-[14px] font-medium text-ink-soft transition-colors hover:bg-bg"
        >
          <Icon icon={Download} size={15} />
          {t("downloadPdf")}
        </a>
        {(marked.current || data.done) && (
          <span className="inline-flex items-center gap-1 text-[14px] font-semibold text-emerald">
            <Icon icon={CheckCircle2} size={15} /> {t("slidesDone")}
          </span>
        )}
      </div>
    </div>
  );
}
