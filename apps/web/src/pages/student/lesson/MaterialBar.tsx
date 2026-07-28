import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, Download, ExternalLink, FileText, Link2 } from "lucide-react";
import { Icon, Spinner, cls } from "@meduni/ui";
import { API_URL, authedFetch } from "../../../lib/api";
import type { LessonLink, LessonMaterial } from "../api";

// 2026-07-28 (buyurtmachi): "material matni bizga kerak emas, materialni o'zi
// pdfi konspektni tepasida bo'lsin". Ilgari material AJRATILGAN MATN sifatida
// alohida rail bloki edi (MaterialTextView) — o'qituvchi yuklagan asl hujjat esa
// faqat yuklab olinardi. Endi asl fayl konspekt ustida, joyida ochiladi.

const TYPE_TONE: Record<string, string> = {
  pdf: "bg-rose-soft text-rose",
  docx: "bg-blue-soft text-blue",
  pptx: "bg-amber-soft text-amber",
};

/** Brauzer ichida ko'rsatib bo'ladigan turlar (qolganlari yuklab olinadi). */
const INLINE = new Set(["pdf", "txt", "md"]);

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/** ⚠️ Faylni TO'G'RIDAN-TO'G'RI `<iframe src={API_URL}/...>` bilan ko'rsatib
 *  bo'lmaydi: API helmet bilan `X-Frame-Options: SAMEORIGIN` va CSP
 *  `frame-ancestors 'self'` qo'yadi — web boshqa originda bo'lgani uchun brauzer
 *  freymni bloklaydi (ekranda "buzuq hujjat" ikonkasi chiqadi). Shuning uchun
 *  fayl odatdagi `credentials: "include"` so'rovi bilan olinadi va `blob:` URL
 *  sifatida ko'rsatiladi — u sahifaning O'Z origini, ya'ni hech qanday freym/
 *  cookie cheklovi yo'q (prod'dagi cross-site holat ham shu yo'l bilan yechiladi). */
function useBlobUrl(url: string | null): { src: string | null; loading: boolean; failed: boolean } {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!url) {
      setSrc(null);
      setFailed(false);
      return;
    }
    let objectUrl: string | null = null;
    let alive = true;
    setLoading(true);
    setFailed(false);
    authedFetch(url)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((blob) => {
        if (!alive) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => alive && setFailed(true))
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  return { src, loading, failed };
}

export function MaterialBar({
  materials,
  links = [],
  /** Test jarayonida material yopiladi (halollik). */
  locked = false,
  lockedNote,
}: {
  materials: LessonMaterial[];
  links?: LessonLink[];
  locked?: boolean;
  lockedNote?: string;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "lesson" });
  const reduce = useReducedMotion();
  const [openId, setOpenId] = useState<number | null>(null);

  const open = materials.find((m) => m.id === openId) ?? null;
  const canInline = open ? INLINE.has(open.fileType) : false;
  const fileUrl = (id: number) => `${API_URL}/api/v1/me/materials/${id}/file`;
  // Hook shartli chaqirilmasligi uchun bo'sh-holat tekshiruvi hooklardan KEYIN.
  const viewer = useBlobUrl(open && canInline && !locked ? fileUrl(open.id) : null);

  if (materials.length === 0 && links.length === 0) return null;

  return (
    <div className="shrink-0 border-b border-line bg-surface-raised">
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2">
        <span className="mr-0.5 text-micro font-extrabold uppercase tracking-wider text-ink-faint">
          {t("materialSource")}
        </span>

        {materials.map((m) => {
          const on = m.id === openId;
          const meta = [
            m.fileType.toUpperCase(),
            m.pageCount ? t("pagesN", { n: m.pageCount }) : null,
            m.sizeBytes ? formatSize(m.sizeBytes) : null,
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <button
              key={m.id}
              onClick={() => setOpenId(on ? null : m.id)}
              disabled={locked}
              title={m.fileName}
              className={cls(
                "group inline-flex max-w-full items-center gap-2 rounded-control border px-2 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-40",
                on ? "border-brand bg-brand-soft" : "border-line bg-surface hover:border-brand"
              )}
            >
              <span
                className={cls(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-control",
                  TYPE_TONE[m.fileType] ?? "bg-surface-raised text-ink-soft"
                )}
              >
                <Icon icon={FileText} size={14} />
              </span>
              <span className="min-w-0">
                <span className="block max-w-[220px] truncate text-note font-bold text-ink">{m.fileName}</span>
                <span className="block truncate text-micro text-ink-soft">{meta}</span>
              </span>
              <Icon
                icon={ChevronDown}
                size={14}
                className={cls("shrink-0 text-ink-dim transition-transform", !on && "-rotate-90")}
              />
            </button>
          );
        })}

        {links.map((l) => (
          <a
            key={l.id}
            href={l.url}
            target="_blank"
            rel="noreferrer"
            title={l.note || l.url}
            className="inline-flex items-center gap-1.5 rounded-pill border border-line bg-surface px-2.5 py-1.5 text-note font-bold text-ink-soft transition-colors hover:border-brand hover:text-brand-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <Icon icon={Link2} size={13} />
            <span className="max-w-[180px] truncate">{l.title}</span>
            <Icon icon={ExternalLink} size={11} className="text-ink-dim" />
          </a>
        ))}
      </div>

      {locked && lockedNote && (
        <p className="border-t border-line px-3 py-1.5 text-micro font-bold text-amber">{lockedNote}</p>
      )}

      {/* Asl hujjat — joyida ochiladi (yangi tab shart emas). */}
      <AnimatePresence initial={false}>
        {open && !locked && (
          <motion.div
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-line"
          >
            <div className="flex items-center gap-2 px-3 py-1.5">
              <span className="min-w-0 flex-1 truncate text-micro text-ink-soft">{open.fileName}</span>
              <a
                href={fileUrl(open.id)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-pill border border-line px-2.5 py-1 text-micro font-bold text-ink-soft transition-colors hover:border-brand hover:text-brand-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <Icon icon={Download} size={12} />
                {t("materialDownload")}
              </a>
            </div>
            {canInline && !viewer.failed ? (
              viewer.src ? (
                <iframe
                  key={open.id}
                  src={viewer.src}
                  title={open.fileName}
                  className="h-[45vh] min-h-[260px] w-full border-0 bg-surface"
                />
              ) : (
                <div className="flex h-[45vh] min-h-[260px] items-center justify-center">
                  {viewer.loading && <Spinner size={22} />}
                </div>
              )
            ) : (
              <p className="px-3 pb-3 text-note text-ink-soft">{t("materialNoPreview")}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
