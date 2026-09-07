import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";
import { BookText, Check, Headphones, Layers, Lock, Network, Play, Sparkles, Video } from "lucide-react";
import { Icon, cls } from "@meduni/ui";
import { API_URL } from "../../../lib/api";
import { useFlashcards, type Lesson } from "../api";
import type { ContentView } from "./stages";

/**
 * PULT — mavzuga kirganda barcha material BLOK bo'lib turadi (2026-08-12,
 * buyurtmachi: "prezentatsiyaga bosadigan blok bo'lsin, videoga ham").
 *
 * Nega shunday: ilgari turlar tepadagi ingichka tasmada edi va prezentatsiya
 * bilan video MENYU BANDIga o'xshardi, material emas. Endi kirishda — pult
 * (kattaroq bloklar, muqova, progress), material tanlangach pult tasmaga
 * yig'iladi va kontent butun ekranni oladi (§18 "fokus kontentda" talabi).
 */

const META: Record<ContentView, { icon: typeof BookText; tone: string; chip: string }> = {
  konspekt: { icon: BookText, tone: "text-brand-tint", chip: "bg-brand-soft text-brand-tint" },
  slides: { icon: Layers, tone: "text-blue", chip: "bg-blue-soft text-blue" },
  video: { icon: Video, tone: "text-violet", chip: "bg-violet-soft text-violet" },
  podcast: { icon: Headphones, tone: "text-amber", chip: "bg-amber-soft text-amber" },
  flashcards: { icon: Sparkles, tone: "text-emerald", chip: "bg-emerald-soft text-emerald" },
  mindmap: { icon: Network, tone: "text-rose", chip: "bg-rose-soft text-rose" },
};

