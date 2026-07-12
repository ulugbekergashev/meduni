import { Outlet, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Users } from "lucide-react";
import { Card, Icon } from "@meduni/ui";
import { TabNav } from "../../../components/TabNav";
import { pickName, useLocale } from "../../../lib/useLocale";
import { useTeachCourseMeta } from "../api";

function HeaderSkeleton() {
  return (
    <div>
      <div className="h-4 w-28 animate-pulse rounded bg-line" />
      <div className="mt-3 h-7 w-64 animate-pulse rounded bg-line" />
      <div className="mt-2 h-4 w-80 animate-pulse rounded bg-line" />
    </div>
  );
}

export function TeacherCourseShell() {
  const { id } = useParams();
  const courseId = Number(id);
  const { t } = useTranslation(undefined, { keyPrefix: "teach" });
  const locale = useLocale();
  const navigate = useNavigate();

  // Metadata only — keyed by courseId, so switching tabs (which changes the
  // child route, not this layout) never refetches the header.
  const meta = useTeachCourseMeta(courseId);

  if (meta.isLoading) {
    return (
      <div>
        <HeaderSkeleton />
        <div className="mt-6 h-9 w-full max-w-md animate-pulse rounded bg-line" />
      </div>
    );
  }

  if (meta.isError || !meta.data) {
    return (
      <div>
        <button
          onClick={() => navigate("/teach")}
          className="text-[13.5px] font-medium text-brand-deep hover:underline"
        >
          {t("backToCourses")}
        </button>
        <Card className="mt-4">
          <p className="py-6 text-center text-[13.5px] text-rose">{t("notFound")}</p>
        </Card>
      </div>
    );
  }

  const c = meta.data;
  const base = `/teach/courses/${courseId}`;

  return (
    <div>
      {/* Header — stable across tab navigation */}
      <button
        onClick={() => navigate("/teach")}
        className="text-[13.5px] font-medium text-brand-deep hover:underline"
      >
        {t("backToCourses")}
      </button>
      <h1 className="mt-3 text-h1 font-bold text-ink">{pickName(locale, c.subjectNameUz, c.subjectNameRu)}</h1>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] text-ink-soft">
        {c.groups.length > 0 && (
          <>
            <span className="inline-flex items-center gap-1">
              <Icon icon={Users} size={14} />
              {c.groups.map((g, i) => (
                <span key={g.id}>
                  <button onClick={() => navigate(`/teach/groups/${g.id}`)} className="font-medium text-brand-deep hover:underline">
                    {g.name}
                  </button>
                  {i < c.groups.length - 1 && ", "}
                </span>
              ))}
            </span>
            <span>·</span>
          </>
        )}
        <span>{t("semesterN", { n: c.semester })}</span>
        <span>·</span>
        <span>{c.academicYear}</span>
        <span>·</span>
        <span>{t("studentsN", { n: c.studentCount })}</span>
      </div>

      {/* Tab bar (URL-driven) */}
      <div className="mt-6">
        <TabNav
          items={[
            { to: `${base}/topics`, label: t("tabs.topics") },
            { to: `${base}/syllabus`, label: t("tabs.syllabus") },
            { to: `${base}/groups`, label: t("tabs.groups") },
            { to: `${base}/progress`, label: t("tabs.results") },
            { to: `${base}/settings`, label: t("tabs.settings") },
          ]}
        />
      </div>

      {/* Active tab module — loads its own data independently */}
      <div className="mt-6">
        <Outlet />
      </div>
    </div>
  );
}
