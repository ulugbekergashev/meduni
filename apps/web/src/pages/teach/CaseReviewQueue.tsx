import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, CheckCircle2, ChevronDown, ClipboardCheck, Clock, FlaskConical, HeartPulse, ListPlus, Search, Stethoscope, User } from "lucide-react";
import { Badge, Button, Card, Icon, Spinner, cls, useToast } from "@meduni/ui";
import { AsyncSection } from "../../components/AsyncSection";
import { QuickTaskModal } from "../../components/QuickTaskModal";
import {
  useCaseReviewDetail,
  useReviewCase,
  useReviewFilters,
  useReviewQueue,
  type CaseReviewDetail,
  type QueueItem,
  type QueueQuery,
} from "./api";

function daysAgoLabel(iso: string, t: (k: string, o?: any) => string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d <= 0) return t("today");
  return t("daysAgo", { count: d });
}

function QueueCard({ item, active, onClick }: { item: QueueItem; active: boolean; onClick: () => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "review" });
  return (
    <button
      onClick={onClick}
      className={cls(
        "w-full rounded-control border p-3 text-left transition-all",
        active ? "border-brand bg-brand-soft" : "border-line bg-surface hover:border-brand/40"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[14.5px] font-semibold text-ink">{item.studentName}</p>
        {item.status === "PENDING" ? (
          <Badge tone="amber">{t("pending")}</Badge>
        ) : (
          <Badge tone="emerald">{item.score}</Badge>
        )}
      </div>
      <p className="mt-0.5 truncate text-[13px] text-ink-soft">
        {item.subjectName} — {item.topic}
      </p>
      <p className="mt-1 flex items-center gap-1 text-[12.5px] text-ink-faint">
        <Icon icon={Clock} size={12} /> {daysAgoLabel(item.submittedAt, t)}
      </p>
    </button>
  );
}

function CaseBlocks({ blocks }: { blocks: CaseReviewDetail["blocks"] }) {
  const { t } = useTranslation(undefined, { keyPrefix: "review" });
  const [open, setOpen] = useState(false);
  const rows = [
    { icon: User, label: t("complaints"), text: blocks.complaints },
    { icon: HeartPulse, label: t("anamnesis"), text: blocks.anamnesis },
    { icon: Stethoscope, label: t("objective"), text: blocks.objectiveStatus },
    { icon: FlaskConical, label: t("lab"), text: blocks.labData },
  ];
  return (
    <Card className="p-0">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left">
        <span className="text-[14.5px] font-bold text-ink-soft">{t("caseBrief")}</span>
        <Icon icon={ChevronDown} size={16} className={cls("text-ink-faint transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="space-y-3 border-t border-line px-4 py-3">
          {rows.map((r) => r.text && (
            <div key={r.label}>
              <p className="mb-0.5 flex items-center gap-1.5 text-[12.5px] font-bold uppercase tracking-wide text-ink-faint">
                <Icon icon={r.icon} size={13} /> {r.label}
              </p>
              <p className="whitespace-pre-line text-[14px] text-ink">{r.text}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function ReviewPanel({ id, onSavedNext, onClose }: { id: number; onSavedNext: () => void; onClose: () => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "review" });
  const { show } = useToast();
  const detailQ = useCaseReviewDetail(id);
  const review = useReviewCase();
  const detail = detailQ.data;

  const [score, setScore] = useState("");
  const [feedback, setFeedback] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [assign, setAssign] = useState(false);
  const templates = t("templates", { returnObjects: true }) as string[];

  useEffect(() => {
    if (detail) {
      setScore(detail.score !== null ? String(detail.score) : "");
      setFeedback(detail.feedback ?? "");
      setErr(null);
    }
  }, [detail?.id]);

  const save = (thenNext: boolean) => {
    if (score.trim() === "" || isNaN(Number(score))) {
      setErr(t("scoreRequired"));
      return;
    }
    review.mutate(
      { id, score: Number(score), feedback },
      {
        onSuccess: () => {
          show(t("saved"));
          if (thenNext) onSavedNext();
        },
        onError: () => setErr(t("saveFailed")),
      }
    );
  };

  if (detailQ.isLoading) return <div className="flex min-h-[40vh] items-center justify-center"><Spinner size={24} /></div>;
  if (detailQ.isError || !detail) return <Card><p className="py-6 text-center text-[14.5px] text-rose">{t("loadError")}</p></Card>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 lg:hidden">
        <button onClick={onClose} className="flex items-center gap-1 text-[14.5px] font-medium text-brand-deep">
          <Icon icon={ArrowLeft} size={15} /> {t("backToQueue")}
        </button>
      </div>

      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-[18px] font-bold text-ink">{detail.studentName}</h2>
          {detail.status === "REVIEWED" && <Badge tone="emerald">{t("reviewed")}: {detail.score}</Badge>}
        </div>
        <p className="text-[13.5px] text-ink-faint">
          {detail.subjectName} — {detail.topic}
        </p>
      </div>

      <CaseBlocks blocks={detail.blocks} />

      {/* Answer + reference side by side */}
      <div className="space-y-3">
        {detail.questions.map((q, i) => (
          <Card key={i} className="space-y-3">
            <p className="text-[15px] font-semibold text-ink">{i + 1}. {q}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-control border border-line bg-bg p-3">
                <p className="mb-1 text-[12.5px] font-bold uppercase tracking-wide text-ink-faint">{t("studentAnswer")}</p>
                <p className="whitespace-pre-line text-[14.5px] text-ink">{detail.answers[i]}</p>
              </div>
              <div className="rounded-control bg-emerald-soft p-3">
                <p className="mb-1 text-[12.5px] font-bold uppercase tracking-wide text-emerald">{t("reference")}</p>
                <p className="whitespace-pre-line text-[14.5px] text-ink">{detail.referenceAnswer[i]}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Grade */}
      <Card className="space-y-3">
        <div className="flex items-center gap-3">
          <label className="text-[14.5px] font-semibold text-ink">{t("score")}</label>
          <input
            type="number"
            min={0}
            max={100}
            value={score}
            onChange={(e) => { setScore(e.target.value); setErr(null); }}
            className="w-24 rounded-control border border-line px-3 py-2 text-[16px] font-bold outline-none focus:border-brand"
            placeholder="0–100"
          />
          <span className="text-[13px] text-ink-faint">/ 100</span>
        </div>

        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder={t("feedbackPlaceholder")}
          rows={3}
          className="w-full rounded-control border border-line px-3 py-2 text-[14.5px] outline-none focus:border-brand"
        />
        <div className="flex flex-wrap gap-1.5">
          {templates.map((tpl) => (
            <button
              key={tpl}
              onClick={() => setFeedback((f) => (f ? f + " " : "") + tpl)}
              className="rounded-pill border border-line px-2.5 py-1 text-[13px] text-ink-soft transition-colors hover:bg-bg"
            >
              + {tpl}
            </button>
          ))}
        </div>

        {err && <p className="text-[13.5px] font-medium text-rose">{err}</p>}

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => save(true)} disabled={review.isPending}>
            <Icon icon={CheckCircle2} size={16} /> {t("saveAndNext")}
          </Button>
          <Button variant="soft" onClick={() => save(false)} disabled={review.isPending}>
            {t("saveOnly")}
          </Button>
          {/* Baholash oqimidan chiqmasdan vazifa berish (masalan "mavzuni takrorlang") */}
          <Button variant="ghost" icon={<Icon icon={ListPlus} size={16} />} onClick={() => setAssign(true)}>
            {t("assignTask")}
          </Button>
          <Button variant="ghost" onClick={onSavedNext}>{t("skip")}</Button>
        </div>
      </Card>

      <QuickTaskModal
        open={assign}
        onClose={() => setAssign(false)}
        prefill={{
          studentId: detail.studentId,
          studentName: detail.studentName,
          title: t("assignPrefill", { topic: detail.topic }),
        }}
      />
    </div>
  );
}

export function CaseReviewQueue() {
  const { t } = useTranslation(undefined, { keyPrefix: "review" });
  const navigate = useNavigate();

  const [query, setQuery] = useState<QueueQuery>({ status: "PENDING", search: "", sort: "oldest" });
  const [selected, setSelected] = useState<number | null>(null);

  const filtersQ = useReviewFilters();
  const queueQ = useReviewQueue(query);
  const queue = queueQ.data ?? [];
  const topicsForCourse = (filtersQ.data?.topics ?? []).filter((tp) => !query.courseId || tp.courseId === query.courseId);

  // Auto-select the first item when the queue loads / changes.
  useEffect(() => {
    if (queue.length > 0 && (selected === null || !queue.some((q) => q.id === selected))) setSelected(queue[0].id);
    if (queue.length === 0) setSelected(null);
  }, [queue.map((q) => q.id).join(",")]);

  const gotoNext = () => {
    const idx = queue.findIndex((q) => q.id === selected);
    const next = queue.slice(idx + 1).find((q) => q.status === "PENDING") ?? queue.slice(idx + 1)[0] ?? null;
    setSelected(next ? next.id : null);
  };

  const patch = (p: Partial<QueueQuery>) => setQuery((q) => ({ ...q, ...p }));

  return (
    <div>
      <button onClick={() => navigate("/teach")} className="mb-3 flex items-center gap-1 text-[14.5px] font-medium text-brand-deep hover:underline">
        <Icon icon={ArrowLeft} size={15} /> {t("back")}
      </button>
      <h1 className="text-h1 font-bold text-ink">{t("title")}</h1>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select value={query.courseId ?? ""} onChange={(e) => patch({ courseId: e.target.value ? Number(e.target.value) : undefined, topicId: undefined })} className="rounded-control border border-line bg-surface px-2 py-2 text-[14px] outline-none focus:border-brand">
          <option value="">{t("allCourses")}</option>
          {filtersQ.data?.courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={query.topicId ?? ""} onChange={(e) => patch({ topicId: e.target.value ? Number(e.target.value) : undefined })} className="rounded-control border border-line bg-surface px-2 py-2 text-[14px] outline-none focus:border-brand">
          <option value="">{t("allTopics")}</option>
          {topicsForCourse.map((tp) => <option key={tp.id} value={tp.id}>{tp.title}</option>)}
        </select>
        <select value={query.status} onChange={(e) => patch({ status: e.target.value as QueueQuery["status"] })} className="rounded-control border border-line bg-surface px-2 py-2 text-[14px] outline-none focus:border-brand">
          <option value="PENDING">{t("pending")}</option>
          <option value="REVIEWED">{t("reviewed")}</option>
          <option value="all">{t("all")}</option>
        </select>
        <select value={query.sort} onChange={(e) => patch({ sort: e.target.value as QueueQuery["sort"] })} className="rounded-control border border-line bg-surface px-2 py-2 text-[14px] outline-none focus:border-brand">
          <option value="oldest">{t("oldest")}</option>
          <option value="newest">{t("newest")}</option>
        </select>
        <div className="relative min-w-[160px] flex-1">
          <Icon icon={Search} size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input value={query.search} onChange={(e) => patch({ search: e.target.value })} placeholder={t("searchStudent")} className="w-full rounded-control border border-line bg-surface py-2 pl-9 pr-3 text-[14.5px] outline-none focus:border-brand" />
        </div>
      </div>

      {/* Two-pane */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,35%)_minmax(0,1fr)]">
        {/* Queue (hidden on mobile when a card is selected) */}
        <div className={cls(selected !== null && "hidden lg:block")}>
          <AsyncSection
            isLoading={queueQ.isLoading}
            isError={queueQ.isError}
            isEmpty={queue.length === 0}
            emptyIcon={<Icon icon={ClipboardCheck} size={22} />}
            emptyText=""
            onRetry={() => queueQ.refetch()}
          >
            <div className="space-y-2">
              {queue.map((item) => (
                <QueueCard key={item.id} item={item} active={item.id === selected} onClick={() => setSelected(item.id)} />
              ))}
            </div>
          </AsyncSection>
          {queue.length === 0 && !queueQ.isLoading && !queueQ.isError && (
            <Card className="flex flex-col items-center gap-2 border-emerald/40 bg-emerald-soft py-10 text-center">
              <Icon icon={CheckCircle2} size={26} className="text-emerald" />
              <p className="text-[15px] font-bold text-emerald">{t("emptyQueue")}</p>
            </Card>
          )}
        </div>

        {/* Detail */}
        <div className={cls(selected === null && "hidden lg:block")}>
          {selected !== null ? (
            <ReviewPanel id={selected} onSavedNext={gotoNext} onClose={() => setSelected(null)} />
          ) : (
            <Card className="hidden lg:flex lg:min-h-[40vh] lg:items-center lg:justify-center">
              <p className="text-[14.5px] text-ink-faint">{t("selectPrompt")}</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
