import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, Check, X } from "lucide-react";
import { Icon, cls } from "@meduni/ui";
import { useMe } from "../../../lib/auth";
import { dismissStarter, isStarterDismissed } from "./starterState";

interface Step {
  label: string;
  hint: string;
  done: boolean;
  to: string | null;
}

/**
 * Birinchi kirish — "3 qadam".
 *
 * Buyurtmachi: o'qituvchi tizimga kirib "испугается" va nimadan boshlashni
 * bilmaydi. Bu karta butun oqimni uch qatorga siqadi va keyingi bajarilmagan
 * qadamga TO'G'RIDAN olib boradi.
 *
 * Backend o'zgarmagan — uchala shart sahifada allaqachon bor so'rovlardan
 * hosila (`useTeachCourses`, `useTeachDashboard`).
 */
export function StarterCard({
  coursesCount,
  totalTopics,
  publishedTopics,
  firstCourseId,
}: {
  coursesCount: number;
  totalTopics: number;
  publishedTopics: number;
  firstCourseId: number | undefined;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "teach" });
  const navigate = useNavigate();
  const { data: me } = useMe();
  const [hidden, setHidden] = useState(() => isStarterDismissed(me?.id));

  // Chop etilgan mavzu bor — o'qituvchi oqimni bir marta oxirigacha o'tgan.
  if (hidden || publishedTopics > 0) return null;

  const steps: Step[] = [
    {
      label: t("startStep1"),
      hint: t("startStep1Hint"),
      done: coursesCount > 0,
      to: "/teach/courses?new=1",
    },
    {
      label: t("startStep2"),
      hint: t("startStep2Hint"),
      done: totalTopics > 0,
      to: firstCourseId ? `/teach/courses/${firstCourseId}/topics` : null,
    },
    {
      label: t("startStep3"),
      hint: t("startStep3Hint"),
      done: publishedTopics > 0,
      to: firstCourseId ? `/teach/courses/${firstCourseId}/topics` : null,
    },
  ];

  const next = steps.find((s) => !s.done);

  return (
    <section className="relative rounded-card border border-line bg-surface p-4">
      <button
        type="button"
        onClick={() => {
          dismissStarter(me?.id);
          setHidden(true);
        }}
        aria-label={t("startDismiss")}
        className="absolute right-3 top-3 rounded-pill p-1.5 text-ink-faint transition-colors hover:bg-surface-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <Icon icon={X} size={16} />
      </button>

      <div className="pr-8">
        <h2 className="text-section font-semibold text-ink">{t("startTitle")}</h2>
        <p className="mt-0.5 text-note text-ink-soft">{t("startSubtitle")}</p>
      </div>

      <ol className="mt-3 grid gap-2 lg:grid-cols-3">
        {steps.map((s, i) => {
          const isNext = s === next;
          return (
            <li key={s.label} className="min-w-0">
              <button
                type="button"
                disabled={!s.to}
                onClick={() => s.to && navigate(s.to)}
                className={cls(
                  "flex h-full w-full items-start gap-3 rounded-control p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                  isNext ? "bg-brand-soft" : "bg-surface-raised",
                  s.to ? "hover:brightness-[0.98]" : "cursor-default"
                )}
              >
                <span
                  className={cls(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-micro font-semibold",
                    s.done ? "bg-emerald-soft text-emerald" : isNext ? "bg-ink text-surface" : "border border-line-raised bg-surface text-ink-soft"
                  )}
                >
                  {s.done ? <Icon icon={Check} size={14} /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cls("block text-body font-semibold", s.done ? "text-ink-soft line-through" : "text-ink")}>
                    {s.label}
                  </span>
                  <span className="mt-0.5 block text-note text-ink-soft">{s.hint}</span>
                  {isNext && s.to && (
                    <span className="mt-2 inline-flex items-center gap-1 text-note font-semibold text-brand-tint">
                      {t("startGo")} <Icon icon={ArrowRight} size={14} />
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
