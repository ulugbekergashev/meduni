import { memo, useCallback, useEffect, useMemo, useState } from "react";
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
import { Check, ChevronDown, ChevronRight, Clock, Maximize2, Minimize2, Network, TriangleAlert } from "lucide-react";
import { Icon, cls } from "@meduni/ui";
import type { DigestBlock, LessonSection, Term } from "../api";
import "@xyflow/react/dist/style.css";

// 2026-08-01 (buyurtmachi: "mindmapni Mapify darajasida qil"): ilgari xarita
// ikki qavatli edi — mavzu → bo'limlar → atamalar. Ya'ni konspektning ASOSIY
// mazmuni (bo'lim ichidagi tayanch g'oyalar, muhim ogohlantirishlar) xaritada
// umuman ko'rinmasdi. Endi UCH qavat + tarmoq ranglari + yig'ish/yoyish:
//   mavzu → bo'lim → tayanch nuqta (blokdan) → atama
// Hamma narsa konspektdan hosila (AI chaqiruvi YO'Q, nol xarajat).

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Tarmoq ranglari — §4 diagramma to'plami (CVD-validatsiyadan o'tgan). */
const BRANCH = [
  { stroke: "var(--brand)", dot: "bg-brand", soft: "bg-brand-soft", text: "text-brand-tint", border: "border-brand" },
  { stroke: "var(--emerald)", dot: "bg-emerald", soft: "bg-emerald-soft", text: "text-emerald", border: "border-emerald" },
  { stroke: "var(--amber)", dot: "bg-amber", soft: "bg-amber-soft", text: "text-amber", border: "border-amber" },
  { stroke: "var(--blue)", dot: "bg-blue", soft: "bg-blue-soft", text: "text-blue", border: "border-blue" },
  { stroke: "var(--rose)", dot: "bg-rose", soft: "bg-rose-soft", text: "text-rose", border: "border-rose" },
] as const;
const branchOf = (i: number) => BRANCH[i % BRANCH.length];

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

interface PointItem {
  label: string;
  detail: string;
  warn: boolean;
}

/** Bo'limning TAYANCH NUQTALARI — ro'yxat elementlari va callout'lardan.
 *  Uzun paragraf bo'linmaydi (xaritada matn devori bo'lmasin). */
function sectionPoints(s: LessonSection, max = 5): PointItem[] {
  const out: PointItem[] = [];
  for (const b of s.blocks as DigestBlock[]) {
    if (out.length >= max) break;
    if (b.type === "list") {
      for (const it of b.items) {
        if (out.length >= max) break;
        const lead = (it.lead ?? "").trim();
        const text = (it.text ?? "").trim();
        if (lead) out.push({ label: lead, detail: text, warn: false });
        else if (text) {
          const [head, ...rest] = text.split(/\s+[—–-]\s+/);
          if (rest.length) out.push({ label: head.trim(), detail: rest.join(" — ").trim(), warn: false });
        }
      }
    } else if (b.type === "callout") {
      const text = (b.text ?? "").trim();
      if (!text) continue;
      const [head, ...rest] = text.split(/\s+[—–-]\s+/);
      out.push({
        label: rest.length ? head.trim() : text.split(/(?<=[.!?])\s/)[0].slice(0, 60),
        detail: rest.length ? rest.join(" — ").trim() : text,
        warn: b.tone === "warning",
      });
    }
  }
  return out;
}

/** Atamani birinchi uchragan bo'limga biriktiradi (so'z chegarasi bilan). */
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
    const idx = found === -1 ? sections[0].index : sections[found].index;
    const arr = byIndex.get(idx) ?? [];
    if (arr.length < 4) {
      arr.push(term);
      byIndex.set(idx, arr);
      used.add(id);
    }
  }
  return byIndex;
}

// ---------- Tugun turlari (o'z dizayn tokenlarimizda) ----------

const HANDLE = "!h-1.5 !w-1.5 !border-0 !bg-transparent";

