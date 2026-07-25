import { Fragment, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { Icon, cls } from "@meduni/ui";
import type { DigestBlock, LessonSection, Term } from "../api";
import { TermChip } from "./TermTooltip";

// Faza 2 — MINDMAP: tasdiqlangan konspektning bo'limlari + atamalaridan AI'SIZ
// quriladi (fleshkarta presedenti). Dekoratsiya emas — NAVIGATSIYA qatlami:
// bo'lim tuguni → konspektning o'sha bo'limiga sakraydi; atama tuguni → tooltip.

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Bo'lim bloklaridan sof matn (atama moslash uchun). */
function sectionText(s: LessonSection): string {
  return (s.blocks as DigestBlock[])
    .map((b) => {
      if (b.type === "para" || b.type === "callout") return b.text;
      if (b.type === "list") return b.items.map((it) => `${it.lead ?? ""} ${it.text}`).join(" ");
      return "";
    })
    .join(" ");
}

/** Atamani birinchi uchragan bo'limga biriktiradi (so'z chegarasi bilan).
 *  Har bo'limga eng ko'pi 4 barg — shovqin bo'lmasin. */
function assignTerms(sections: LessonSection[], terms: Term[]): Map<number, Term[]> {
  const texts = sections.map(sectionText);
  const byIndex = new Map<number, Term[]>();
  const used = new Set<string>();
  for (const term of terms) {
    const keys = [term.uz, term.lat].map((k) => (k ?? "").trim()).filter((k) => k.length >= 4);
    if (!keys.length) continue;
    const id = keys[0].toLowerCase();
    if (used.has(id)) continue;
    let found = -1;
    for (let i = 0; i < texts.length; i++) {
      const hit = keys.some((k) => new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(k)}(?![\\p{L}\\p{N}])`, "iu").test(texts[i]));
      if (hit) {
        found = i;
        break;
      }
    }
    if (found === -1) continue;
    const idx = sections[found].index;
    const arr = byIndex.get(idx) ?? [];
    if (arr.length < 4) {
      arr.push(term);
      byIndex.set(idx, arr);
      used.add(id);
    }
  }
  return byIndex;
}

const W = 1040;
const H = 760;
const CX = W / 2;
const CY = H / 2;
const R1 = 215; // markaz → bo'lim
const R2 = 128; // bo'lim → atama

interface Node {
  s: LessonSection;
  x: number;
  y: number;
  leaves: { term: Term; x: number; y: number }[];
}

export function MindmapView({
  topicTitle,
  sections,
  terms,
  onJumpSection,
}: {
  topicTitle: string;
  sections: LessonSection[];
  terms: Term[];
  onJumpSection: (index: number) => void;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "lesson" });
  const reduce = useReducedMotion();

  const nodes = useMemo<Node[]>(() => {
    const termsBy = assignTerms(sections, terms);
    const n = sections.length;
    return sections.map((s, i) => {
      const baseDeg = -90 + i * (360 / n);
      const ang = (baseDeg * Math.PI) / 180;
      const x = CX + R1 * Math.cos(ang);
      const y = CY + R1 * Math.sin(ang);
      const ls = termsBy.get(s.index) ?? [];
      const m = ls.length;
      const spread = Math.min(64, 24 * m); // gradus
      const leaves = ls.map((term, j) => {
        const fa = m <= 1 ? baseDeg : baseDeg - spread / 2 + j * (spread / (m - 1));
        const far = (fa * Math.PI) / 180;
        return { term, x: x + R2 * Math.cos(far), y: y + R2 * Math.sin(far) };
      });
      return { s, x, y, leaves };
    });
  }, [sections, terms]);

  if (sections.length === 0) return null;

  return (
    <div className="h-full overflow-auto p-3">
      <div className="relative mx-auto" style={{ width: W, height: H }}>
        {/* Chiziqlar (edges) — SVG qatlam */}
        <svg className="absolute inset-0 text-line" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden>
          {nodes.map((n) => (
            <Fragment key={n.s.index}>
              <line x1={CX} y1={CY} x2={n.x} y2={n.y} stroke="currentColor" strokeWidth={2} />
              {n.leaves.map((lf, j) => (
                <line key={j} x1={n.x} y1={n.y} x2={lf.x} y2={lf.y} stroke="currentColor" strokeWidth={1.2} />
              ))}
            </Fragment>
          ))}
        </svg>

        {/* Markaz — mavzu */}
        <motion.div
          initial={reduce ? false : { scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
          className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
          style={{ left: CX, top: CY }}
        >
          <div className="max-w-[190px] rounded-card bg-brand px-4 py-2.5 text-center text-note font-extrabold leading-tight text-white shadow-card">
            {topicTitle}
          </div>
        </motion.div>

        {/* Bo'lim tugunlari + atama barglari */}
        {nodes.map((n, i) => (
          <Fragment key={n.s.index}>
            {n.leaves.map((lf, j) => (
              <div
                key={j}
                className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
                style={{ left: lf.x, top: lf.y }}
              >
                <span className="inline-block rounded-pill border border-line bg-surface px-2 py-0.5 text-micro text-ink-soft shadow-sm">
                  <TermChip raw={lf.term.uz} term={lf.term} />
                </span>
              </div>
            ))}
            <motion.button
              initial={reduce ? false : { scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: reduce ? 0 : 0.05 + i * 0.04, type: "spring", stiffness: 320, damping: 22 }}
              onClick={() => onJumpSection(n.s.index)}
              title={t("mindmapOpenSection")}
              className={cls(
                "absolute z-20 flex max-w-[170px] -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-card border bg-surface px-3 py-2 text-left text-note font-bold shadow-card transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                n.s.read ? "border-emerald/50 text-ink hover:bg-emerald-soft" : "border-line text-ink hover:border-brand hover:bg-brand-soft"
              )}
              style={{ left: n.x, top: n.y }}
            >
              {n.s.read && <Icon icon={Check} size={13} className="shrink-0 text-emerald" strokeWidth={3} />}
              <span className="line-clamp-2 leading-snug">{n.s.title}</span>
            </motion.button>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
