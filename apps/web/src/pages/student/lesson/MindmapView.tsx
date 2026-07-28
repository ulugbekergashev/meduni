import { memo, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import dagre from "@dagrejs/dagre";
import { Check, Clock, Network } from "lucide-react";
import { Icon, cls } from "@meduni/ui";
import type { DigestBlock, LessonSection, Term } from "../api";
import "@xyflow/react/dist/style.css";

// 2026-07-28: mindmap qo'lda hisoblangan radial SVG edi — tugunlar bir-birining
// ustiga tushardi, zoom/pan yo'q, uzun sarlavha kesilardi. Endi **React Flow**
// (@xyflow/react) + **dagre** avto-tartibi: cheksiz kanvas, zoom/pan/fit,
// tugunni surish. Style qatlami — o'z tokenlarimiz (CLAUDE.md §4).
//
// Mindmap DEKORATSIYA emas, NAVIGATSIYA qatlami: bo'lim tuguni bosilsa konspekt
// o'sha bo'limga sakraydi; atama tuguni o'z bo'limiga olib boradi.

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
 *  Har bo'limga eng ko'pi 5 barg — daraxt o'qilishi qiyinlashmasin. */
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
    // Mos bo'lim topilmasa — atama BIRINCHI bo'limga osiladi (yo'qolib ketmasin).
    const idx = found === -1 ? sections[0].index : sections[found].index;
    const arr = byIndex.get(idx) ?? [];
    if (arr.length < 5) {
      arr.push(term);
      byIndex.set(idx, arr);
      used.add(id);
    }
  }
  return byIndex;
}

// ---------- Tugun turlari (o'z dizayn tokenlarimizda) ----------

const HANDLE = "!h-1.5 !w-1.5 !border-0 !bg-transparent";

type RootData = { title: string; count: number };
type SectionData = { index: number; title: string; minutes: number; read: boolean; onJump: (i: number) => void };
type TermData = { uz: string; lat: string; ru: string; sectionIndex: number; onJump: (i: number) => void };

const RootNode = memo(({ data }: NodeProps) => {
  const d = data as unknown as RootData;
  return (
    <div className="w-[210px] rounded-card bg-gradient-to-br from-brand-deep to-brand px-4 py-3 text-white shadow-card">
      <span className="mb-1 inline-flex items-center gap-1.5 text-micro font-extrabold uppercase tracking-wider opacity-80">
        <Icon icon={Network} size={12} /> {d.count}
      </span>
      <p className="text-body font-extrabold leading-tight">{d.title}</p>
      <Handle type="source" position={Position.Right} className={HANDLE} />
    </div>
  );
});
RootNode.displayName = "RootNode";

const SectionNode = memo(({ data }: NodeProps) => {
  const d = data as unknown as SectionData;
  return (
    <button
      onClick={() => d.onJump(d.index)}
      className={cls(
        "w-[248px] rounded-card border bg-surface px-3 py-2.5 text-left shadow-card transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
        d.read ? "border-emerald hover:bg-emerald-soft" : "border-line hover:border-brand hover:bg-brand-soft"
      )}
    >
      <Handle type="target" position={Position.Left} className={HANDLE} />
      <div className="mb-1 flex items-center gap-1.5">
        <span
          className={cls(
            "flex h-5 w-5 items-center justify-center rounded-pill text-micro font-extrabold tabular-nums",
            d.read ? "bg-emerald-soft text-emerald" : "bg-brand-soft text-brand-tint"
          )}
        >
          {d.read ? <Icon icon={Check} size={11} strokeWidth={4} /> : d.index + 1}
        </span>
        <span className="inline-flex items-center gap-1 text-micro font-bold text-ink-faint">
          <Icon icon={Clock} size={11} />
          {d.minutes}
        </span>
      </div>
      <p className="text-note font-bold leading-snug text-ink">{d.title}</p>
      <Handle type="source" position={Position.Right} className={HANDLE} />
    </button>
  );
});
SectionNode.displayName = "SectionNode";

const TermNode = memo(({ data }: NodeProps) => {
  const d = data as unknown as TermData;
  return (
    <button
      onClick={() => d.onJump(d.sectionIndex)}
      title={d.ru || undefined}
      className="w-[190px] rounded-control border border-line bg-surface-raised px-2.5 py-1.5 text-left transition-colors hover:border-violet hover:bg-violet-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <Handle type="target" position={Position.Left} className={HANDLE} />
      <p className="truncate text-micro font-bold text-ink">{d.uz}</p>
      {d.lat && <p className="truncate text-micro italic text-ink-faint">{d.lat}</p>}
    </button>
  );
});
TermNode.displayName = "TermNode";

