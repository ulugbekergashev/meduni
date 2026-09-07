import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useReducedMotion } from "framer-motion";
import { createScope, createTimeline, stagger, type Scope } from "animejs";
import {
  ArrowRight,
  BookText,
  Check,
  ClipboardList,
  Lock,
  PartyPopper,
  Sparkles,
  Stethoscope,
  TriangleAlert,
  X,
} from "lucide-react";
import { Icon, ProgressRing, cls } from "@meduni/ui";
import { useLocale } from "../../../lib/useLocale";
import { useAttempt, useFlashcards, type Lesson, type Requirement } from "../api";
import { finalScore, type LessonView } from "./stages";

/** "Nima qoldi" qatori — dvigatel talabi turiga qarab ikonka va yuza. */
const REQ_ICON: Record<string, typeof ClipboardList> = {
  video: BookText,
  quiz: ClipboardList,
  case: Stethoscope,
  date: Lock,
};
const REQ_VIEW: Record<string, LessonView> = {
  video: "video",
  quiz: "quiz",
  case: "case",
};

function Row({
  icon,
  tone,
  label,
  value,
  onClick,
}: {
  icon: typeof ClipboardList;
  tone: string;
  label: string;
  value: string;
  onClick?: () => void;
}) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      onClick={onClick}
      data-anim="row"
      className={cls(
        "flex w-full items-center gap-2.5 border-b border-line px-3 py-2.5 text-left last:border-b-0",
        onClick &&
          "transition-colors hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      )}
    >
      <div className={cls("flex h-7 w-7 shrink-0 items-center justify-center rounded-control", tone)}>
        <Icon icon={icon} size={14} />
      </div>
      <span className="min-w-0 flex-1 truncate text-note font-bold text-ink">{label}</span>
      <span className="shrink-0 text-note font-extrabold tabular-nums text-ink">{value}</span>
    </Wrapper>
  );
}

/** Natija ekranining kirish xoreografiyasi — anime.js timeline (v4 `createScope`).
 *  Bitta timeline bir nechta TURLI nishonni ketma-ket boshqaradi: halqa qiymati
 *  (React state orqali), so'ng yakun qatorlari stagger bilan. Shu sababdan
 *  bu yerda deklarativ per-komponent animatsiya emas, imperativ timeline. */
function useResultIntro(target: number, enabled: boolean) {
  const root = useRef<HTMLDivElement>(null);
  const scope = useRef<Scope | null>(null);
  const reduce = useReducedMotion();
  const [ringValue, setRingValue] = useState(reduce || !enabled ? target : 0);

  useEffect(() => {
    if (reduce || !enabled) {
      setRingValue(target);
      return;
    }
    if (!root.current) return;

    const counter = { v: 0 };
    scope.current = createScope({ root }).add(() => {
      createTimeline()
        // Halqa 0 dan yakuniy ballgacha "o'sadi" (raqam ham u bilan sanaladi).
        .add(
          counter,
          {
            v: target,
            duration: 900,
            ease: "outExpo",
            onUpdate: () => setRingValue(Math.round(counter.v)),
          },
          150
        )
        .add('[data-anim="row"]', { opacity: [0, 1], y: [10, 0], duration: 380, ease: "outQuad", delay: stagger(60) }, 300);
    });

    return () => {
      scope.current?.revert();
    };
  }, [target, enabled, reduce]);

  return { root, ringValue };
}

/** 1e — shu dars bo'yicha yakuniy natija (foydalanuvchi: "в самом конце все
 *  результаты именно за этот урок"). */
