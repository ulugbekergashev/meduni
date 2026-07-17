import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Building2, ChevronRight, Landmark, Plus, Users } from "lucide-react";
import { Button, Card, EmptyState, Icon, Spinner } from "@meduni/ui";
import { useMe } from "../../../lib/auth";
import { PasswordModal } from "../users/PasswordModal";
import { EntityFormModal, useStructureTree } from "./shared";

/** Structure hub: one spacious card per faculty — click to drill in. */
export function StructurePage() {
  const { t } = useTranslation(undefined, { keyPrefix: "structure" });
  const { t: tc } = useTranslation(undefined, { keyPrefix: "common" });
  const navigate = useNavigate();
  const { data: me } = useMe();
  const tree = useStructureTree();
  const [adding, setAdding] = useState(false);
  const [revealPassword, setRevealPassword] = useState<string | null>(null);

  const canFaculty = me?.role === "superadmin";
  const faculties = tree.data ?? [];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-h1 font-bold text-ink">{t("title")}</h1>
          <p className="mt-1 text-[13.5px] text-ink-soft">{t("subtitle")}</p>
        </div>
        {canFaculty && (
          <Button icon={<Icon icon={Plus} size={16} />} onClick={() => setAdding(true)}>
            {t("add.faculty")}
          </Button>
        )}
      </div>

      <div className="mt-6">
        {tree.isLoading ? (
          <div className="flex min-h-[30vh] items-center justify-center"><Spinner size={26} /></div>
        ) : tree.isError ? (
          <Card><p className="py-6 text-center text-[13.5px] text-rose">{tc("genericError")}</p></Card>
        ) : faculties.length === 0 ? (
          <EmptyState
            icon={<Icon icon={Building2} size={24} />}
            text={t("emptyFaculties")}
            hint={t("emptyFacultiesHint")}
            action={canFaculty ? <Button size="sm" onClick={() => setAdding(true)}>{t("add.faculty")}</Button> : undefined}
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {faculties.map((f) => {
              const teacherCount = f.departments.reduce((s, d) => s + d.teacherCount, 0);
              const studentCount = f.groups.reduce((s, g) => s + g.studentCount, 0);
              return (
                <li key={f.id}>
                  <Card
                    interactive
                    onClick={() => navigate(`/admin/structure/f/${f.id}`)}
                    className="flex h-full flex-col gap-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand-deep">
                        <Icon icon={Building2} size={20} />
                      </div>
                      <Icon icon={ChevronRight} size={17} className="mt-1 text-ink-faint" />
                    </div>
                    <h3 className="line-clamp-2 text-[16px] font-bold leading-snug text-ink">{f.name}</h3>
                    <div className="mt-auto grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line pt-3 text-[12.5px] text-ink-soft">
                      <span className="inline-flex items-center gap-1.5">
                        <Icon icon={Landmark} size={14} className="text-amber" /> {t("nDepts", { n: f.departments.length })}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Icon icon={Users} size={14} className="text-violet" /> {t("nGroups", { n: f.groups.length })}
                      </span>
                      <span>{t("nTeachers", { n: teacherCount })}</span>
                      <span>{t("nStudents", { n: studentCount })}</span>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {adding && (
        <EntityFormModal
          kind="faculty"
          onClose={(pw) => {
            setAdding(false);
            if (pw) setRevealPassword(pw);
          }}
        />
      )}
      <PasswordModal password={revealPassword} onClose={() => setRevealPassword(null)} />
    </div>
  );
}
