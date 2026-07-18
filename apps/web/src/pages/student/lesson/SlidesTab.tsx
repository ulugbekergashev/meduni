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
    <div className="space-y-3">
      <div
        className="rounded-card border border-line bg-surface p-5 sm:p-7"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
          touchX.current = null;
        }}
      >
        <div className="mb-3 h-1 w-12 rounded-pill bg-brand" />
        <h3 className="text-[19px] font-bold text-ink">{slide.title}</h3>
        {slide.imageUrl && (
          <img src={`${API_URL}${slide.imageUrl}`} alt="" className="my-4 max-h-64 w-full rounded-control object-contain" />
        )}
        <ul className="mt-3 space-y-2">
          {slide.bullets.map((b, bi) => (
            <li key={bi} className="flex gap-2 text-[15px] text-ink-soft">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
              {b}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => go(-1)}
          disabled={i === 0}
          className="flex h-10 w-10 items-center justify-center rounded-control border border-line text-ink-soft transition-colors hover:bg-bg disabled:opacity-40"
          aria-label="prev"
        >
          <Icon icon={ChevronLeft} size={18} />
        </button>
        <span className="text-[14px] font-semibold text-ink-soft">
          {i + 1} / {total}
        </span>
        <button
          onClick={() => go(1)}
          disabled={i === total - 1}
          className="flex h-10 w-10 items-center justify-center rounded-control border border-line text-ink-soft transition-colors hover:bg-bg disabled:opacity-40"
          aria-label="next"
        >
          <Icon icon={ChevronRight} size={18} />
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
