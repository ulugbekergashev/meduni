import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, CheckCircle2, ChevronDown, ClipboardCheck, Clock, FlaskConical, HeartPulse, ListPlus, Search, Sparkles, Stethoscope, User } from "lucide-react";
import { Badge, Button, Card, Icon, Spinner, cls, useToast } from "@meduni/ui";
import { AsyncSection } from "../../components/AsyncSection";
import { Disclosure } from "../../components/Disclosure";
import { QuickTaskModal } from "../../components/QuickTaskModal";
import {
  useAiSuggest,
  useCaseReviewDetail,
  useReviewCase,
  useReviewFilters,
  useReviewQueue,
  type CaseReviewDetail,
  type PatientSessionLog,
  type QueueItem,
  type QueueQuery,
} from "./api";

/** Modul 28 — AI tavsiyaviy baho kartasi. FAQAT tavsiya: "Qo'llash" bosilsa
 *  ball inputga ko'chadi, yakuniy qaror o'qituvchida. */
function AiSuggestCard({
  attemptId,
  detail,
  onApply,
}: {
  attemptId: number;
  detail: CaseReviewDetail;
  onApply: (score: number) => void;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "review" });
  const suggest = useAiSuggest(attemptId);
  const s = detail.aiSuggest;

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand-tint">
          <Icon icon={Sparkles} size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-body font-extrabold text-ink">{t("aiTitle")}</p>
          <p className="text-note text-ink-faint">{t("aiHint")}</p>
        </div>
        {detail.autoScore !== null && (
          <span className="shrink-0 rounded-pill bg-surface-raised px-2.5 py-1 text-note font-bold tabular-nums text-ink-soft">
            {t("autoScoreShort")}: {detail.autoScore}%
          </span>
        )}
        {!s && (
          <Button size="sm" onClick={() => suggest.mutate(undefined)} disabled={suggest.isPending}>
            {suggest.isPending ? t("aiLoading") : t("aiGet")}
          </Button>
        )}
      </div>

      {s && (
        <div className="space-y-2.5 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-stat font-extrabold tabular-nums text-brand-tint">{s.score}</span>
            <p className="min-w-0 flex-1 text-body leading-relaxed text-ink-strong">{s.rationale}</p>
          </div>
          {s.missed.length > 0 && (
            <div className="rounded-control border-l-2 border-amber bg-amber-soft px-3.5 py-2.5">
              <p className="mb-1 text-micro font-extrabold uppercase tracking-wider text-amber">{t("aiMissed")}</p>
              <ul className="space-y-0.5">
                {s.missed.map((m, i) => (
                  <li key={i} className="text-note leading-relaxed text-ink-strong">
                    · {m}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => onApply(s.score)}>
              {t("aiApply", { n: s.score })}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => suggest.mutate(true)} disabled={suggest.isPending}>
              {suggest.isPending ? t("aiLoading") : t("aiAgain")}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

/** Modul 28 — talabaning virtual bemor amaliyoti (read-only log + AI baho). */
function PatientSessionCard({ session }: { session: PatientSessionLog }) {
  const { t } = useTranslation(undefined, { keyPrefix: "review" });
  const [open, setOpen] = useState(false);
  const ev = session.eval;

  return (
    <Card className="overflow-hidden p-0">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-rose-soft text-rose">
          <Icon icon={HeartPulse} size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-body font-extrabold text-ink">{t("patientLogTitle")}</p>
          <p className="truncate text-note text-ink-faint">
            {ev
              ? t("patientLogEval", { overall: ev.overallScore, anamnez: ev.anamnesisScore })
              : t("patientLogNoEval", { n: session.messages.length })}
          </p>
        </div>
        {ev && (
          <span
            className={cls(
              "shrink-0 rounded-pill px-2.5 py-1 text-note font-extrabold tabular-nums",
              ev.correct ? "bg-emerald-soft text-emerald" : "bg-amber-soft text-amber"
            )}
          >
            {ev.overallScore}
          </span>
        )}
        <Icon
          icon={ChevronDown}
          size={17}
          className={cls("shrink-0 text-ink-dim transition-transform", !open && "-rotate-90")}
        />
      </button>

      {open && (
        <div className="border-t border-line">
          {ev && (
            <div className="border-b border-line px-4 py-2.5 text-note leading-relaxed text-ink-strong">
              <span className="font-bold">{t("patientDx")}:</span> {ev.diagnosis}
              {ev.improvements && (
                <>
                  {" · "}
                  <span className="text-ink-soft">{ev.improvements}</span>
                </>
              )}
            </div>
          )}
          <div className="max-h-[320px] space-y-2 overflow-y-auto px-4 py-3">
            {session.messages.map((m, i) => (
              <div key={i} className={cls("flex", m.role === "student" ? "justify-end" : "justify-start")}>
                <p
                  className={cls(
                    "max-w-[80%] whitespace-pre-wrap rounded-card px-3 py-1.5 text-note leading-relaxed",
                    m.role === "student"
                      ? "rounded-br-control bg-brand-soft text-ink"
                      : "rounded-bl-control bg-surface-raised text-ink-strong"
                  )}
                >
                  {m.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

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
        <p className="truncate text-note font-semibold text-ink">{item.studentName}</p>
        {item.status === "PENDING" ? (
          <Badge tone="amber">{t("pending")}</Badge>
        ) : (
          <Badge tone="emerald">{item.score}</Badge>
        )}
      </div>
      <p className="mt-0.5 truncate text-micro text-ink-soft">
        {item.subjectName} — {item.topic}
      </p>
      <p className="mt-1 flex items-center gap-1 text-micro text-ink-faint">
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
        <span className="text-note font-bold text-ink-soft">{t("caseBrief")}</span>
        <Icon icon={ChevronDown} size={16} className={cls("text-ink-faint transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="space-y-3 border-t border-line px-4 py-3">
          {rows.map((r) => r.text && (
            <div key={r.label}>
              <p className="mb-0.5 flex items-center gap-1.5 text-micro font-bold uppercase tracking-wide text-ink-faint">
                <Icon icon={r.icon} size={13} /> {r.label}
              </p>
              <p className="whitespace-pre-line text-note text-ink">{r.text}</p>
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
  if (detailQ.isError || !detail) return <Card><p className="py-6 text-center text-note text-rose">{t("loadError")}</p></Card>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 lg:hidden">
        <button onClick={onClose} className="flex items-center gap-1 text-note font-medium text-brand-deep">
          <Icon icon={ArrowLeft} size={15} /> {t("backToQueue")}
        </button>
      </div>

      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-body font-bold text-ink">{detail.studentName}</h2>
          {detail.status === "REVIEWED" && <Badge tone="emerald">{t("reviewed")}: {detail.score}</Badge>}
        </div>
        <p className="text-micro text-ink-faint">
          {detail.subjectName} — {detail.topic}
        </p>
      </div>

      <CaseBlocks blocks={detail.blocks} />

      {/* Answer + reference side by side */}
      <div className="space-y-3">
        {detail.questions.map((q, i) => (
          <Card key={i} className="space-y-3">
            <p className="text-note font-semibold text-ink">{i + 1}. {q}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-control border border-line bg-bg p-3">
                <p className="mb-1 text-micro font-bold uppercase tracking-wide text-ink-faint">{t("studentAnswer")}</p>
                <p className="whitespace-pre-line text-note text-ink">{detail.answers[i]}</p>
              </div>
              <div className="rounded-control bg-emerald-soft p-3">
                <p className="mb-1 text-micro font-bold uppercase tracking-wide text-emerald">{t("reference")}</p>
                <p className="whitespace-pre-line text-note text-ink">{detail.referenceAnswer[i]}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Modul 28 — AI tavsiyasi + talabaning virtual bemor amaliyoti */}
      <AiSuggestCard
        attemptId={id}
        detail={detail}
        onApply={(s) => {
          setScore(String(s));
          setErr(null);
        }}
      />
      {detail.patientSession && <PatientSessionCard session={detail.patientSession} />}

      {/* Grade Sticky Bottom */}
      <div className="sticky bottom-0 z-20 mt-3 border-t-2 border-brand/20 bg-surface p-5 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] sm:rounded-card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          
          <div className="flex flex-1 flex-col gap-3">
            <div className="flex items-center gap-3">
              <label className="text-note font-bold text-ink uppercase tracking-wide">{t("score")}</label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={score}
                  onChange={(e) => { setScore(e.target.value); setErr(null); }}
                  className="w-28 rounded-[8px] border-2 border-line bg-white px-3 py-2 text-body font-black outline-none transition-all focus:border-brand focus:ring-4 focus:ring-brand/10"
                  placeholder="0–100"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-note font-bold text-ink-faint">/ 100</span>
              </div>
            </div>

            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder={t("feedbackPlaceholder")}
              rows={2}
              className="w-full rounded-[8px] border-2 border-line bg-white px-3 py-2 text-note outline-none transition-all focus:border-brand focus:ring-4 focus:ring-brand/10 resize-y"
            />
            <div className="flex flex-wrap gap-1.5">
              {templates.map((tpl) => (
                <button
                  key={tpl}
                  onClick={() => setFeedback((f) => (f ? f + " " : "") + tpl)}
                  className="rounded-pill border border-line bg-white px-3 py-1 text-micro font-medium text-ink-soft transition-colors hover:border-brand/40 hover:bg-brand-soft hover:text-brand-deep"
                >
                  + {tpl}
                </button>
              ))}
            </div>
            {err && <p className="text-micro font-bold text-rose">{err}</p>}
          </div>

          <div className="flex flex-col gap-2 sm:w-[180px]">
            <Button onClick={() => save(true)} disabled={review.isPending} className="w-full h-[46px] bg-gradient-to-r from-brand to-brand-deep shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all text-note font-bold">
              <Icon icon={CheckCircle2} size={18} /> {t("saveAndNext")}
            </Button>
            <Button variant="soft" onClick={() => save(false)} disabled={review.isPending} className="w-full h-[40px]">
              {t("saveOnly")}
            </Button>
            <div className="flex items-center justify-between mt-1">
              <button onClick={() => setAssign(true)} className="text-micro font-medium text-brand-deep hover:underline">
                <Icon icon={ListPlus} size={14} className="inline mr-1 mb-0.5" />{t("assignTask")}
              </button>
              <button onClick={onSavedNext} className="text-micro font-medium text-ink-faint hover:text-ink">
                {t("skip")}
              </button>
            </div>
          </div>

        </div>
      </div>

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
  const [searchParams] = useSearchParams();

  const [query, setQuery] = useState<QueueQuery>({ status: "PENDING", search: "", sort: "oldest" });
  // Vazifalar navbatidan "?open=<id>" bilan kelinganda aynan o'sha yozuv ochilsin
  // (ro'yxatdagi birinchisi emas — CLAUDE.md "konkret narsaga link" qoidasi).
  const openId = Number(searchParams.get("open"));
  const [selected, setSelected] = useState<number | null>(Number.isFinite(openId) && openId > 0 ? openId : null);

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
      <button onClick={() => navigate("/teach")} className="mb-3 flex items-center gap-1 text-note font-medium text-brand-deep hover:underline">
        <Icon icon={ArrowLeft} size={15} /> {t("back")}
      </button>
      <h1 className="text-h1 font-bold text-ink">{t("title")}</h1>

      {/* Filtrlar — sukut bo'yicha faqat holat + qidiruv (navbat FIFO ishlaydi).
          Kurs/mavzu/tartib kamdan-kam kerak → "Batafsil" ostida (5 boshqaruv
          bir qatorda turgani sahifani og'irlashtirardi). */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select value={query.status} onChange={(e) => patch({ status: e.target.value as QueueQuery["status"] })} className="rounded-control border border-line bg-surface px-2 py-2 text-note outline-none focus:border-brand">
          <option value="PENDING">{t("pending")}</option>
          <option value="REVIEWED">{t("reviewed")}</option>
          <option value="all">{t("all")}</option>
        </select>
        <div className="relative min-w-[160px] flex-1">
          <Icon icon={Search} size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input value={query.search} onChange={(e) => patch({ search: e.target.value })} placeholder={t("searchStudent")} className="w-full rounded-control border border-line bg-surface py-2 pl-9 pr-3 text-note outline-none focus:border-brand" />
        </div>
      </div>
      <Disclosure
        label={t("moreFilters")}
        count={(query.courseId ? 1 : 0) + (query.topicId ? 1 : 0) + (query.sort !== "oldest" ? 1 : 0)}
        className="mt-2"
      >
        <div className="flex flex-wrap items-center gap-2">
          <select value={query.courseId ?? ""} onChange={(e) => patch({ courseId: e.target.value ? Number(e.target.value) : undefined, topicId: undefined })} className="rounded-control border border-line bg-surface px-2 py-2 text-note outline-none focus:border-brand">
            <option value="">{t("allCourses")}</option>
            {filtersQ.data?.courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={query.topicId ?? ""} onChange={(e) => patch({ topicId: e.target.value ? Number(e.target.value) : undefined })} className="rounded-control border border-line bg-surface px-2 py-2 text-note outline-none focus:border-brand">
            <option value="">{t("allTopics")}</option>
            {topicsForCourse.map((tp) => <option key={tp.id} value={tp.id}>{tp.title}</option>)}
          </select>
          <select value={query.sort} onChange={(e) => patch({ sort: e.target.value as QueueQuery["sort"] })} className="rounded-control border border-line bg-surface px-2 py-2 text-note outline-none focus:border-brand">
            <option value="oldest">{t("oldest")}</option>
            <option value="newest">{t("newest")}</option>
          </select>
        </div>
      </Disclosure>

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
            <Card className="flex flex-col items-center gap-2 border-emerald/40 bg-emerald-soft py-5 text-center">
              <Icon icon={CheckCircle2} size={26} className="text-emerald" />
              <p className="text-note font-bold text-emerald">{t("emptyQueue")}</p>
            </Card>
          )}
        </div>

        {/* Detail */}
        <div className={cls(selected === null && "hidden lg:block")}>
          {selected !== null ? (
            <ReviewPanel id={selected} onSavedNext={gotoNext} onClose={() => setSelected(null)} />
          ) : (
            <Card className="hidden lg:flex lg:min-h-[40vh] lg:items-center lg:justify-center">
              <p className="text-note text-ink-faint">{t("selectPrompt")}</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
