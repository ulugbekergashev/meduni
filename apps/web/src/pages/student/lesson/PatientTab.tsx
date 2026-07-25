import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  Check,
  MessageCircleQuestion,
  RotateCcw,
  SendHorizontal,
  Stethoscope,
  ThumbsUp,
  TriangleAlert,
  User,
} from "lucide-react";
import { Button, Icon, Modal, ProgressRing, Spinner, cls } from "@meduni/ui";
import { usePatient, useSendPatient, useFinishPatient, useResetPatient, type PatientEval, type PatientMsg } from "../api";

function Bubble({ m, animate }: { m: PatientMsg; animate: boolean }) {
  const mine = m.role === "student";
  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16, ease: "easeOut" }}
      className={cls("flex", mine ? "justify-end" : "justify-start")}
    >
      {!mine && (
        <div className="mr-2 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-soft text-rose">
          <Icon icon={User} size={14} />
        </div>
      )}
      <div
        className={cls(
          "max-w-[80%] whitespace-pre-wrap rounded-card px-3 py-2 text-body leading-relaxed",
          mine ? "rounded-br-control bg-brand text-white" : "rounded-bl-control bg-surface-raised text-ink-strong"
        )}
      >
        {m.text}
      </div>
    </motion.div>
  );
}

function ScorePill({ label, value }: { label: string; value: number }) {
  const tone = value >= 70 ? "text-emerald" : value >= 40 ? "text-amber" : "text-rose";
  return (
    <div className="rounded-control bg-surface-raised px-3 py-2 text-center">
      <p className={cls("text-section font-extrabold tabular-nums", tone)}>{value}</p>
      <p className="text-micro text-ink-dim">{label}</p>
    </div>
  );
}

/** Baholash natijasi. */
function EvalView({ ev, onReset }: { ev: PatientEval; onReset: () => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "patient" });
  return (
    <div className="space-y-3">
      <div className="flex flex-col items-center gap-2 rounded-card border border-line bg-surface-raised p-5 text-center">
        <ProgressRing value={ev.overallScore} size={92} stroke={10} tone={ev.correct ? "emerald" : "amber"} />
        <p className="text-section font-extrabold text-ink">{t("evalTitle")}</p>
        <span
          className={cls(
            "inline-flex items-center gap-1.5 rounded-pill px-3 py-0.5 text-note font-extrabold",
            ev.correct ? "bg-emerald-soft text-emerald" : "bg-amber-soft text-amber"
          )}
        >
          <Icon icon={ev.correct ? Check : TriangleAlert} size={13} />
          {ev.correct ? t("dxCorrect") : t("dxWrong")}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <ScorePill label={t("anamnesis")} value={ev.anamnesisScore} />
        <ScorePill label={t("communication")} value={ev.communicationScore} />
        <ScorePill label={t("overall")} value={ev.overallScore} />
      </div>

      <div className="rounded-control border-l-2 border-brand bg-brand-soft px-3.5 py-2.5">
        <p className="mb-0.5 text-micro font-extrabold uppercase tracking-wider text-brand-tint">{t("correctDx")}</p>
        <p className="text-note font-bold text-ink-strong">{ev.diagnosis}</p>
      </div>

      {ev.strengths && (
        <div className="flex gap-2.5 rounded-control border border-line px-3.5 py-2.5">
          <Icon icon={ThumbsUp} size={15} className="mt-0.5 shrink-0 text-emerald" />
          <div>
            <p className="text-micro font-extrabold uppercase tracking-wider text-emerald">{t("strengths")}</p>
            <p className="mt-0.5 text-note leading-relaxed text-ink-strong">{ev.strengths}</p>
          </div>
        </div>
      )}
      {ev.improvements && (
        <div className="flex gap-2.5 rounded-control border border-line px-3.5 py-2.5">
          <Icon icon={Activity} size={15} className="mt-0.5 shrink-0 text-amber" />
          <div>
            <p className="text-micro font-extrabold uppercase tracking-wider text-amber">{t("improvements")}</p>
            <p className="mt-0.5 text-note leading-relaxed text-ink-strong">{ev.improvements}</p>
          </div>
        </div>
      )}

      <button
        onClick={onReset}
        className="inline-flex items-center gap-1.5 rounded-control border border-line px-3.5 py-2 text-note font-bold text-ink-soft transition-colors hover:bg-surface-raised hover:text-ink"
      >
        <Icon icon={RotateCcw} size={14} />
        {t("retry")}
      </button>
    </div>
  );
}

/** Virtual bemor roleplay (Modul 26) — talaba anamnez yig'adi, AI bemor javob
 *  beradi, yakunda AI baholaydi. Fokus rejim (yon panellar yo'q). */
