import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, type Variants } from "framer-motion";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileClock,
  FileStack,
  GraduationCap,
  Sparkles,
  Users,
} from "lucide-react";
import { Card, Donut, Icon, LegendRow, MiniBars, Spinner, StatCard, cls } from "@meduni/ui";
import { useMe } from "../../lib/auth";
import { useLocale } from "../../lib/useLocale";
import { formatDate } from "../../lib/date";
import { useAdminStats } from "./api";
import { useUserStats } from "./users/api";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

function AttentionCard({
  icon,
  value,
  label,
  tone,
  onClick,
}: {
  icon: typeof Users;
  value: number;
  label: string;
  tone: "amber" | "blue" | "rose";
  onClick?: () => void;
}) {
  const toneCls = {
    amber: "bg-amber-soft text-amber",
    blue: "bg-blue-soft text-blue",
    rose: "bg-rose-soft text-rose",
  }[tone];
  return (
    <Card
      interactive={!!onClick}
      onClick={onClick}
      className={cls("flex items-center gap-3 !p-4", value === 0 && "opacity-60")}
    >
      <div className={cls("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", toneCls)}>
        <Icon icon={icon} size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[22px] font-bold leading-none tabular-nums text-ink">{value}</p>
        <p className="mt-1 truncate text-[13.5px] text-ink-soft">{label}</p>
      </div>
      {onClick && <Icon icon={ChevronRight} size={16} className="shrink-0 text-ink-faint" />}
    </Card>
  );
}