const nodeTypes = { root: RootNode, section: SectionNode, term: TermNode };

const SIZE = {
  root: { w: 210, h: 84 },
  section: { w: 248, h: 74 },
  term: { w: 190, h: 46 },
} as const;

/** Chapdan o'ngga daraxt tartibi (dagre) — tugunlar hech qachon ustma-ust tushmaydi. */
function layout(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 16, ranksep: 70, marginx: 24, marginy: 24 });
  for (const n of nodes) {
    const s = SIZE[(n.type as keyof typeof SIZE) ?? "section"];
    g.setNode(n.id, { width: s.w, height: s.h });
  }
  for (const e of edges) g.setEdge(e.source, e.target);
  dagre.layout(g);
  return nodes.map((n) => {
    const p = g.node(n.id);
    const s = SIZE[(n.type as keyof typeof SIZE) ?? "section"];
    return { ...n, position: { x: p.x - s.w / 2, y: p.y - s.h / 2 } };
  });
}

/** <html data-theme> ni kuzatadi — React Flow o'z boshqaruvlarini shunga moslaydi. */
function useColorMode(): "light" | "dark" {
  const read = () => (document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");
  const [mode, setMode] = useState<"light" | "dark">(read);
  useEffect(() => {
    const obs = new MutationObserver(() => setMode(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return mode;
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
  const colorMode = useColorMode();

  const { nodes, edges } = useMemo(() => {
    if (sections.length === 0) return { nodes: [] as Node[], edges: [] as Edge[] };
    const termsBy = assignTerms(sections, terms);
    const ns: Node[] = [
      {
        id: "root",
        type: "root",
        position: { x: 0, y: 0 },
        data: { title: topicTitle, count: sections.length } satisfies RootData as unknown as Record<string, unknown>,
      },
    ];
    const es: Edge[] = [];

    sections.forEach((s) => {
      const sid = `s${s.index}`;
      ns.push({
        id: sid,
        type: "section",
        position: { x: 0, y: 0 },
        data: {
          index: s.index,
          title: s.title,
          minutes: s.minutes,
          read: s.read,
          onJump: onJumpSection,
        } satisfies SectionData as unknown as Record<string, unknown>,
      });
      es.push({
        id: `e-root-${sid}`,
        source: "root",
        target: sid,
        type: "smoothstep",
        style: { stroke: s.read ? "var(--emerald)" : "var(--line-raised)", strokeWidth: 2 },
      });

      (termsBy.get(s.index) ?? []).forEach((term, j) => {
        const tid = `${sid}-t${j}`;
        ns.push({
          id: tid,
          type: "term",
          position: { x: 0, y: 0 },
          data: {
            uz: term.uz || term.ru,
            lat: term.lat ?? "",
            ru: term.ru ?? "",
            sectionIndex: s.index,
            onJump: onJumpSection,
          } satisfies TermData as unknown as Record<string, unknown>,
        });
        es.push({
          id: `e-${sid}-${tid}`,
          source: sid,
          target: tid,
          type: "smoothstep",
          style: { stroke: "var(--line)", strokeWidth: 1.4 },
        });
      });
    });

    return { nodes: layout(ns, es), edges: es };
  }, [sections, terms, topicTitle, onJumpSection]);

  if (sections.length === 0) return null;

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        colorMode={colorMode}
        fitView
        fitViewOptions={{ padding: 0.12 }}
        // ⚠️ Mount paytida panel kengligi hali 0 bo'lishi mumkin — o'shanda
        // `fitView` hech narsa qilmaydi va daraxtning o'ng chekkasi kesilib
        // qoladi. Shuning uchun keyingi kadrda qayta moslaymiz.
        onInit={(inst) => requestAnimationFrame(() => inst.fitView({ padding: 0.12 }))}
        minZoom={0.25}
        maxZoom={1.6}
        nodesConnectable={false}
        edgesFocusable={false}
        proOptions={{ hideAttribution: false }}
        className="bg-bg"
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="var(--line-raised)" />
        <Controls showInteractive={false} position="bottom-left" />
      </ReactFlow>
      <p className="pointer-events-none absolute left-3 top-3 rounded-pill bg-surface px-2.5 py-1 text-micro font-bold text-ink-soft shadow-card">
        {t("mindmapOpenSection")}
      </p>
    </div>
  );
}
