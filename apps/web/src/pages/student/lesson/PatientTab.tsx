import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  Check,
  CheckCircle2,
  CircleDot,
  FlaskConical,
  HeartPulse,
  Loader2,
  RefreshCw,
  RotateCcw,
  SendHorizontal,
  Sparkles,
  Stethoscope,
  ThumbsUp,
  TriangleAlert,
  User,
  XCircle,
} from "lucide-react";
import { Button, Icon, Modal, ProgressRing, Spinner, cls } from "@meduni/ui";
import { apiErrorMessage } from "../../../lib/api";
import { useLocale } from "../../../lib/useLocale";
import {
  usePatient,
  useSendPatient,
  useFinishPatient,
  useResetPatient,
  useOrderTest,
  usePatientDDx,
  useStartPatient,
  useMeasureVitals,
  type DDxItem,
  type ExamPlan,
  type PatientEval,
  type PatientMsg,
  type PatientVitals,
} from "../api";

const STEP_KEYS = ["stepAnamnesis", "stepExam", "stepDdx", "stepDx"] as const;

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

/** "Bemor yozmoqda" nuqtalari — ochilish gapi va javob kutilganда. */
function Typing({ reduce }: { reduce: boolean | null }) {
  return (
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

/** Tekshiruv rejasining tahlili: nima shart edi, nima ortiqcha, nima qoldi.
 *  Asosiy o'quv xabari — "hammasini buyurish" yechim emas, u pul turadi. */
function ExamPlanView({ plan }: { plan: ExamPlan }) {
  const { t } = useTranslation(undefined, { keyPrefix: "patient" });
  const unit = t("costUnit");
  const VERDICT = {
    required: { icon: CheckCircle2, tone: "text-emerald", label: t("verdictRequired") },
    optional: { icon: CircleDot, tone: "text-ink-faint", label: t("verdictOptional") },
    unnecessary: { icon: XCircle, tone: "text-rose", label: t("verdictUnnecessary") },
  } as const;

  return (
    <div className="rounded-card border border-line p-3.5">
      <div className="mb-2.5 flex items-center gap-2">
        <Icon icon={FlaskConical} size={14} className="shrink-0 text-ink-faint" />
        <p className="min-w-0 flex-1 text-micro font-extrabold uppercase tracking-wider text-ink-faint">
          {t("planTitle")}
        </p>
      </div>

      {/* Xulosa: sarflandi / ortiqcha pul / ortiqcha uchun ayirilgan BALL */}
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="rounded-control bg-surface-raised px-3 py-2">
          <p className="text-micro text-ink-dim">{t("planSpent")}</p>
          <p className="text-section font-extrabold tabular-nums text-ink">
            {plan.spent} <span className="text-note font-bold text-ink-dim">{unit}</span>
          </p>
        </div>
        <div className={cls("rounded-control px-3 py-2", plan.wasted > 0 ? "bg-rose-soft" : "bg-emerald-soft")}>
          <p className={cls("text-micro", plan.wasted > 0 ? "text-rose" : "text-emerald")}>{t("planWasted")}</p>
          <p
            className={cls(
              "text-section font-extrabold tabular-nums",
              plan.wasted > 0 ? "text-rose" : "text-emerald"
            )}
          >
            {plan.wasted} <span className="text-note font-bold opacity-80">{unit}</span>
          </p>
        </div>
        <div
          className={cls(
            "col-span-2 rounded-control px-3 py-2 sm:col-span-1",
            plan.penalty > 0 ? "bg-rose-soft" : "bg-emerald-soft"
          )}
        >
          <p className={cls("text-micro", plan.penalty > 0 ? "text-rose" : "text-emerald")}>
            {t("planPenalty", { n: plan.unneededCount })}
          </p>
          <p
            className={cls(
              "text-section font-extrabold tabular-nums",
              plan.penalty > 0 ? "text-rose" : "text-emerald"
            )}
          >
            {plan.penalty > 0 ? `−${plan.penalty}` : "0"}{" "}
            <span className="text-note font-bold opacity-80">{t("planPenaltyUnit")}</span>
          </p>
        </div>
      </div>

      {plan.items.length === 0 ? (
        <p className="text-note italic text-ink-dim">{t("planNoOrders")}</p>
      ) : (
        <div className="space-y-1.5">
          {plan.items.map((it, i) => {
            const v = VERDICT[it.verdict];
            return (
              <div key={i} className="flex gap-2">
                <Icon icon={v.icon} size={14} className={cls("mt-0.5 shrink-0", v.tone)} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-baseline gap-2 text-note">
                    <span className="min-w-0 truncate font-bold text-ink-strong">{it.test}</span>
                    {/* Hukm yorlig'i — faqat rangga tayanmaslik uchun (ikonka+rang+matn) */}
                    <span className={cls("shrink-0 text-micro font-bold", v.tone)}>{v.label}</span>
                    <span className={cls("ml-auto shrink-0 text-micro font-bold tabular-nums", v.tone)}>
                      {it.cost} {unit}
                    </span>
                  </p>
                  {it.note && <p className="text-micro leading-relaxed text-ink-dim">{it.note}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {plan.missed.length > 0 && (
        <div className="mt-3 rounded-control border-l-2 border-amber bg-amber-soft px-3 py-2">
          <p className="mb-1 text-micro font-extrabold uppercase tracking-wider text-amber">{t("planMissed")}</p>
          <ul className="space-y-1">
            {plan.missed.map((m, i) => (
              <li key={i} className="text-note leading-relaxed text-ink-strong">
                <span className="font-bold">{m.test}</span>
                {m.why && <span className="text-ink-soft"> — {m.why}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
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

      <div className={cls("grid grid-cols-3 gap-2", ev.examPlan ? "sm:grid-cols-6" : "sm:grid-cols-5")}>
        <ScorePill label={t("anamnesis")} value={ev.anamnesisScore} />
        <ScorePill label={t("examination")} value={ev.examinationScore} />
        {ev.examPlan && <ScorePill label={t("rationality")} value={ev.examPlan.rationalityScore} />}
        <ScorePill label={t("treatment")} value={ev.treatmentScore} />
        <ScorePill label={t("safety")} value={ev.safetyScore} />
        <ScorePill label={t("communication")} value={ev.communicationScore} />
      </div>

      {ev.examPlan && <ExamPlanView plan={ev.examPlan} />}

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

/** Buyurilgan tekshiruv natijasi — chatда alohida (monospace) karta.
 *  ⛔ Tekshiruv shu bemorda ORTIQCHA bo'lsa — karta darrov qizil bo'ladi va
 *  ball tushgani aytiladi (buyurtmachi: "kerakmas tekshiruv buyurganda
 *  ko'rsatkichlari tushsin"). Jazo yakunni kutmaydi — o'sha zahoti ko'rinadi. */
function TestResult({ m, costUnit, penalty }: { m: PatientMsg; costUnit: string; penalty: number }) {
  const { t } = useTranslation(undefined, { keyPrefix: "patient" });
  const [name, ...rest] = m.text.split("\n");
  const waste = m.indicated === false;
  return (
    <div
      className={cls(
        "rounded-card rounded-bl-control border px-3 py-2",
        waste ? "border-rose bg-rose-soft" : "border-line bg-blue-soft"
      )}
    >
      <p
        className={cls(
          "mb-0.5 flex items-center gap-1.5 text-micro font-extrabold uppercase tracking-wider",
          waste ? "text-rose" : "text-blue"
        )}
      >
        <Icon icon={waste ? XCircle : FlaskConical} size={11} />
        <span className="min-w-0 flex-1 truncate">{name}</span>
        {!!m.cost && <span className="shrink-0 font-bold tabular-nums">{m.cost} {costUnit}</span>}
      </p>

      {waste && (
        <p className="mb-1 text-note font-bold text-rose">
          {t("wasteBadge", { n: penalty })}
          {m.reason && <span className="font-medium"> — {m.reason}</span>}
        </p>
      )}

      <p className="whitespace-pre-wrap font-mono text-note leading-relaxed text-ink-strong">{rest.join("\n")}</p>
    </div>
  );
}

// ---- Hayotiy ko'rsatkichlar: me'yordan chetlashish AJRALIB tursin ----
const num = (s: string) => {
  const m = (s || "").match(/-?\d+(?:[.,]\d+)?/);
  return m ? parseFloat(m[0].replace(",", ".")) : NaN;
};

/** Faqat PATOLOGIYA belgilanadi (me'yor — neytral): ekranda shovqin bo'lmasin. */
function vitalAbnormal(kind: keyof PatientVitals, raw: string): boolean {
  if (!raw) return false;
  if (kind === "bp") {
    const [sys, dia] = raw.split("/").map(num);
    if (!Number.isFinite(sys)) return false;
    return sys >= 140 || sys < 90 || (Number.isFinite(dia) && (dia >= 90 || dia < 60));
  }
  const v = num(raw);
  if (!Number.isFinite(v)) return false;
  if (kind === "pulse") return v > 100 || v < 60;
  if (kind === "spo2") return v < 95;
  return v >= 37.5 || v < 35.5; // temp
}

function VitalChip({ label, value, abnormal }: { label: string; value: string; abnormal: boolean }) {
  return (
    <div className={cls("rounded-control px-2 py-1.5", abnormal ? "bg-rose-soft" : "bg-surface-raised")}>
      <p className={cls("text-micro font-bold uppercase tracking-wide", abnormal ? "text-rose" : "text-ink-faint")}>{label}</p>
      <p className={cls("truncate text-note font-extrabold tabular-nums", abnormal ? "text-rose" : "text-ink-strong")} title={value}>
        {value || "—"}
      </p>
    </div>
  );
}

/** O'ng ustundagi bo'lim — bir xil sarlavha uslubi. */
function Section({
  icon,
  title,
  action,
  children,
}: {
  icon: typeof Stethoscope;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-card border border-line p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <Icon icon={icon} size={13} className="text-ink-faint" />
        <p className="text-micro font-extrabold uppercase tracking-wider text-ink-faint">{title}</p>
        {action && <span className="ml-auto flex items-center">{action}</span>}
      </div>
      {children}
    </div>
  );
}

/** Virtual bemor roleplay (Modul 26) — bemor o'zi shikoyat bilan kiradi, talaba
 *  anamnez yig'adi, tekshiruv buyuradi, DDx tuzadi, tashxis qo'yadi; yakunda AI
 *  5 mezon bo'yicha baholaydi. Fokus rejim (rail/chat render bo'lmaydi). */
export function PatientTab({ topicId }: { topicId: number }) {
  const { t } = useTranslation(undefined, { keyPrefix: "patient" });
  const reduce = useReducedMotion();
  const locale = useLocale();
  const lang = locale === "ru" ? ("ru" as const) : ("uz" as const);
  const q = usePatient(topicId);
  const start = useStartPatient(topicId);
  const send = useSendPatient(topicId);
  const finish = useFinishPatient(topicId);
  const reset = useResetPatient(topicId);
  const order = useOrderTest(topicId);
  const vitalsMut = useMeasureVitals(topicId);
  const ddxMut = usePatientDDx(topicId);

  const [draft, setDraft] = useState("");
  const [dx, setDx] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [ddx, setDdx] = useState<DDxItem[]>([]);
  const [customTest, setCustomTest] = useState("");
  /** Baholash xatosi — ilgari mutatsiya jimgina yiqilardi (modal yopilib
   *  ketardi va ekranda hech narsa o'zgarmasdi → "qotib qoldi" taassuroti). */
  const [finishError, setFinishError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoStarted = useRef(false);

  const data = q.data;
  const messages = data?.messages ?? [];
  const chat = useMemo(() => messages.filter((m) => m.role !== "eval"), [messages]);
  const evalMsg = messages.find((m) => m.role === "eval")?.eval ?? null;
  const pending = send.isPending ? (send.variables as string) : null;
  const studentTurns = chat.filter((m) => m.role === "student").length;
  // Buyurilgan testlar: nomi → ko'rsatma bormidi (undefined = eski yozuv).
  // Ortiqchasi katalogda ham QIZIL turadi — yashil "bajarildi" bo'lib ko'rinsa
  // ekran o'zini o'zi inkor qilardi (§4 bitta fakt — bitta ma'no).
  const orderedTests = useMemo(
    () =>
      new Map(
        messages
          .filter((m) => m.role === "test")
          .map((m) => [m.text.split("\n")[0], m.indicated] as const)
      ),
    [messages]
  );
  const vitals = data?.vitals ?? null;
  const testCount = orderedTests.size;
  // Bosqichlar: anamnez / tekshiruv / differensial / tashxis.
  const completedSteps = [studentTurns >= 3, testCount > 0, ddx.length > 0, dx.trim().length > 0];
  const currentStep = completedSteps.findIndex((c) => !c);
  const stepCounts = [
    studentTurns ? t("countQuestions", { n: studentTurns }) : "",
    testCount ? t("countTests", { n: testCount }) : "",
    ddx.length ? t("countDdx", { n: ddx.length }) : "",
    "",
  ];

  const suggests = t("suggests", { returnObjects: true }) as string[];
  // Katalog va narx — serverdan (yagona manba; erkin buyurtma narxi ham o'sha
  // yerda hisoblanadi). Byudjet QAT'IY qulf emas — ogohlantirish.
  const catalog = data?.catalog ?? [];
  const spent = data?.spent ?? 0;
  const overBudget = spent > (data?.budgetSoft ?? Infinity);
  // Jonli tekshiruv balli — har ortiqcha tekshiruv uni darrov tushiradi.
  const examScore = data?.examScore ?? 100;
  const unneeded = data?.unneededCount ?? 0;
  const penaltyPerTest = data?.penaltyPerTest ?? 0;
  const scoreTone = examScore >= 85 ? "text-emerald" : examScore >= 60 ? "text-amber" : "text-rose";

  const refreshDdx = () => ddxMut.mutate(undefined, { onSuccess: (r) => setDdx(r.ddx) });

  const doReset = () =>
    reset.mutate(undefined, {
      onSuccess: () => {
        autoStarted.current = false; // yangi bemor ham o'zi gapirib boshlasin
        setDdx([]);
        setDx("");
        setDraft("");
      },
    });

  // Qabulni boshlash: bemor BIRINCHI bo'lib shikoyatini aytadi (bo'sh ekran emas).
  useEffect(() => {
    if (!data || !data.available || data.started || data.finished) return;
    if (autoStarted.current || start.isPending) return;
    autoStarted.current = true;
    start.mutate();
  }, [data, start]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [chat.length, pending, start.isPending, reduce]);

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
        <EvalView ev={evalMsg} onReset={doReset} />
      </div>
    );
  }

  const submit = (textRaw?: string) => {
    const text = (textRaw ?? draft).trim();
    if (!text || send.isPending || finish.isPending || start.isPending) return;
    send.mutate(text);
    setDraft("");
  };

  const orderTest = (name: string) => order.mutate(name, { onSuccess: () => refreshDdx() });

  const busy = start.isPending || send.isPending;
  /** Suhbat/tekshiruv amallari ham jimgina yiqilardi — endi bitta xato qatori. */
  const actionError = apiErrorMessage(
    send.error ?? start.error ?? order.error ?? vitalsMut.error ?? null,
    lang
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-3">
      {/* ── CHAP: bemor + suhbat + kirish ── */}
      <div className="flex min-h-0 flex-col">
        {/* Bemor kartasi + "Yangi bemor" */}
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
              onClick={doReset}
              disabled={reset.isPending}
              title={t("newPatient")}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-control border border-line px-2.5 py-1.5 text-micro font-bold text-ink-soft transition-colors hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-40"
            >
              {reset.isPending ? <Spinner size={12} /> : <Icon icon={RotateCcw} size={13} />}
              {t("newPatient")}
            </button>
          )}
        </div>

        {/* AI-simulyatsiya yorlig'i (rasmiy ma'lumotnoma emas) */}
        <div className="mb-2 flex shrink-0 items-center gap-1.5 rounded-control bg-blue-soft px-2.5 py-1.5 text-micro text-blue">
          <Icon icon={Sparkles} size={12} className="shrink-0" />
          <span className="min-w-0">{t("simNote")}</span>
        </div>

        {/* Suhbat */}
        <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {chat.length === 0 && start.isPending ? (
            // Bemor kabinetga kirmoqda — bo'sh ekran o'rniga jonli kutish.
            <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-card bg-rose-soft text-rose">
                <Icon icon={User} size={22} />
              </div>
              <p className="text-note font-bold text-ink-soft">{t("startingTitle")}</p>
              <p className="max-w-[320px] text-micro leading-relaxed text-ink-dim">{t("startingHint")}</p>
              <Typing reduce={reduce} />
            </div>
          ) : chat.length === 0 ? (
            // Boshlanmadi (xato yoki hali chaqirilmagan) — qo'lda boshlash.
            <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-card bg-rose-soft text-rose">
                <Icon icon={Stethoscope} size={22} />
              </div>
              <p className="text-note font-bold text-ink-soft">{start.isError ? t("startError") : t("startTitle")}</p>
              <p className="max-w-[320px] text-micro leading-relaxed text-ink-dim">{t("startHint")}</p>
              <Button variant="primary" size="sm" onClick={() => start.mutate()}>
                {t("startBtn")}
              </Button>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {chat.map((m) =>
                m.role === "test" ? (
                  <TestResult key={m.id} m={m} costUnit={t("costUnit")} penalty={penaltyPerTest} />
                ) : (
                  <Bubble key={m.id} m={m} animate={!reduce} />
                )
              )}
              {pending && (
                <div key="pending" className="space-y-2">
                  <Bubble key="p-mine" m={{ id: -1, role: "student", text: pending, createdAt: "" }} animate={!reduce} />
                  <Typing reduce={reduce} />
                </div>
              )}
              {(order.isPending || vitalsMut.isPending) && (
                <div key="ordering" className="flex items-center gap-2 rounded-control bg-surface-raised px-3 py-2 text-micro text-ink-dim">
                  <Spinner size={12} />
                  {t("orderRunning")}
                </div>
              )}
            </AnimatePresence>
          )}
        </div>

        {/* Kirish + tez savollar + yakunlash */}
        <div className="mt-2 shrink-0 space-y-2">
          {/* Tez savollar — anamnez boshida yo'l ko'rsatadi (AI chaqiruvisiz) */}
          {chat.length > 0 && studentTurns < 4 && !busy && (
            <div className="flex flex-wrap gap-1.5">
              {suggests.slice(0, 4).map((s) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  className="rounded-pill border border-line px-2.5 py-1 text-micro font-medium text-ink-soft transition-colors hover:border-brand hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

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
              disabled={!draft.trim() || busy}
              aria-label={t("ask")}
              className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-control bg-brand text-white transition-[background-color,transform] duration-150 hover:bg-brand-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand active:scale-95 disabled:opacity-40"
            >
              {send.isPending ? <Spinner size={14} /> : <Icon icon={SendHorizontal} size={16} />}
            </button>
          </form>

          {actionError && (
            <p className="mb-2 flex items-start gap-2 rounded-control bg-rose-soft px-3 py-2 text-note font-bold text-rose">
              <Icon icon={TriangleAlert} size={14} className="mt-0.5 shrink-0" />
              {actionError}
            </p>
          )}

          <button
            onClick={() => setConfirm(true)}
            disabled={studentTurns === 0 || finish.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-control bg-emerald px-4 py-2.5 text-body font-extrabold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-40"
          >
            {finish.isPending ? <Spinner size={15} /> : <Icon icon={Stethoscope} size={16} />}
            {t("finishBtn")}
          </button>
        </div>
      </div>

      {/* ── O'NG: klinik ish stoli — bemor kartasi / bosqichlar / DDx / tekshiruvlar ── */}
      <div className="flex min-h-0 flex-col gap-2 overflow-y-auto lg:pr-1">
        {/* Bemor kartasi: hayotiy ko'rsatkichlar (o'lchagach ochiladi) */}
        <Section icon={HeartPulse} title={t("chartTitle")}>
          {vitals ? (
            <div className="grid grid-cols-2 gap-1.5">
              <VitalChip label={t("vitalsBp")} value={vitals.bp} abnormal={vitalAbnormal("bp", vitals.bp)} />
              <VitalChip label={t("vitalsPulse")} value={vitals.pulse} abnormal={vitalAbnormal("pulse", vitals.pulse)} />
              <VitalChip label={t("vitalsSpo2")} value={vitals.spo2} abnormal={vitalAbnormal("spo2", vitals.spo2)} />
              <VitalChip label={t("vitalsTemp")} value={vitals.temp} abnormal={vitalAbnormal("temp", vitals.temp)} />
            </div>
          ) : (
            <>
              <p className="mb-2 text-micro leading-relaxed text-ink-dim">{t("vitalsHint")}</p>
              <button
                onClick={() => vitalsMut.mutate(undefined, { onSuccess: () => refreshDdx() })}
                disabled={vitalsMut.isPending || !data?.started}
                className="flex w-full items-center justify-center gap-1.5 rounded-control border border-line px-2.5 py-2 text-micro font-bold text-ink-soft transition-colors hover:border-brand hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-40"
              >
                {vitalsMut.isPending ? <Spinner size={12} /> : <Icon icon={HeartPulse} size={13} />}
                {t("vitalsMeasure")}
              </button>
            </>
          )}
        </Section>

        {/* Bosqichlar — har biriga hisob, joriysi ajratilgan */}
        <Section icon={Activity} title={t("steps")}>
          <div className="space-y-1.5">
            {STEP_KEYS.map((k, i) => (
              <div key={k} className="flex items-center gap-2 text-note">
                <span
                  className={cls(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                    completedSteps[i] ? "text-emerald" : i === currentStep ? "border border-brand" : "border border-line"
                  )}
                >
                  {completedSteps[i] ? (
                    <Icon icon={Check} size={12} strokeWidth={3} />
                  ) : i === currentStep ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                  ) : null}
                </span>
                <span
                  className={cls(
                    "min-w-0 flex-1 truncate",
                    completedSteps[i] ? "text-ink-soft" : i === currentStep ? "font-bold text-ink" : "text-ink-dim"
                  )}
                >
                  {t(k)}
                </span>
                {stepCounts[i] && <span className="shrink-0 text-micro tabular-nums text-ink-faint">{stepCounts[i]}</span>}
              </div>
            ))}
          </div>
        </Section>

        {/* Differensial tashxis (DDx) */}
        <Section
          icon={Stethoscope}
          title={t("ddxTitle")}
          action={
            <button
              onClick={refreshDdx}
              disabled={ddxMut.isPending || studentTurns === 0}
              title={t("ddxRefresh")}
              className="text-ink-faint transition-colors hover:text-brand disabled:opacity-30"
            >
              <Icon icon={ddxMut.isPending ? Loader2 : RefreshCw} size={13} className={ddxMut.isPending ? "animate-spin" : ""} />
            </button>
          }
        >
          {ddx.length === 0 ? (
            <p className="text-micro italic text-ink-dim">{studentTurns === 0 ? t("ddxEmpty") : t("ddxHint")}</p>
          ) : (
            <div className="space-y-2">
              {ddx.map((d, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-micro">
                    <span className="min-w-0 flex-1 truncate font-bold text-ink" title={d.diagnosis}>
                      {i + 1}. {d.diagnosis}
                    </span>
                    <span
                      className={cls(
                        "shrink-0 font-bold tabular-nums",
                        d.probability >= 60 ? "text-rose" : d.probability >= 35 ? "text-amber" : "text-ink-faint"
                      )}
                    >
                      {d.probability}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-pill bg-surface-raised">
                    <div
                      className={cls("h-full rounded-pill", d.probability >= 60 ? "bg-rose" : d.probability >= 35 ? "bg-amber" : "bg-ink-faint")}
                      style={{ width: `${Math.max(d.probability, 2)}%` }}
                    />
                  </div>
                  {d.keyFinding && (
                    <p className="truncate text-micro italic text-ink-dim" title={d.keyFinding}>
                      {d.keyFinding}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Tekshiruv buyurish — narxi bilan katalog + erkin buyurtma.
            Real hayotda har tahlil bemorning puliga tushadi: talaba "hammasini
            bosib chiqmasin", kerakligini tanlasin (yakunda reja baholanadi). */}
        <Section
          icon={FlaskConical}
          title={t("ordersTitle")}
          action={
            // ASOSIY ko'rsatkich — ortiqcha tekshiruv buyurilsa shu raqam tushadi.
            <span className={cls("text-section font-extrabold tabular-nums", scoreTone)} title={t("examScoreTitle")}>
              {examScore}
            </span>
          }
        >
          <p className="mb-1 text-micro leading-relaxed text-ink-dim">
            {overBudget ? t("budgetWarn") : t("costHint")}
          </p>
          <p className="mb-2 flex flex-wrap items-center gap-x-2 text-micro">
            <span className={cls("tabular-nums", overBudget ? "font-bold text-amber" : "text-ink-faint")}>
              {t("spentLine", { n: spent, unit: t("costUnit") })}
            </span>
            {unneeded > 0 && (
              <span className="font-bold tabular-nums text-rose">
                {t("wasteLine", { n: unneeded, p: unneeded * penaltyPerTest })}
              </span>
            )}
          </p>
          {[
            { label: t("orderLab"), items: catalog.filter((c) => c.group === "lab") },
            { label: t("orderInstr"), items: catalog.filter((c) => c.group === "instr") },
          ].map((group) => (
            <div key={group.label} className="mb-2 last:mb-0">
              <p className="mb-1 text-micro font-bold text-ink-dim">{group.label}</p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const done = orderedTests.has(item.name);
                  const waste = orderedTests.get(item.name) === false;
                  const running = order.isPending && (order.variables as string) === item.name;
                  const tone = waste ? "text-rose" : done ? "text-emerald" : "text-ink-faint";
                  return (
                    <button
                      key={item.name}
                      onClick={() => orderTest(item.name)}
                      disabled={done || order.isPending || !data?.started}
                      title={`${item.name} — ${item.cost} ${t("costUnit")}`}
                      className={cls(
                        "flex w-full items-center gap-1.5 rounded-control border px-2 py-1.5 text-left text-micro font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                        waste
                          ? "border-line bg-rose-soft text-rose"
                          : done
                            ? "border-line bg-emerald-soft text-emerald"
                            : "border-line text-ink-soft hover:border-brand hover:text-brand disabled:opacity-50"
                      )}
                    >
                      <Icon
                        icon={waste ? XCircle : done ? CheckCircle2 : running ? Loader2 : FlaskConical}
                        size={12}
                        className={cls("shrink-0", running && "animate-spin")}
                      />
                      <span className="min-w-0 flex-1 truncate">{item.name}</span>
                      <span className={cls("shrink-0 tabular-nums", tone)}>{item.cost}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <form
            className="mt-2 flex items-center gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              const name = customTest.trim();
              if (!name || order.isPending) return;
              orderTest(name);
              setCustomTest("");
            }}
          >
            <input
              value={customTest}
              onChange={(e) => setCustomTest(e.target.value)}
              placeholder={t("orderCustom")}
              maxLength={120}
              className="min-w-0 flex-1 rounded-control border border-line bg-surface px-2.5 py-1.5 text-micro text-ink outline-none transition-colors placeholder:text-ink-dim focus:border-brand"
            />
            <button
              type="submit"
              disabled={!customTest.trim() || order.isPending || !data?.started}
              className="shrink-0 rounded-control border border-line px-2.5 py-1.5 text-micro font-bold text-ink-soft transition-colors hover:border-brand hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-40"
            >
              {t("orderCustomBtn")}
            </button>
          </form>
        </Section>
      </div>

      {/* Tashxis kiritish modali */}
      <Modal open={confirm} onClose={() => !finish.isPending && setConfirm(false)} title={t("dxTitle")}>
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
        {/* Baholash ~5-10 soniya oladi — modal YOPILMAYDI, holat shu yerda
            ko'rinadi (ilgari modal darrov yopilib, ekranda hech nima
            o'zgarmasdi va foydalanuvchi "qotib qoldi" deb o'ylardi). */}
        {finish.isPending && (
          <p className="mt-3 flex items-center gap-2 rounded-control bg-brand-soft px-3 py-2 text-note font-bold text-brand-tint">
            <Spinner size={14} />
            {t("evaluating")}
          </p>
        )}
        {finishError && (
          <p className="mt-3 flex items-start gap-2 rounded-control bg-rose-soft px-3 py-2 text-note font-bold text-rose">
            <Icon icon={TriangleAlert} size={14} className="mt-0.5 shrink-0" />
            {finishError}
          </p>
        )}

        <div className="mt-3 flex justify-end gap-2">
          <Button variant="ghost" size="md" onClick={() => setConfirm(false)} disabled={finish.isPending}>
            {t("cancel")}
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => {
              setFinishError(null);
              finish.mutate(dx.trim(), {
                onSuccess: () => setConfirm(false),
                onError: (e) => setFinishError(apiErrorMessage(e, lang) ?? t("finishError")),
              });
            }}
            disabled={finish.isPending}
          >
            {finish.isPending ? t("evaluatingShort") : t("submitDx")}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