type Side = "left" | "right";
type RootData = { title: string; sections: number; nodes: number };
type SectionData = {
  index: number;
  title: string;
  minutes: number;
  read: boolean;
  children: number;
  collapsed: boolean;
  branch: number;
  side: Side;
  onJump: (i: number) => void;
  onToggle: (i: number) => void;
};
type PointData = { label: string; detail: string; warn: boolean; branch: number; side: Side; sectionIndex: number; onJump: (i: number) => void };
type TermData = { uz: string; lat: string; ru: string; branch: number; side: Side; sectionIndex: number; onJump: (i: number) => void };

const RootNode = memo(({ data }: NodeProps) => {
  const d = data as unknown as RootData;
  return (
    <div className="w-[228px] rounded-card bg-gradient-to-br from-brand-deep to-brand px-4 py-3 text-white shadow-card">
      <span className="mb-1 inline-flex items-center gap-1.5 text-micro font-extrabold uppercase tracking-wider opacity-80">
        <Icon icon={Network} size={12} /> {d.sections} · {d.nodes}
      </span>
      <p className="text-body font-extrabold leading-tight">{d.title}</p>
      <Handle type="source" position={Position.Right} id="r" className={HANDLE} />
      <Handle type="source" position={Position.Left} id="l" className={HANDLE} />
    </div>
  );
});
RootNode.displayName = "RootNode";

const SectionNode = memo(({ data }: NodeProps) => {
  const d = data as unknown as SectionData;
  const c = branchOf(d.branch);
  const inSide = d.side === "left" ? Position.Right : Position.Left;
  const outSide = d.side === "left" ? Position.Left : Position.Right;
  return (
    <div
      className={cls(
        "flex w-[264px] items-start gap-2 rounded-card border-y border-r border-l-[3px] bg-surface py-2.5 pl-2.5 pr-1.5 shadow-card transition-colors",
        c.border,
        d.read ? "border-y-emerald/40 border-r-emerald/40" : "border-y-line border-r-line"
      )}
    >
      <Handle type="target" position={inSide} className={HANDLE} />
      <button
        onClick={() => d.onJump(d.index)}
        className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <div className="mb-1 flex items-center gap-1.5">
          <span
            className={cls(
              "flex h-5 w-5 items-center justify-center rounded-pill text-micro font-extrabold tabular-nums",
              d.read ? "bg-emerald-soft text-emerald" : cls(c.soft, c.text)
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
      </button>
      {d.children > 0 && (
        <button
          onClick={() => d.onToggle(d.index)}
          title={String(d.children)}
          className="mt-0.5 flex shrink-0 items-center gap-0.5 rounded-control px-1 py-1 text-ink-faint transition-colors hover:bg-bg hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <span className="text-micro font-bold tabular-nums">{d.children}</span>
          <Icon icon={d.collapsed ? ChevronRight : ChevronDown} size={13} />
        </button>
      )}
      <Handle type="source" position={outSide} className={HANDLE} />
    </div>
  );
});
SectionNode.displayName = "SectionNode";

const PointNode = memo(({ data }: NodeProps) => {
  const d = data as unknown as PointData;
  const c = branchOf(d.branch);
  const inSide = d.side === "left" ? Position.Right : Position.Left;
  return (
    <button
      onClick={() => d.onJump(d.sectionIndex)}
      title={d.detail || undefined}
      className={cls(
        "w-[228px] rounded-control border bg-surface px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
        d.warn ? "border-amber hover:bg-amber-soft" : "border-line hover:bg-bg"
      )}
    >
      <Handle type="target" position={inSide} className={HANDLE} />
      <p className="flex items-start gap-1.5 text-micro font-bold leading-snug text-ink">
        {d.warn ? (
          <Icon icon={TriangleAlert} size={11} className="mt-[2px] shrink-0 text-amber" />
        ) : (
          <span className={cls("mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full", c.dot)} />
        )}
        <span className="min-w-0 flex-1 line-clamp-2">{d.label}</span>
      </p>
      {d.detail && <p className="mt-0.5 line-clamp-2 pl-3 text-micro leading-snug text-ink-dim">{d.detail}</p>}
    </button>
  );
});
PointNode.displayName = "PointNode";

const TermNode = memo(({ data }: NodeProps) => {
  const d = data as unknown as TermData;
  const inSide = d.side === "left" ? Position.Right : Position.Left;
  return (
    <button
      onClick={() => d.onJump(d.sectionIndex)}
      title={d.ru || undefined}
      className="w-[186px] rounded-pill border border-line bg-surface-raised px-3 py-1.5 text-left transition-colors hover:border-violet hover:bg-violet-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <Handle type="target" position={inSide} className={HANDLE} />
      <p className="truncate text-micro font-bold text-ink">{d.uz}</p>
      {d.lat && <p className="truncate text-micro italic text-ink-faint">{d.lat}</p>}
    </button>
  );
});
TermNode.displayName = "TermNode";

const nodeTypes = { root: RootNode, section: SectionNode, point: PointNode, term: TermNode };

const SIZE = {
  root: { w: 228, h: 88 },
  section: { w: 264, h: 76 },
  point: { w: 228, h: 62 },
  term: { w: 186, h: 44 },
} as const;

const sizeOf = (n: Node) => SIZE[(n.type as keyof typeof SIZE) ?? "section"];

/** Bitta tomonni dagre bilan joylashtiradi (LR) va markazlashtirilgan
 *  koordinatalar qaytaradi (root — (0,0) da). */
function layoutSide(nodes: Node[], edges: Edge[]): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 14, ranksep: 84, marginx: 0, marginy: 0 });
  for (const n of nodes) {
    const s = sizeOf(n);
    g.setNode(n.id, { width: s.w, height: s.h });
  }
  for (const e of edges) g.setEdge(e.source, e.target);
  dagre.layout(g);
  const root = g.node("root");
  const out = new Map<string, { x: number; y: number }>();
  for (const n of nodes) {
    const p = g.node(n.id);
    out.set(n.id, { x: p.x - root.x, y: p.y - root.y });
  }
  return out;
}