function mmss(sec: number | null | undefined): string | null {
  if (!sec || sec <= 0) return null;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export interface BlockInfo {
  key: ContentView;
  title: string;
  /** "8 slayd", "2:51", "33 karta" — bitta aniq raqam. */
  meta: string | null;
  /** 0..100; 0 bo'lsa chiziq chizilmaydi. */
  pct: number;
  done: boolean;
  locked: boolean;
  /** Muqova (slayd rasmi) — bo'lsa blok "material" bo'lib ko'rinadi. */
  cover: string | null;
}

/** Payloaddan bloklar ro'yxati — sof funksiya, UI'ga tayyor. */
export function buildBlocks(lesson: Lesson, blocks: ContentView[], cardsInfo: { total: number; known: number; locked: boolean } | null): BlockInfo[] {
  const sections = lesson.sections ?? [];
  const readCount = sections.filter((s) => s.read).length;
  const slides = lesson.tabs.slides;
  const video = lesson.tabs.video;
  const podcast = lesson.podcast;
  // Muqovalar: prezentatsiyaga birinchi rasm, videoga BOSHQASI — aks holda
  // ikkala blok bir xil suratda ko'rinadi va "ikki nusxa" taassuroti qoladi.
  const covers = (slides?.slides ?? []).map((s) => s.imageUrl).filter((x): x is string => !!x);
  const slideCover = covers[0] ?? null;
  const videoCover = covers[1] ?? covers[0] ?? null;

  return blocks.map((k): BlockInfo => {
    switch (k) {
      case "konspekt":
        return {
          key: k,
          title: "",
          meta: sections.length ? `${readCount}/${sections.length}` : null,
          pct: sections.length ? Math.round((readCount / sections.length) * 100) : 0,
          done: sections.length > 0 && readCount === sections.length,
          locked: false,
          cover: null,
        };
      case "slides":
        return {
          key: k,
          title: "",
          meta: slides ? String(slides.slides.length) : null,
          pct: slides?.viewed ? 100 : 0,
          done: !!slides?.viewed,
          locked: false,
          cover: slideCover ? `${API_URL}${slideCover}` : null,
        };
      case "video":
        return {
          key: k,
          title: "",
          meta: mmss(video?.durationSec),
          pct: video?.watchedPct ?? 0,
          done: !!video?.done,
          locked: false,
          // Videoning o'z kadri payloadda yo'q — mavzu diagrammasi muqova bo'ladi.
          cover: videoCover ? `${API_URL}${videoCover}` : null,
        };
      case "podcast":
        return {
          key: k,
          title: "",
          meta: mmss(podcast?.durationSec) ?? (podcast?.chapters.length ? String(podcast.chapters.length) : null),
          pct: 0,
          done: false,
          locked: false,
          cover: null,
        };
      case "flashcards":
        return {
          key: k,
          title: "",
          meta: cardsInfo ? String(cardsInfo.total) : null,
          pct: cardsInfo && cardsInfo.total > 0 ? Math.round((cardsInfo.known / cardsInfo.total) * 100) : 0,
          done: !!cardsInfo && cardsInfo.total > 0 && cardsInfo.known === cardsInfo.total,
          locked: cardsInfo?.locked ?? false,
          cover: null,
        };
      case "mindmap":
        return { key: k, title: "", meta: sections.length ? String(sections.length) : null, pct: 0, done: false, locked: false, cover: null };
    }
  });
}

/**
 * Ochilgan PULT: bloklar (bento — asosiysi kattaroq). Mavzuga kirganda shu
 * ko'rinadi; material tanlangach `MaterialsStrip` ga yig'iladi.
 */
export function MaterialsPanel({
  lesson,
  blocks,
  onPick,
}: {
  lesson: Lesson;
  blocks: ContentView[];
  onPick: (v: ContentView) => void;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "lesson" });
  const reduce = useReducedMotion();
  const fc = useFlashcards(lesson.topicId).data;
  const items = buildBlocks(
    lesson,
    blocks,
    fc ? { total: fc.total, known: fc.knownCount, locked: fc.locked } : null
  );
  if (items.length === 0) return null;

  return (
    <motion.div
      className="grid gap-2 sm:grid-cols-2"
      initial={reduce ? false : "hidden"}
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.04 } } }}
    >
      {items.map((b) => {
        const m = META[b.key];
        // Konspekt — matnli material, kengroq blok (muqovasiz).
        // Muqova esa MUQOVASI BOR bloklarga (prezentatsiya, video) chiziladi —
        // aynan ular "menyu bandi emas, material" bo'lib ko'rinishi kerak.
        const wide = b.key === "konspekt" && items.length > 2;
        const showCover = !!b.cover && (b.key === "slides" || b.key === "video");
        return (
          <motion.button
            key={b.key}
            variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onClick={() => !b.locked && onPick(b.key)}
            disabled={b.locked}
            className={cls(
              "group flex flex-col gap-2 overflow-hidden rounded-card border border-line bg-surface p-3 text-left transition-[border-color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
              wide && "sm:col-span-2",
              b.locked ? "cursor-not-allowed opacity-55" : "hover:-translate-y-0.5 hover:border-brand"
            )}
          >
            <div className="flex items-center gap-2.5">
              <span className={cls("flex h-9 w-9 shrink-0 items-center justify-center rounded-control", m.chip)}>
                <Icon icon={b.locked ? Lock : m.icon} size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-extrabold text-ink">{t(`block_${b.key}`)}</span>
                {b.meta && (
                  <span className="block text-micro font-data tabular-nums text-ink-faint">
                    {t(`blockMeta_${b.key}`, { v: b.meta })}
                  </span>
                )}
              </span>
              {b.done && <Icon icon={Check} size={15} className="shrink-0 text-emerald" strokeWidth={3} />}
            </div>

            {/* Muqova — prezentatsiya va videoda (qolganlarida balandlikni yemaydi) */}
            {showCover && (
              <span className="relative block aspect-[16/9] overflow-hidden rounded-control border border-line">
                <img src={b.cover!} alt="" className="h-full w-full object-cover" loading="lazy" />
                {b.key === "video" && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink/55 text-white">
                      <Icon icon={Play} size={16} />
                    </span>
                  </span>
                )}
              </span>
            )}

            {b.pct > 0 && (
              <span className="block h-1 overflow-hidden rounded-pill bg-surface-raised">
                <span className={cls("block h-full rounded-pill", m.tone.replace("text-", "bg-"))} style={{ width: `${b.pct}%` }} />
              </span>
            )}
          </motion.button>
        );
      })}
    </motion.div>
  );
}
