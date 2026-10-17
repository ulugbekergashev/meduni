import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertTriangle, ClipboardCheck, FileClock, Sparkles } from "lucide-react";
import { Donut, Icon, LegendRow, MiniBars } from "@meduni/ui";
import { BentoCard, BentoRow, PageHeader } from "../../components/bento";
import { AsyncSection } from "../../components/AsyncSection";
import { useMe } from "../../lib/auth";
import { useLocale } from "../../lib/useLocale";
import { formatDate } from "../../lib/date";
import { useAdminStats, useControlReport } from "./api";
import { useUserStats } from "./users/api";
import { AdminHero, controlIssues } from "./home/AdminHero";

/**
 * Admin bosh sahifasi — Dizayn v3 bento (2026-10).
 * Yuqorida: "biror narsa noto'g'rimi?" (nazorat chetlashishlari + kutilayotgan ishlar)
 * va diqqat talab qiladigan qatorlar; ostida faollik, tarkib va AI sarfi.
 * ⛔ STAT DIETASI: talaba/o'qituvchi/kurs sonlari menyuni takrorlaydi — shapkada MATN.
 */
export function AdminDashboard() {
  const { t } = useTranslation(undefined, { keyPrefix: "adminHome" });
  const { t: tc } = useTranslation(undefined, { keyPrefix: "control" });
  const { data: me } = useMe();
  const navigate = useNavigate();
  const locale = useLocale();
  const lang = locale === "ru" ? "ru" : "uz";
  const q = useAdminStats();
  const roles = useUserStats();
  const control = useControlReport();
  const s = q.data;
  const r = roles.data;

  const admins = r ? r.deptAdmins + r.facultyAdmins + r.superAdmins : 0;
  const pending = s ? s.attention.casesToReview + s.attention.contentToApprove + s.attention.departmentsOverQuota : 0;

  const summary = s
    ? [
        formatDate(lang, new Date(), "long"),
        `${s.counts.students} ${t("students").toLowerCase()}`,
        `${s.counts.teachers} ${t("teachers").toLowerCase()}`,
        `${s.counts.courses} ${t("courses").toLowerCase()} (${t("publishedIn", { count: s.counts.publishedTopics })})`,
      ].join(" · ")
    : formatDate(lang, new Date(), "long");

  const attention = s
    ? [
        { key: "cases", icon: ClipboardCheck, tone: "bg-amber-soft text-amber", n: s.attention.casesToReview, label: t("casesToReview") },
        { key: "content", icon: FileClock, tone: "bg-blue-soft text-blue", n: s.attention.contentToApprove, label: t("contentToApprove") },
        {
          key: "quota",
          icon: AlertTriangle,
          tone: "bg-rose-soft text-rose",
          n: s.attention.departmentsOverQuota,
          label: t("overQuota"),
          onClick: () => navigate("/admin/ai"),
        },
      ]
    : [];

  return (
    <div className="space-y-3">
      <PageHeader className="mb-0" title={`${t("hello")}, ${me?.full_name?.split(" ")[0] ?? ""}`} subtitle={summary} />

      <AsyncSection isLoading={q.isLoading} isError={q.isError} isEmpty={false} emptyText="" onRetry={() => q.refetch()}>
        {s && (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0">
              <AdminHero
                issues={controlIssues(control.data?.totals, tc)}
                pending={pending}
                controlLoading={control.isLoading}
                controlError={control.isError}
                onRetryControl={() => control.refetch()}
              />
            </div>

            <BentoCard title={t("attention")} count={pending} bodyClassName="px-2 pb-3">
              <ul className="space-y-1">
                {attention.map((a) => (
                  <li key={a.key}>
                    <BentoRow
                      icon={a.icon}
                      iconTone={a.tone}
                      title={a.label}
                      right={a.n}
                      muted={a.n === 0}
                      onClick={a.onClick}
                    />
                  </li>
                ))}
              </ul>
            </BentoCard>

            <BentoCard title={t("timeline14")} meta={t("timeline14Hint")}>
              <div className="flex min-h-32 flex-1 flex-col justify-end">
                {s.activitySeries.some((d) => d.activeStudents > 0) ? (
                  <MiniBars
                    height={110}
                    tone="blue"
                    data={s.activitySeries.map((d) => ({
                      label: d.day,
                      value: d.activeStudents,
                      tip: `${formatDate(lang, d.day, "short")} · ${d.activeStudents} ${t("activeShort")} · ${d.contentPublished} ${t("publishedShort")}`,
                    }))}
                  />
                ) : (
                  <p className="flex flex-1 items-center justify-center text-note text-ink-soft">{t("timelineEmpty")}</p>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t border-line pt-3 text-note text-ink-soft">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-blue" />
                  <b className="font-data tabular-nums text-ink">{s.activity.activeStudentsLast7Days}</b> {t("activeStudents")}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-brand" />
                  <b className="font-data tabular-nums text-ink">{s.activity.contentLast7Days}</b> {t("contentCreated")}
                </span>
              </div>
            </BentoCard>

            <BentoCard title={t("composition")} isLoading={roles.isLoading} isError={roles.isError} onRetry={() => roles.refetch()}>
              <div className="flex flex-1 items-center justify-center gap-4">
                <Donut
                  size={128}
                  stroke={14}
                  centerValue={r ? r.total : "—"}
                  centerLabel={t("compositionTotal")}
                  segments={[
                    { value: r?.students ?? 0, tone: "blue" },
                    { value: r?.teachers ?? 0, tone: "violet" },
                    { value: admins, tone: "amber" },
                  ]}
                />
                <div className="flex flex-col gap-2.5">
                  <LegendRow tone="blue" label={t("students")} value={r?.students ?? "—"} />
                  <LegendRow tone="violet" label={t("teachers")} value={r?.teachers ?? "—"} />
                  <LegendRow tone="amber" label={t("admins")} value={r ? admins : "—"} />
                </div>
              </div>
            </BentoCard>

            <BentoCard
              className="xl:col-span-2"
              title={
                <span className="inline-flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-soft text-violet">
                    <Icon icon={Sparkles} size={15} />
                  </span>
                  {t("aiThisMonth")}
                </span>
              }
              action={{ label: t("aiDetails"), onClick: () => navigate("/admin/ai") }}
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <p className="text-note text-ink-soft">{t("aiHint")}</p>
                <div className="flex flex-wrap gap-x-8 gap-y-2">
                  <AiFigure value={s.aiThisMonth.tokens.toLocaleString()} label={t("tokens")} />
                  <AiFigure value={String(s.aiThisMonth.images)} label={t("images")} />
                  <AiFigure value={`$${s.aiThisMonth.cost.toFixed(2)}`} label={t("cost")} />
                </div>
              </div>
            </BentoCard>
          </div>
        )}
      </AsyncSection>
    </div>
  );
}

function AiFigure({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-stat font-semibold tabular-nums text-ink">{value}</p>
      <p className="text-micro text-ink-soft">{label}</p>
    </div>
  );
}