export function ResultPanel({ lesson, onView }: { lesson: Lesson; onView?: (v: LessonView) => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "lesson" });
  const navigate = useNavigate();
  const locale = useLocale();
  /** Dvigatel sabablari uz/ru juftligida keladi (i18n kaliti emas — matn). */
  const pick = (r: Requirement | null | undefined) => (r ? (locale === "ru" ? r.ru : r.uz) : "");
  const fs = finalScore(lesson);
  const hasScore = fs.value !== null;

  const quiz = lesson.tabs.quiz;
  const finishedId = quiz?.attempt?.status === "finished" ? quiz.attempt.id : null;
  const attemptQ = useAttempt(finishedId);
  const cardsQ = useFlashcards(lesson.topicId);

  const sections = lesson.sections ?? [];
  const readCount = sections.filter((s) => s.read).length;
  const passed = quiz?.attempt?.passed ?? null;

  // Xato javoblar — qayta o'qish uchun (savol manbasi bilan).
  // ⚠️ `stale` — test urinishdan keyin qayta yaratilgan: javoblar endi boshqa
  // savollarga tegishli, ya'ni "xato javoblar" ro'yxati YOLG'ON bo'lardi
  // (barcha savol xato ko'rinardi). Bunday holatda tahlil ko'rsatilmaydi.
  const staleAttempt = attemptQ.data?.stale === true;
  const wrong = staleAttempt
    ? []
    : (attemptQ.data?.questions ?? []).filter(
        (q) => q.correctIndex !== undefined && q.studentAnswer !== q.correctIndex
      );

  // ⚠️ QOLGAN TALABLAR — BACKEND DVIGATELIDAN (2026-08-06). Ilgari bu ro'yxat
  // `buildStages` dan, ya'ni UI taxminidan qurilardi va dvigatel bilan
  // ZIDDIYATGA tushardi: testni "o'tgan" (67 ≥ 60 — testning o'z balli) talaba
  // ekranda "test bajarildi" ni ko'rardi, mavzu esa ochilish qoidasi (70%)
  // sababli yopiq qolardi — va sabab hech qayerda yozilmasdi. Endi ro'yxat
  // mavzuni haqiqatan yopib turgan shartlardan iborat.
  const todo = lesson.requirements ?? [];

  const next = lesson.nextTopic;
  const nextOpen = !!next && next.state !== "LOCKED";
  const cards = cardsQ.data;

  const { root, ringValue } = useResultIntro(fs.value ?? 0, hasScore);

  return (
    <div ref={root} className="mx-auto max-w-[520px] space-y-3">
      {/* Yakuniy ball */}
      <div className="flex flex-col items-center gap-2 rounded-card border border-line bg-surface-raised p-5 text-center">
        {hasScore ? (
          <>
            <ProgressRing value={ringValue} size={96} stroke={10} tone={passed === false ? "rose" : "brand"} />
            <p className="text-section font-extrabold text-ink">{t("finalScore")}</p>
            {passed !== null && (
              <span
                className={cls(
                  "rounded-pill px-3 py-0.5 text-note font-extrabold",
                  passed ? "bg-emerald-soft text-emerald" : "bg-rose-soft text-rose"
                )}
              >
                {passed ? t("passedMsg") : t("failedMsg")}
              </span>
            )}
            {fs.pendingCase && (
              <p className="inline-flex items-center gap-1.5 rounded-control bg-amber-soft px-3 py-1 text-micro font-bold text-amber">
                <Icon icon={TriangleAlert} size={12} />
                {t("finalPendingCase")}
              </p>
            )}
          </>
        ) : (
          <>
            <div className="flex h-14 w-14 items-center justify-center rounded-card bg-emerald-soft text-emerald">
              <Icon icon={PartyPopper} size={26} />
            </div>
            <p className="text-section font-extrabold text-ink">{t("contentOnlyDone")}</p>
            <p className="text-note text-ink-dim">{t("finalNoScore")}</p>
          </>
        )}
      </div>

      {/* Dars bo'yicha yakun */}
      <div className="overflow-hidden rounded-card border border-line">
        {sections.length > 0 && (
          <Row
            icon={BookText}
            tone="bg-brand-soft text-brand-tint"
            label={t("stage_study")}
            value={`${readCount}/${sections.length}`}
            onClick={onView ? () => onView("konspekt") : undefined}
          />
        )}
        {quiz?.attempt?.status === "finished" && (
          <Row
            icon={ClipboardList}
            tone="bg-blue-soft text-blue"
            label={t("stage_quiz")}
            value={
              attemptQ.data?.correctCount != null
                ? `${attemptQ.data.correctCount}/${attemptQ.data.total} · ${quiz.attempt.scorePct}%`
                : `${quiz.attempt.scorePct}%`
            }
            onClick={onView ? () => onView("quiz") : undefined}
          />
        )}
        {lesson.tabs.case?.attempt && (
          <Row
            icon={Stethoscope}
            tone="bg-rose-soft text-rose"
            label={t("stage_case")}
            value={
              lesson.tabs.case.attempt.reviewed
                ? String(lesson.tabs.case.attempt.score ?? "—")
                : t("stagePending")
            }
            onClick={onView ? () => onView("case") : undefined}
          />
        )}
        {cards && !cards.locked && cards.total > 0 && (
          <Row
            icon={Sparkles}
            tone="bg-violet-soft text-violet"
            label={t("stage_flashcards")}
            value={`${cards.knownCount}/${cards.total}`}
            onClick={onView ? () => onView("flashcards") : undefined}
          />
        )}
      </div>

      {/* ⚠️ NIMA QOLDI (2026-08-03, buyurtmachi: "75% yechgan bo'lsam ham
          keyingisini ko'rsatmayapdi"). Talaba testni topshirgach mavzu
          tugagandek his qilardi, lekin keyingi mavzu ochilmasdi va SABABI
          hech qayerda ko'rinmasdi. Endi u aynan shu yerda, tugmasi bilan. */}
      {!lesson.completed && todo.length > 0 && (
        <div className="rounded-card border border-amber/40 bg-amber-soft/40 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-micro font-extrabold text-amber">
            <Icon icon={TriangleAlert} size={12} />
            {t("todoTitle")}
          </p>
          <div className="space-y-1.5">
            {todo.map((req, i) => {
              // `blocked` — talaba o'zi hal qila olmaydi (urinishlar tugagan,
              // keys tekshiruvda): tugma emas, izoh qatori bo'lib turadi.
              const view = req.key ? REQ_VIEW[req.key] : undefined;
              const clickable = !req.blocked && !!view && !!onView;
              const Wrap = clickable ? "button" : "div";
              return (
                <Wrap
                  key={`${req.key ?? "r"}-${i}`}
                  onClick={clickable ? () => onView!(view!) : undefined}
                  className={cls(
                    "flex w-full items-center gap-2.5 rounded-control px-3 py-2 text-left",
                    clickable
                      ? "bg-surface transition-colors hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                      : "bg-surface"
                  )}
                >
                  <span
                    className={cls(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-control",
                      req.blocked ? "bg-rose-soft text-rose" : "bg-amber-soft text-amber"
                    )}
                  >
                    <Icon icon={req.blocked ? Lock : REQ_ICON[req.key ?? "date"] ?? ClipboardList} size={13} />
                  </span>
                  <span className="min-w-0 flex-1 text-note font-bold leading-snug text-ink">{pick(req)}</span>
                  {clickable && <Icon icon={ArrowRight} size={13} className="shrink-0 text-ink-dim" />}
                </Wrap>
              );
            })}
          </div>
        </div>
      )}

      {/* Xato javoblar tahlili */}
      {wrong.length > 0 && (
        <div className="rounded-card border border-line p-3">
          <p className="mb-2 flex items-center gap-1.5 text-micro font-extrabold text-ink-dim">
            <Icon icon={X} size={12} className="text-rose" strokeWidth={3} />
            {t("errorAnalysis", { count: wrong.length })}
          </p>
          <div className="space-y-2">
            {wrong.map((q) => (
              <div key={q.id} className="rounded-control bg-surface-raised p-2.5">
                <p className="text-note font-bold leading-snug text-ink">{q.text}</p>
                <p className="mt-1 text-micro text-ink-dim">
                  <span className="text-rose">{q.options[q.studentAnswer ?? -1] ?? t("noAnswer")}</span>
                  {" · "}
                  <span className="font-bold text-emerald">{q.options[q.correctIndex ?? 0]}</span>
                </p>
                {q.sourceFragment && (
                  <p className="mt-1 border-l-2 border-line pl-2 text-micro italic text-ink-dim">{q.sourceFragment}</p>
                )}
              </div>
            ))}
          </div>
          {onView && (
            <button
              onClick={() => onView("konspekt")}
              className="mt-2 inline-flex items-center gap-1.5 text-micro font-bold text-brand-tint hover:underline"
            >
              {t("rereadKonspekt")}
              <Icon icon={ArrowRight} size={12} />
            </button>
          )}
        </div>
      )}

      {/* Takrorlash taklifi */}
      {cards && !cards.locked && cards.knownCount < cards.total && onView && (
        <button
          onClick={() => onView("flashcards")}
          className="flex w-full items-center gap-2.5 rounded-card border border-line bg-surface-raised p-3 text-left transition-colors hover:border-brand-soft"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-violet-soft text-violet">
            <Icon icon={Sparkles} size={15} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-note font-bold text-ink">{t("repeatTitle")}</p>
            <p className="text-micro text-ink-dim">
              {t("repeatHint", { n: cards.total - cards.knownCount })}
            </p>
          </div>
          <Icon icon={ArrowRight} size={14} className="shrink-0 text-ink-dim" />
        </button>
      )}

      {/* Keyingi mavzu */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate(`/app/courses/${lesson.courseId}`)}
          className="rounded-control border border-line px-3 py-2 text-note font-bold text-ink-soft transition-colors hover:bg-surface-raised hover:text-ink"
        >
          {t("backToPath")}
        </button>
        {next && nextOpen && (
          <button
            onClick={() => navigate(`/app/topics/${next.id}`)}
            className="ml-auto inline-flex items-center gap-2 rounded-control bg-brand px-4 py-2 text-note font-extrabold text-white transition-colors hover:bg-brand-deep"
          >
            {t("nextTopicBtn")}
            <Icon icon={ArrowRight} size={14} />
          </button>
        )}
      </div>

      {/* Keyingi mavzu QULF bo'lsa — nega ochilmagani shu yerda yoziladi.
          Ilgari faqat kulrang chip va mavzu nomi turardi: talaba "keyingi dars
          ochilmayapti" deb qolardi va sababini hech qayerdan bilolmasdi. */}
      {next && !nextOpen && (
        <div className="flex items-start gap-2.5 rounded-card border border-line bg-surface-raised px-3 py-2.5">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-control bg-surface text-ink-dim">
            <Icon icon={Lock} size={13} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-note font-bold text-ink">{next.title}</p>
            <p className="text-micro leading-relaxed text-ink-dim">
              {pick(next.reason) || t("nextLockedFallback")}
            </p>
          </div>
        </div>
      )}

      {/* Mavzu tugagani */}
      {lesson.completed && (
        <p className="flex items-center justify-center gap-1.5 text-micro font-bold text-emerald">
          <Icon icon={Check} size={12} strokeWidth={3} />
          {t("topicDone")}
        </p>
      )}
    </div>
  );
}
