import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlignLeft, CheckCircle2, ChevronLeft, ChevronRight, Download, GalleryHorizontal, X, ZoomIn } from "lucide-react";
import { Icon, cls } from "@meduni/ui";
import { API_URL } from "../../../lib/api";
import { useSlidesViewed, type SlidesTabData } from "../api";

/** Ko'rinish: slayd karuseli yoki matn (mini-konspekt) — tanlov eslab qolinadi. */
const MODE_KEY = "meduni.slidesMode";

/**
 * Diagramma ko'rgichi. Telefon ekranida tibbiy atlas rasmidagi yozuvlar
 * o'qilmaydi — bosilganda to'liq ekranda ochiladi, yana bosilsa kattalashadi
 * (skroll bilan siljitiladi). Yopish: X, backdrop yoki Escape.
 */
function SlideImage({
  src,
  alt,
  className,
  wrapperClassName,
}: {
  src: string;
  alt: string;
  className?: string;
  /** Tashqi tugma (rasm maydoni) klassi — karusel uni to'liq balandlikka qo'yadi. */
  wrapperClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(false);
  const { t } = useTranslation(undefined, { keyPrefix: "lesson" });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setZoom(false);
          setOpen(true);
        }}
        aria-label={t("zoomImage")}
        className={cls(
          "group relative block w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
          wrapperClassName
        )}
      >
        <img src={src} alt={alt} className={className} />
        <span className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-ink/60 text-white opacity-90 transition-opacity group-hover:opacity-100">
          <Icon icon={ZoomIn} size={17} />
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/95" role="dialog" aria-modal="true">
          <div className="flex shrink-0 justify-end p-2">
            <button
              onClick={() => setOpen(false)}
              aria-label={t("close")}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <Icon icon={X} size={22} />
            </button>
          </div>
          <div className={cls("flex-1", zoom ? "overflow-auto" : "flex items-center justify-center p-2")}>
            <img
              src={src}
              alt={alt}
              onClick={() => setZoom((z) => !z)}
              className={cls(
                "cursor-zoom-in select-none",
                zoom ? "h-auto w-[200%] max-w-none" : "max-h-full max-w-full object-contain"
              )}
            />
          </div>
        </div>
      )}
    </>
  );
}

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
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* Ko'rinish almashtirish + PDF */}
      <div className="flex shrink-0 items-center gap-1.5">
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
        <div className="mx-auto min-h-0 w-full max-w-[68ch] flex-1 space-y-4 overflow-y-auto">
          {data.slides.map((s, si) => (
            <section key={s.id} className="rounded-card border border-line p-4">
              <div className="mb-2 flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-control bg-surface-raised text-micro font-extrabold tabular-nums text-ink-soft">
                  {si + 1}
                </span>
                <h3 className="text-body font-extrabold leading-snug text-ink">{s.title}</h3>
              </div>
              {s.imageUrl && (
                <div className="my-2">
                  <SlideImage
                    src={`${API_URL}${s.imageUrl}`}
                    alt={s.title}
                    className="max-h-[40dvh] w-full rounded-control border border-line object-contain sm:max-h-56"
                  />
                </div>
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
            className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-card border border-line bg-surface-raised"
            onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
            onTouchEnd={(e) => {
              if (touchX.current === null) return;
              const dx = e.changedTouches[0].clientX - touchX.current;
              if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
              touchX.current = null;
            }}
          >
            {/* 2026-08-01 (buyurtmachi: "фокус — на контенте"): slayd = RASMNING
                O'ZI. Sarlavha va sahifalagich rasm USTIDA suzadi, ya'ni ular
                balandlikni yemaydi va diagramma maksimal katta ko'rinadi. */}
            <div className="flex min-h-0 flex-1 flex-col">
              {slide.imageUrl ? (
                // Rasm 16:9 (Nano Banana) — aniq nisbatli maydonga joylashadi.
                // ⚠️ Ilgari `max-h-full` ishlatilgandi: flex-ota balandligi kontentдан
                // hisoblangani uchun rasm kartadan CHIQIB ketardi va pastdagi
                // tezislarni yopib qo'yardi.
                <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 py-2">
                  <SlideImage
                    src={`${API_URL}${slide.imageUrl}`}
                    alt={slide.title}
                    wrapperClassName="mx-auto aspect-video max-h-full w-auto max-w-full"
                    className="h-full w-full rounded-control object-contain"
                  />
                  {/* ⚠️ Sarlavha CHIPI yo'q: Nano Banana slaydining O'ZIDA sarlavha
                      chizilgan — chip uni takrorlardi (§4 "bitta fakt — bitta joy"). */}
                  {/* Sahifalagich — rasm ustida (alohida qator emas) */}
                  <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-pill bg-surface/95 px-1.5 py-1 shadow-card">
                    <button
                      onClick={() => go(-1)}
                      disabled={i === 0}
                      aria-label="prev"
                      className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-surface-raised hover:text-ink disabled:opacity-30"
                    >
                      <Icon icon={ChevronLeft} size={16} />
                    </button>
                    <span className="min-w-[44px] text-center text-note font-extrabold tabular-nums text-ink-soft">
                      {i + 1} / {total}
                    </span>
                    <button
                      onClick={() => go(1)}
                      disabled={i === total - 1}
                      aria-label="next"
                      className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-surface-raised hover:text-ink disabled:opacity-30"
                    >
                      <Icon icon={ChevronRight} size={16} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                  <div className="mb-3 flex items-start gap-2.5">
                    <div className="mt-1 h-6 w-1 shrink-0 rounded-pill bg-brand" />
                    <h3 className="text-section font-extrabold leading-snug text-ink">{slide.title}</h3>
                  </div>
                  <ul className="space-y-2.5">
                    {slide.bullets.map((b, bi) => (
                      <li key={bi} className="flex gap-2.5 text-body leading-relaxed text-ink-strong">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {slide.imageUrl && slide.bullets.length > 0 && (
                <ul className="max-h-[22%] shrink-0 space-y-1 overflow-y-auto border-t border-line px-4 py-2">
                  {slide.bullets.map((b, bi) => (
                    <li key={bi} className="flex gap-2 text-note leading-snug text-ink-soft">
                      <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-brand" />
                      {b}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="h-1 w-full shrink-0 bg-line">
              <div className="h-full bg-brand transition-all duration-300" style={{ width: `${((i + 1) / total) * 100}%` }} />
            </div>
          </div>

          {!slide.imageUrl && (
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => go(-1)}
              disabled={i === 0}
              className="flex h-11 w-11 items-center justify-center rounded-control border border-line text-ink-soft transition-colors hover:bg-surface-raised hover:text-ink disabled:opacity-30"
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
              className="flex h-11 w-11 items-center justify-center rounded-control border border-line text-ink-soft transition-colors hover:bg-surface-raised hover:text-ink disabled:opacity-30"
              aria-label="next"
            >
              <Icon icon={ChevronRight} size={17} />
            </button>
          </div>
          )}
        </>
      )}
    </div>
  );
}