export function AdminDashboard() {
  const { t } = useTranslation(undefined, { keyPrefix: "adminHome" });
  const { data: me } = useMe();
  const navigate = useNavigate();
  const locale = useLocale();
  const q = useAdminStats();
  const roles = useUserStats();
  const s = q.data;
  const r = roles.data;
  const today = formatDate(locale === "ru" ? "ru" : "uz", new Date(), "long");

  if (q.isLoading) return <div className="flex min-h-[40vh] items-center justify-center"><Spinner size={26} /></div>;

  const admins = r ? r.deptAdmins + r.facultyAdmins + r.superAdmins : 0;
  const allClear =
    s && s.attention.casesToReview === 0 && s.attention.contentToApprove === 0 && s.attention.departmentsOverQuota === 0;

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show">
      <motion.div variants={itemVariants}>
        <h1 className="text-h1 font-bold tracking-tight text-ink">{t("hello")}, {me?.full_name?.split(" ")[0]}</h1>
        <p className="mt-1 text-[15px] text-ink-faint">{today}</p>
      </motion.div>

      {s && (
        <>
          {/* Core stats */}
          <motion.div variants={itemVariants} className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard icon={Users} value={s.counts.students} label={t("students")} hint={t("studentsHint")} tone="bg-blue-soft text-blue" onClick={() => navigate("/admin/users")} />
            <StatCard icon={GraduationCap} value={s.counts.teachers} label={t("teachers")} hint={t("teachersHint")} tone="bg-violet-soft text-violet" onClick={() => navigate("/admin/users")} />
            <StatCard icon={BookOpen} value={s.counts.courses} label={t("courses")} hint={t("coursesHint")} tone="bg-brand-soft text-brand-deep" onClick={() => navigate("/admin/courses")} />
            <StatCard icon={FileStack} value={s.counts.publishedContent} label={t("publishedContent")} hint={t("publishedIn", { count: s.counts.publishedTopics })} tone="bg-emerald-soft text-emerald" onClick={() => navigate("/admin/courses")} />
          </motion.div>

          {/* Composition + activity timeline - Bento Box */}
          <motion.div variants={itemVariants} className="mt-4 grid gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-2 relative overflow-hidden flex flex-col justify-between">
              <h2 className="text-section font-bold tracking-tight text-ink">{t("composition")}</h2>
              <div className="mt-3 flex items-center justify-center gap-3 flex-1">
                <Donut
                  size={140}
                  stroke={16}
                  centerValue={r ? r.total : "—"}
                  centerLabel={t("compositionTotal")}
                  segments={[
                    { value: r?.students ?? 0, tone: "blue" },
                    { value: r?.teachers ?? 0, tone: "violet" },
                    { value: admins, tone: "amber" },
                  ]}
                />
                <div className="flex flex-col gap-3">
                  <LegendRow tone="blue" label={t("students")} value={r?.students ?? "—"} />
                  <LegendRow tone="violet" label={t("teachers")} value={r?.teachers ?? "—"} />
                  <LegendRow tone="amber" label={t("admins")} value={r ? admins : "—"} />
                </div>
              </div>
            </Card>

            <Card className="lg:col-span-3 flex flex-col">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-section font-bold tracking-tight text-ink">{t("timeline14")}</h2>
                <span className="text-[13px] font-medium text-ink-faint bg-bg px-2 py-0.5 rounded-pill">{t("timeline14Hint")}</span>
              </div>
              <div className="mt-3 flex-1 flex flex-col justify-end">
                {s.activitySeries.some((d) => d.activeStudents > 0) ? (
                  <MiniBars
                    height={110}
                    tone="blue"
                    data={s.activitySeries.map((d) => ({
                      label: d.day,
                      value: d.activeStudents,
                      tip: `${formatDate(locale === "ru" ? "ru" : "uz", d.day, "short")} · ${d.activeStudents} ${t("activeShort")} · ${d.contentPublished} ${t("publishedShort")}`,
                    }))}
                  />
                ) : (
                  <div className="flex flex-1 items-center justify-center">
                    <p className="text-[14px] text-ink-faint">{t("timelineEmpty")}</p>
                  </div>
                )}
              </div>
              <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-4 text-[14px] text-ink-soft">
                <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue"></div><b className="text-ink font-bold">{s.activity.activeStudentsLast7Days}</b> {t("activeStudents")}</span>
                <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-brand"></div><b className="text-ink font-bold">{s.activity.contentLast7Days}</b> {t("contentCreated")}</span>
              </div>
            </Card>
          </motion.div>

          {/* Attention */}
          <motion.section variants={itemVariants} className="mt-3">
            <h2 className="mb-4 text-section font-bold tracking-tight text-ink">{t("attention")}</h2>
            {allClear ? (
              <Card className="flex items-center gap-3 border-emerald/30 bg-emerald/5 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-soft text-emerald">
                  <Icon icon={CheckCircle2} size={20} />
                </div>
                <p className="text-[16px] font-bold text-emerald">{t("allClear")}</p>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-3">
                <AttentionCard icon={ClipboardCheck} value={s.attention.casesToReview} label={t("casesToReview")} tone="amber" />
                <AttentionCard icon={FileClock} value={s.attention.contentToApprove} label={t("contentToApprove")} tone="blue" />
                <AttentionCard icon={AlertTriangle} value={s.attention.departmentsOverQuota} label={t("overQuota")} tone="rose" onClick={() => navigate("/admin/ai")} />
              </div>
            )}
          </motion.section>

          {/* AI spend */}
          <motion.section variants={itemVariants} className="mt-4">
            <button onClick={() => navigate("/admin/ai")} className="block w-full text-left outline-none group">
              <div className="relative overflow-hidden rounded-card bg-surface p-4 shadow-sm border border-line transition-all duration-300 group-hover:shadow-md group-hover:border-brand/30">
                {/* Subtle gradient background effect */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-brand-soft rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
                
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-brand font-bold mb-2">
                      <Icon icon={Sparkles} size={18} />
                      <p className="text-[14px] uppercase tracking-wide">{t("aiThisMonth")}</p>
                    </div>
                    <p className="text-[14.5px] text-ink-soft">Review AI token usage and estimated costs across all departments.</p>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-x-8 gap-y-4 md:border-l md:border-line md:pl-8">
                    <div><p className="text-[28px] font-bold tracking-tight text-ink">{s.aiThisMonth.tokens.toLocaleString()}</p><p className="text-[13.5px] font-medium text-ink-faint">{t("tokens")}</p></div>
                    <div><p className="text-[28px] font-bold tracking-tight text-ink">{s.aiThisMonth.images}</p><p className="text-[13.5px] font-medium text-ink-faint">{t("images")}</p></div>
                    <div><p className="text-[28px] font-bold tracking-tight text-ink">${s.aiThisMonth.cost.toFixed(2)}</p><p className="text-[13.5px] font-medium text-ink-faint">{t("cost")}</p></div>
                    <div className="hidden sm:flex h-10 w-10 items-center justify-center rounded-full bg-bg text-ink-soft group-hover:bg-brand-soft group-hover:text-brand transition-colors">
                      <Icon icon={ChevronRight} size={18} />
                    </div>
                  </div>
                </div>
              </div>
            </button>
          </motion.section>
        </>
      )}
    </motion.div>
  );
}
