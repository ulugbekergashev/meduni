import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Award, ClipboardList, Dumbbell, Repeat, Stethoscope } from "lucide-react";
import { Icon } from "@meduni/ui";
import { BentoCard, BentoRow, MetricTile, PageHeader } from "../../components/bento";
import { AsyncSection } from "../../components/AsyncSection";
import { SubNav } from "../../components/SubNav";
import { useMyGrades, useReviewDue } from "./api";
import { LeaderboardCard } from "./LeaderboardCard";
import { ReviewTab } from "./grades/ReviewTab";
import { PracticeTab } from "./grades/PracticeTab";
import { CourseBlock, type GradeFilter } from "./grades/GradeRows";
import { PillTabs } from "./parts/bento";

/** O'zlashtirish moduli — 3 tab: Baholar | Takrorlash | Mashg'ulotlar (Modul 27). */
export function GradesPage() {
  const { t } = useTranslation(undefined, { keyPrefix: "grades" });
  const [params] = useSearchParams();
  const dueQ = useReviewDue();
  const sub =
    params.get("sub") === "takrorlash" ? "takrorlash" : params.get("sub") === "mashgulot" ? "mashgulot" : "baholar";

  return (
    <div>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <SubNav
        title={t("title")}
        activeKey={sub}
        items={[
          { key: "baholar", label: t("tabGrades"), to: "/app/grades", icon: <Icon icon={Award} size={16} /> },
          {
            key: "takrorlash",
            label: t("tabReview"),
            to: "/app/grades?sub=takrorlash",
            icon: <Icon icon={Repeat} size={16} />,
            badge: dueQ.data?.total ?? 0,
          },
          { key: "mashgulot", label: t("tabPractice"), to: "/app/grades?sub=mashgulot", icon: <Icon icon={Dumbbell} size={16} /> },
        ]}
      />

      {sub === "takrorlash" ? <ReviewTab /> : sub === "mashgulot" ? <PracticeTab /> : <GradesHome />}
    </div>
  );
}

/** "Baholarim" — barcha test natijalari va keys baholari, kurslar kesimida. */
function GradesHome() {
  const { t } = useTranslation(undefined, { keyPrefix: "grades" });
  const navigateTo = useNavigate();
  const q = useMyGrades();
  const data = q.data;
  const [filter, setFilter] = useState<GradeFilter>("all");
  const withGrades = (data?.courses ?? []).filter((c) =>
    filter === "quiz" ? c.quizzes.length > 0 : filter === "case" ? c.cases.length > 0 : c.quizzes.length > 0 || c.cases.length > 0
  );
  const s = data?.summary;
  const toggle = (f: GradeFilter) => setFilter((cur) => (cur === f ? "all" : f));
  const withGradesAny = (data?.courses ?? []).some((c) => c.quizzes.length > 0 || c.cases.length > 0);
  const allCases = (data?.courses ?? []).flatMap((c) => c.cases.map((k) => ({ ...k, subjectName: c.subjectName })));
  const pendingCases = allCases.filter((k) => !k.reviewed);
  // O'ng ustun: oxirgi baholangan ishlar (sana bo'yicha)
  const recent = [
    ...(data?.courses ?? []).flatMap((c) =>
      c.quizzes.map((qz) => ({
        key: `q${qz.topicId}`,
        title: qz.topicTitle,
        subject: c.subjectName,
        score: `${qz.bestScore}%`,
        at: qz.lastAt,
        topicId: qz.topicId,
        tab: "quiz",
      }))
    ),
    ...allCases
      .filter((k) => k.reviewed)
      .map((k) => ({
        key: `c${k.topicId}`,
        title: k.topicTitle,
        subject: k.subjectName,
        score: String(k.score ?? "—"),
        at: k.reviewedAt,
        topicId: k.topicId,
        tab: "case",
      })),
  ]
    .filter((r) => r.at)
    .sort((a, b) => new Date(b.at!).getTime() - new Date(a.at!).getTime())
    .slice(0, 6);

  return (
    <div className="space-y-3">
      {/* Kartalar — FILTR (test / keys). */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile
          size="stat"
          tone="violet"
          label={t("avgQuiz")}
          value={s?.avgQuiz ?? null}
          percent
          onClick={() => toggle("quiz")}
          selected={filter === "quiz"}
        />
        <MetricTile
          size="stat"
          label={t("quizzesPassed")}
          value={`${s?.quizzesPassed ?? 0}/${s?.quizzesTotal ?? 0}`}
          onClick={() => toggle("quiz")}
          selected={filter === "quiz"}
        />
        <MetricTile
          size="stat"
          label={t("casesGraded")}
          value={`${s?.casesGraded ?? 0}/${s?.casesTotal ?? 0}`}
          onClick={() => toggle("case")}
          selected={filter === "case"}
        />
        <MetricTile
          size="stat"
          tone={pendingCases.length > 0 ? "amber" : "plain"}
          label={t("statPending")}
          value={pendingCases.length}
          onClick={() => toggle("case")}
          selected={filter === "case"}
        />
      </div>

      {/* Tur filtri — qora pill segment */}
      {withGradesAny && (
        <PillTabs<GradeFilter>
          value={filter}
          onChange={setFilter}
          items={(["all", "quiz", "case"] as GradeFilter[]).map((f) => ({ key: f, label: t(`filter.${f}`) }))}
        />
      )}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-3">
          <AsyncSection
            isLoading={q.isLoading}
            isError={q.isError}
            isEmpty={withGrades.length === 0}
            emptyIcon={<Icon icon={Award} size={22} />}
            emptyText={t("empty")}
            emptyHint={t("emptyHint")}
            onRetry={() => q.refetch()}
          >
            <div className="space-y-3">
              {withGrades.map((c) => (
                <CourseBlock key={c.courseId} c={c} filter={filter} />
              ))}
            </div>
          </AsyncSection>
        </div>

        <aside className="min-w-0 space-y-3">
          <LeaderboardCard />

          {recent.length > 0 && (
            <BentoCard title={t("recentGrades")} bodyClassName="px-2 pb-2">
              <ul>
                {recent.map((r) => (
                  <li key={r.key}>
                    <BentoRow
                      icon={r.tab === "quiz" ? ClipboardList : Stethoscope}
                      iconTone={r.tab === "quiz" ? "bg-blue-soft text-blue" : "bg-rose-soft text-rose"}
                      title={r.title}
                      sub={r.subject}
                      right={r.score}
                      onClick={() => navigateTo(`/app/topics/${r.topicId}?tab=${r.tab}`)}
                    />
                  </li>
                ))}
              </ul>
            </BentoCard>
          )}

          {pendingCases.length > 0 && (
            <BentoCard title={t("statPending")} count={pendingCases.length} bodyClassName="px-2 pb-2">
              <ul>
                {pendingCases.map((k) => (
                  <li key={`p${k.topicId}`}>
                    <BentoRow
                      icon={Stethoscope}
                      iconTone="bg-amber-soft text-amber"
                      title={k.topicTitle}
                      sub={`${k.subjectName} · ${t("underReview")}`}
                      onClick={() => navigateTo(`/app/topics/${k.topicId}?tab=case`)}
                    />
                  </li>
                ))}
              </ul>
            </BentoCard>
          )}
        </aside>
      </div>
    </div>
  );
}
