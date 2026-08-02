import { useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  FileStack,
  Rocket,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Badge, Button, Card, Icon, Spinner, cls } from "@meduni/ui";
import { MaterialsSection } from "./MaterialsSection";
import { DigestSection } from "./DigestSection";
import { GenerateSection } from "./GenerateSection";
import { PublishSection } from "./PublishSection";
import { TopicUnlockRule } from "./TopicUnlockRule";
import { useTopicDetail, type TopicDetail } from "./api";
import { useTeachCourses } from "../api";
import { Disclosure } from "../../../components/Disclosure";

type StepKey = "material" | "digest" | "generate" | "publish";
type StepState = "done" | "current" | "locked";

const STEP_ORDER: StepKey[] = ["material", "digest", "generate", "publish"];
const STEP_ICON: Record<StepKey, LucideIcon> = {
  material: FileStack,
  digest: BookOpen,
  generate: Sparkles,
  publish: Rocket,
};
// "material" step title lives under sections.materials (plural); others match.
const SECTION_KEY: Record<StepKey, string> = {
  material: "materials",
  digest: "digest",
  generate: "generate",
  publish: "publish",
};

/** Availability + completion per step — reuses the same gating booleans as before. */
function computeSteps(topic: TopicDetail) {
  const materialDone = topic.digestUnlocked;
  const digestApproved = topic.generateUnlocked;
  const hasContent = topic.content.length > 0;
  const anyPublished = topic.content.some((c) => c.status === "published");

  const available: Record<StepKey, boolean> = {
    material: true,
    digest: materialDone,
    generate: digestApproved,
    publish: hasContent,
  };
  const done: Record<StepKey, boolean> = {
    material: materialDone,
    digest: digestApproved,
    generate: hasContent,
    publish: anyPublished,
  };
  return { available, done };
}

function stateOf(key: StepKey, available: Record<StepKey, boolean>, done: Record<StepKey, boolean>): StepState {
  if (done[key]) return "done";
  if (available[key]) return "current";
  return "locked";
}

