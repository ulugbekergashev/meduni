import { Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BarChart3, BookOpen, Settings, Users, Users2 } from "lucide-react";
import { Icon } from "@meduni/ui";
import { HeaderChip, PageHeader } from "../../../components/bento";
import { BackLink } from "../BackLink";
import { SubNav } from "../../../components/SubNav";
import { useTeachCourseMeta } from "../api";

function HeaderSkeleton() {
  return (
    <div>
      <div className="h-4 w-28 animate-pulse rounded-pill bg-line" />
      <div className="mt-3 h-7 w-64 animate-pulse rounded-pill bg-line" />
      <div className="mt-2 h-4 w-80 animate-pulse rounded-pill bg-line" />
    </div>
  );
}

export function TeacherCourseShell() {
  const { id } = useParams();
  const courseId = Number(id);
  const { t } = useTranslation(undefined, { keyPrefix: "teach" });
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Metadata only — keyed by courseId, so switching tabs (which changes the
  // child route, not this layout) never refetches the header.
  const meta = useTeachCourseMeta(courseId);

  if (meta.isLoading) {
    return (
      <div>
        <HeaderSkeleton />
        <div className="mt-3 h-9 w-full max-w-md animate-pulse rounded-pill bg-line" />
      </div>
    );
  }

  if (meta.isError || !meta.data) {
    return (
      <div>
        <BackLink onClick={() => navigate("/teach/courses")}>{t("backToCourses")}</BackLink>
        <div className="mt-3 rounded-card border border-line bg-surface">
          <p className="py-6 text-center text-note text-rose">{t("notFound")}</p>
        </div>
      </div>
    );
  }

  const c = meta.data;
  const base = `/teach/courses/${courseId}`;
  // Faol bo'lim — URL'dan (`/teach/courses/:id/<bo'lim>`); bo'sh bo'lsa mavzular.
  const activeKey = pathname.slice(base.length).split("/")[1] || "topics";

  return (
    <div>
      {/* Header — stable across tab navigation */}
      <BackLink onClick={() => navigate("/teach/courses")}>{t("backToCourses")}</BackLink>
      <PageHeader
        className="mb-0 mt-2"
        title={c.subjectName}
        subtitle={[t("semesterN", { n: c.semester }), c.academicYear, t("studentsN", { n: c.studentCount })].join(" · ")}
        right={c.groups.map((g) => (
          <HeaderChip key={g.id} icon={<Icon icon={Users} size={14} />} onClick={() => navigate(`/teach/groups/${g.id}`)}>
            {g.name}
          </HeaderChip>
        ))}
      />

      {/* Kurs bo'limlari — yon paneldagi ikkinchi daraja (mobilda tasma).
          Panel sarlavhasi = kurs nomi (Hostinger naqshi: kontekst + bo'limlari). */}
      <div className="mt-3">
        <SubNav
          title={c.subjectName}
          activeKey={activeKey}
          items={[
            { key: "topics", label: t("tabs.topics"), to: `${base}/topics`, icon: <Icon icon={BookOpen} size={16} /> },
            { key: "groups", label: t("tabs.groups"), to: `${base}/groups`, icon: <Icon icon={Users2} size={16} /> },
            // "Xatolar" endi shu bo'lim ichidagi uchinchi ko'rinish (mavjud
            // Ro'yxat/Xarita pereklyuchateli), "Dastur" — Sozlamalar ichida.
            { key: "progress", label: t("tabs.results"), to: `${base}/progress`, icon: <Icon icon={BarChart3} size={16} /> },
            { key: "settings", label: t("tabs.settings"), to: `${base}/settings`, icon: <Icon icon={Settings} size={16} /> },
          ]}
        />
      </div>

      {/* Active tab module — loads its own data independently */}
      <div className="mt-3">
        <Outlet />
      </div>
    </div>
  );
}