/**
 * IKKI TOMONLAMA joylashuv (Mapify/MindMeister naqshi): tarmoqlarning yarmi
 * markazdan o'ngga, yarmi chapga o'sadi.
 *
 * ⚠️ Nega: bitta tomonlama (LR) daraxtda 30+ tugun vertikal ustunga tizilib,
 * kanvas baland-tor bo'lib qolardi — `fitView` uni juda kichraytirar va ekranning
 * yarmi bo'sh turardi (o'lchandi: 33 tugun → matn o'qib bo'lmas darajada mayda).
 */
function layoutBilateral(nodes: Node[], edges: Edge[], leftIds: Set<string>): Node[] {
  const root = nodes.find((n) => n.id === "root")!;
  const pick = (left: boolean) => {
    const ns = nodes.filter((n) => n.id === "root" || leftIds.has(n.id) === left);
    const ids = new Set(ns.map((n) => n.id));
    return { ns, es: edges.filter((e) => ids.has(e.source) && ids.has(e.target)) };
  };
  const right = pick(false);
  const left = pick(true);
  const posR = layoutSide(right.ns, right.es);
  const posL = left.ns.length > 1 ? layoutSide(left.ns, left.es) : new Map<string, { x: number; y: number }>();

  const place = (n: Node, p: { x: number; y: number }, mirror: boolean) => {
    const s = sizeOf(n);
    const cx = mirror ? -p.x : p.x;
    return { ...n, position: { x: cx - s.w / 2, y: p.y - s.h / 2 } };
  };

  const out: Node[] = [place(root, { x: 0, y: 0 }, false)];
  for (const n of nodes) {
    if (n.id === "root") continue;
    const isLeft = leftIds.has(n.id);
    const p = (isLeft ? posL : posR).get(n.id);
    if (p) out.push(place(n, p, isLeft));
  }
  return out;
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
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  const toggle = useCallback((index: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const { nodes, edges, total } = useMemo(() => {
    if (sections.length === 0) return { nodes: [] as Node[], edges: [] as Edge[], total: 0 };
    const termsBy = assignTerms(sections, terms);
    const ns: Node[] = [];
    const es: Edge[] = [];
    const leftIds = new Set<string>();
    let count = 0;

    // Tarmoqlar navbat bilan o'ng/chapga taqsimlanadi (markazdan ikki tomonga).
    sections.forEach((s, si) => {
      const c = branchOf(si);
      const side: Side = si % 2 === 1 ? "left" : "right";
      const sid = `s${s.index}`;
      if (side === "left") leftIds.add(sid);
      const points = sectionPoints(s);
      const sectionTerms = termsBy.get(s.index) ?? [];
      const children = points.length + sectionTerms.length;
      const isCollapsed = collapsed.has(s.index);
      count += 1 + children;

      ns.push({
        id: sid,
        type: "section",
        position: { x: 0, y: 0 },
        data: {
          index: s.index,
          title: s.title,
          minutes: s.minutes,
          read: s.read,
          children,
          collapsed: isCollapsed,
          branch: si,
          side,
          onJump: onJumpSection,
          onToggle: toggle,
        } satisfies SectionData as unknown as Record<string, unknown>,
      });
      es.push({
        id: `e-root-${sid}`,
        source: "root",
        sourceHandle: side === "left" ? "l" : "r",
        target: sid,
        type: "bezier",
        style: { stroke: s.read ? "var(--emerald)" : c.stroke, strokeWidth: 2.4 },
      });

      if (isCollapsed) return;

      points.forEach((p, j) => {
        const pid = `${sid}-p${j}`;
        if (side === "left") leftIds.add(pid);
        ns.push({
          id: pid,
          type: "point",
          position: { x: 0, y: 0 },
          data: {
            label: p.label,
            detail: p.detail,
            warn: p.warn,
            branch: si,
            side,
            sectionIndex: s.index,
            onJump: onJumpSection,
          } satisfies PointData as unknown as Record<string, unknown>,
        });
        es.push({
          id: `e-${sid}-${pid}`,
          source: sid,
          target: pid,
          type: "bezier",
          style: { stroke: c.stroke, strokeWidth: 1.5, opacity: 0.75 },
        });
      });

      sectionTerms.forEach((term, j) => {
        const tid = `${sid}-t${j}`;
        if (side === "left") leftIds.add(tid);
        ns.push({
          id: tid,
          type: "term",
          position: { x: 0, y: 0 },
          data: {
            uz: term.uz || term.ru,
            lat: term.lat ?? "",
            ru: term.ru ?? "",
            branch: si,
            side,
            sectionIndex: s.index,
            onJump: onJumpSection,
          } satisfies TermData as unknown as Record<string, unknown>,
        });
        es.push({
          id: `e-${sid}-${tid}`,
          source: sid,
          target: tid,
          type: "bezier",
          style: { stroke: "var(--line-raised)", strokeWidth: 1.2 },
        });
      });
    });

    ns.unshift({
      id: "root",
      type: "root",
      position: { x: 0, y: 0 },
      data: { title: topicTitle, sections: sections.length, nodes: count } satisfies RootData as unknown as Record<string, unknown>,
    });

    return { nodes: layoutBilateral(ns, es, leftIds), edges: es, total: count };
  }, [sections, terms, topicTitle, onJumpSection, collapsed, toggle]);

  if (sections.length === 0) return null;

  const allCollapsed = collapsed.size >= sections.length;

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
        minZoom={0.2}
        maxZoom={1.8}
        nodesConnectable={false}
        edgesFocusable={false}
        proOptions={{ hideAttribution: false }}
        className="bg-bg"
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="var(--line-raised)" />
        <Controls showInteractive={false} position="bottom-left" />
      </ReactFlow>

      <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
        <span className="rounded-pill bg-surface px-2.5 py-1 text-micro font-bold text-ink-soft shadow-card">
          {t("mindmapOpenSection")}
        </span>
        <span className="rounded-pill bg-surface px-2.5 py-1 text-micro font-bold text-ink-faint shadow-card tabular-nums">
          {total}
        </span>
        {/* Yoyish/yig'ish — katta xaritada ko'rinishni boshqarish (Mapify naqshi) */}
        <button
          onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(sections.map((s) => s.index)))}
          className="pointer-events-auto inline-flex items-center gap-1 rounded-pill bg-surface px-2.5 py-1 text-micro font-bold text-ink-soft shadow-card transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <Icon icon={allCollapsed ? Maximize2 : Minimize2} size={11} />
          {allCollapsed ? t("mindmapExpand") : t("mindmapCollapse")}
        </button>
      </div>
    </div>
  );
}