export function TopicConstructor() {
  const { id } = useParams();
  const topicId = Number(id);
  const { t } = useTranslation(undefined, { keyPrefix: "constructor" });
  const { t: tt } = useTranslation(undefined, { keyPrefix: "topics" });
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const detail = useTopicDetail(topicId);
  // Breadcrumb uchun kurs nomi — ro'yxat allaqachon keshda (dashboard/kurslar).
  const courses = useTeachCourses();

  // Derived step state (safe defaults while loading so hooks run unconditionally).
  const topic = detail.data;
  const courseName = courses.data?.find((x) => x.id === topic?.courseId)?.subjectName;
  const { available, done } = topic
    ? computeSteps(topic)
    : { available: {} as Record<StepKey, boolean>, done: {} as Record<StepKey, boolean> };

  const firstIncomplete = STEP_ORDER.find((k) => available[k] && !done[k]) ?? STEP_ORDER[0];
  const requested = params.get("step") as StepKey | null;
  const active: StepKey =
    requested && STEP_ORDER.includes(requested) && available[requested] ? requested : firstIncomplete;

  // Keep the URL in sync with the resolved active step (invalid/locked → normalize).
  const activeParam = params.get("step");
  useEffect(() => {
    if (topic && activeParam !== active) {
      const p = new URLSearchParams(params);
      p.set("step", active);
      setParams(p, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeParam, active, !!topic]);

  if (detail.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner size={28} />
      </div>
    );
  }
  if (detail.isError || !topic) {
    return (
      <div>
        <button onClick={() => navigate("/teach")} className="text-body font-medium text-brand-deep hover:underline">
          {t("back")}
        </button>
        <Card className="mt-4">
          <p className="py-6 text-center text-body text-rose">{tt("empty")}</p>
        </Card>
      </div>
    );
  }

  const go = (step: StepKey) => {
    if (!available[step]) return;
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set("step", step);
        return p;
      },
      { replace: false }
    );
  };

  const activeIdx = STEP_ORDER.indexOf(active);
  const prevStep = activeIdx > 0 ? STEP_ORDER[activeIdx - 1] : null;
  const nextStep = activeIdx < STEP_ORDER.length - 1 ? STEP_ORDER[activeIdx + 1] : null;

  return (
    <div>
      {/* Breadcrumb — konstruktor kurs qobig'idan TASHQARIDA turadi (App.tsx),
          ya'ni kurs SubNav paneli yo'qoladi. Quruq "← Orqaga" o'rniga kontekst:
          o'qituvchi qaysi kursning qaysi mavzusida turganini ko'radi. */}
      <nav className="flex flex-wrap items-center gap-1.5 text-note text-ink-faint">
        <button
          onClick={() => navigate(topic.courseId ? `/teach/courses/${topic.courseId}/topics` : "/teach")}
          className="font-semibold text-brand-deep hover:underline"
        >
          {courseName ?? t("back")}
        </button>
        <span>/</span>
        <span className="min-w-0 truncate font-medium text-ink-soft">{topic.title}</span>
      </nav>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h1 font-bold text-ink">{topic.title}</h1>
        </div>
        <Badge tone={topic.status === "published" ? "emerald" : "slate"}>{tt(`status.${topic.status}`)}</Badge>
      </div>

      {/* Sticky stepper — one glance at where you are; click an unlocked step to jump. */}
      {/* --header-h: doimiy header balandligi (tokens.css). Ilgari 57px qo'lda
          yozilgan edi va header 64px ga o'zgarganda 7px bo'shliq qolgandi. */}
      <div className="sticky top-[var(--header-h)] z-20 mt-5 border-b border-line bg-bg py-3">
        <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {STEP_ORDER.map((key, i) => {
            const st = stateOf(key, available, done);
            const isActive = key === active;
            const clickable = available[key];
            return (
              <div key={key} className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={() => go(key)}
                  className={cls(
                    "flex items-center gap-2 rounded-control px-2 py-1 transition-colors",
                    clickable ? "hover:bg-surface" : "cursor-not-allowed",
                    isActive && "bg-surface ring-1 ring-brand/40"
                  )}
                >
                  <span
                    className={cls(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold",
                      st === "done" && "bg-emerald text-white",
                      st === "current" && (isActive ? "bg-brand text-white" : "border border-brand text-brand"),
                      st === "locked" && "bg-bg text-ink-faint"
                    )}
                  >
                    {st === "done" ? <Icon icon={Check} size={15} /> : i + 1}
                  </span>
                  <span
                    className={cls(
                      "whitespace-nowrap text-body",
                      st === "locked"
                        ? "text-ink-faint"
                        : isActive
                          ? "font-semibold text-ink"
                          : "font-medium text-ink-soft"
                    )}
                  >
                    {t(`steps.${key}`)}
                  </span>
                </button>
                {i < STEP_ORDER.length - 1 && <span className="h-px w-5 shrink-0 bg-line" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Active step panel */}
      <section className="mt-3">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-brand-deep">
            <Icon icon={STEP_ICON[active]} size={16} />
          </div>
          <h2 className="text-section font-bold text-ink">
            {activeIdx + 1}. {t(`sections.${SECTION_KEY[active]}`)}
          </h2>
        </div>

        {active === "material" && <MaterialsSection topicId={topicId} materials={topic.materials} />}
        {active === "digest" && <DigestSection topic={topic} />}
        {active === "generate" && <GenerateSection topic={topic} />}
        {active === "publish" && (
          <div className="space-y-3">
            <PublishSection topic={topic} />
            {/* Ochilish qoidasi — kamdan-kam kerak bo'ladi (kurs sozlamasi
                sukut bo'yicha yetarli). Chop etish tugmalari yolg'iz qolsin. */}
            <Disclosure label={t("unlockRuleTitle")} storageKey="meduni.teach.topicUnlockRule">
              <TopicUnlockRule topic={topic} />
            </Disclosure>
          </div>
        )}
      </section>

      {/* Prev / Next navigation */}
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-5">
        {prevStep ? (
          <Button variant="ghost" onClick={() => go(prevStep)}>
            <Icon icon={ChevronLeft} size={16} /> {t("nav.prev")}
          </Button>
        ) : (
          <span />
        )}
        {nextStep && (
          <div className="flex items-center gap-3">
            {!available[nextStep] && (
              <span className="hidden text-note text-ink-faint sm:inline">{t(`sectionLocked.${nextStep}`)}</span>
            )}
            <Button onClick={() => go(nextStep)} disabled={!available[nextStep]}>
              {t("nav.next")} <Icon icon={ChevronRight} size={16} />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