export function PatientTab({ topicId }: { topicId: number }) {
  const { t } = useTranslation(undefined, { keyPrefix: "patient" });
  const reduce = useReducedMotion();
  const q = usePatient(topicId);
  const send = useSendPatient(topicId);
  const finish = useFinishPatient(topicId);
  const reset = useResetPatient(topicId);

  const [draft, setDraft] = useState("");
  const [dx, setDx] = useState("");
  const [confirm, setConfirm] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const data = q.data;
  const messages = data?.messages ?? [];
  const chat = useMemo(() => messages.filter((m) => m.role !== "eval"), [messages]);
  const evalMsg = messages.find((m) => m.role === "eval")?.eval ?? null;
  const pending = send.isPending ? (send.variables as string) : null;
  const studentTurns = chat.filter((m) => m.role === "student").length;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [chat.length, pending, reduce]);

  if (q.isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner size={22} />
      </div>
    );
  }

  if (data && !data.available) {
    return (
      <div className="mx-auto flex max-w-[420px] flex-col items-center gap-2 py-10 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-card bg-surface-raised text-ink-faint">
          <Icon icon={Stethoscope} size={26} />
        </div>
        <p className="text-section font-extrabold text-ink">{t("noCaseTitle")}</p>
        <p className="text-note text-ink-dim">{t("noCaseHint")}</p>
      </div>
    );
  }

  // Baholangan bo'lsa — natija.
  if (evalMsg) {
    return (
      <div className="mx-auto max-w-[560px]">
        <EvalView ev={evalMsg} onReset={() => reset.mutate()} />
      </div>
    );
  }

  const submit = () => {
    const text = draft.trim();
    if (!text || send.isPending || finish.isPending) return;
    send.mutate(text);
    setDraft("");
  };

  return (
    <div className="mx-auto flex h-full max-w-[620px] flex-col">
      {/* Bemor kartasi + ko'rsatma + "Yangi bemor" (har safar boshqacha) */}
      <div className="mb-2 flex shrink-0 items-center gap-2.5 rounded-card border border-line bg-surface-raised p-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-rose-soft text-rose">
          <Icon icon={User} size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-body font-extrabold text-ink">{data?.patientInfo?.name || t("patientLabel")}</p>
          <p className="truncate text-micro text-ink-dim">{data?.patientInfo?.info || t("roleHint")}</p>
        </div>
        {chat.length > 0 && (
          <button
            onClick={() => reset.mutate()}
            disabled={reset.isPending}
            title={t("newPatient")}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-control border border-line px-2.5 py-1.5 text-micro font-bold text-ink-soft transition-colors hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-40"
          >
            {reset.isPending ? <Spinner size={12} /> : <Icon icon={RotateCcw} size={13} />}
            {t("newPatient")}
          </button>
        )}
      </div>

      {/* Suhbat */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {chat.length === 0 && !pending ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-card bg-rose-soft text-rose">
              <Icon icon={MessageCircleQuestion} size={22} />
            </div>
            <p className="text-note font-bold text-ink-soft">{t("startTitle")}</p>
            <p className="max-w-[320px] text-micro leading-relaxed text-ink-dim">{t("startHint")}</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {chat.map((m) => (
              <Bubble key={m.id} m={m} animate={!reduce} />
            ))}
            {pending && (
              <div key="pending" className="space-y-2">
                <Bubble
                  key="p-mine"
                  m={{ id: -1, role: "student", text: pending, createdAt: "" }}
                  animate={!reduce}
                />
                <div className="flex justify-start">
                  <div className="ml-9 rounded-card rounded-bl-control bg-surface-raised px-3 py-2.5">
                    <span className="inline-flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <motion.span
                          key={i}
                          animate={reduce ? undefined : { y: [0, -3, 0] }}
                          transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut", delay: i * 0.15 }}
                          className="h-1.5 w-1.5 rounded-full bg-ink-dim"
                        />
                      ))}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Kirish + yakunlash */}
      <div className="mt-2 shrink-0 space-y-2">
        <form
          className="flex items-end gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder={t("askPlaceholder")}
            maxLength={2000}
            className="max-h-24 min-h-[40px] min-w-0 flex-1 resize-none rounded-control border border-line bg-surface px-3 py-2.5 text-body text-ink outline-none transition-colors placeholder:text-ink-dim focus:border-brand"
          />
          <button
            type="submit"
            disabled={!draft.trim() || send.isPending}
            aria-label={t("ask")}
            className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-control bg-brand text-white transition-[background-color,transform] duration-150 hover:bg-brand-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand active:scale-95 disabled:opacity-40"
          >
            {send.isPending ? <Spinner size={14} /> : <Icon icon={SendHorizontal} size={16} />}
          </button>
        </form>

        <button
          onClick={() => setConfirm(true)}
          disabled={studentTurns === 0 || finish.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-control bg-emerald px-4 py-2.5 text-body font-extrabold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-40"
        >
          {finish.isPending ? <Spinner size={15} /> : <Icon icon={Stethoscope} size={16} />}
          {t("finishBtn")}
        </button>
      </div>

      {/* Tashxis kiritish modali */}
      <Modal open={confirm} onClose={() => setConfirm(false)} title={t("dxTitle")}>
        <p className="text-note text-ink-soft">{t("dxHint")}</p>
        <textarea
          value={dx}
          onChange={(e) => setDx(e.target.value)}
          rows={3}
          placeholder={t("dxPlaceholder")}
          maxLength={2000}
          autoFocus
          className="mt-3 w-full resize-none rounded-control border border-line bg-surface px-3 py-2 text-body text-ink outline-none focus:border-brand"
        />
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="ghost" size="md" onClick={() => setConfirm(false)} disabled={finish.isPending}>
            {t("cancel")}
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => {
              finish.mutate(dx.trim());
              setConfirm(false);
            }}
            disabled={finish.isPending}
          >
            {t("submitDx")}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
