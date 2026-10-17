import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plus, Users2, X } from "lucide-react";
import { Button, EmptyState, Icon, Modal, Spinner, useToast } from "@meduni/ui";
import { BentoCard, BentoRow } from "../../../components/bento";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { apiErrorMessage } from "../../../lib/api";
import { useLocale } from "../../../lib/useLocale";
import {
  useAssignableGroups,
  useAttachGroup,
  useCourseGroupsStats,
  useDetachGroup,
  type CourseGroupStat,
} from "../api";

// Which groups this course is taught in — the teacher attaches/detaches groups
// here (students auto-enroll / are dropped); each card opens the group profile.
export function CourseGroupsTab() {
  const { id } = useParams();
  const courseId = Number(id);
  const { t } = useTranslation(undefined, { keyPrefix: "courseGroups" });
  const { t: tc } = useTranslation(undefined, { keyPrefix: "common" });
  const { t: tt } = useTranslation(undefined, { keyPrefix: "teach" });
  const locale = useLocale();
  const navigate = useNavigate();
  const { show } = useToast();

  const q = useCourseGroupsStats(courseId);
  const groups = q.data ?? [];

  const [addOpen, setAddOpen] = useState(false);
  const [detaching, setDetaching] = useState<CourseGroupStat | null>(null);
  const [detachError, setDetachError] = useState<string | null>(null);
  const detach = useDetachGroup(courseId);

  const onConfirmDetach = () => {
    if (!detaching) return;
    setDetachError(null);
    detach.mutate(detaching.groupId, {
      onSuccess: () => {
        setDetaching(null);
        show(t("detached"));
      },
      onError: (err) => setDetachError(apiErrorMessage(err, locale) ?? tc("genericError")),
    });
  };

  return (
    <div>
      <BentoCard
        title={tt("tabs.groups")}
        count={groups.length}
        isLoading={q.isLoading}
        isError={q.isError}
        onRetry={() => q.refetch()}
        bodyClassName="px-2 pb-3"
        right={
          <Button size="sm" icon={<Icon icon={Plus} size={15} />} onClick={() => setAddOpen(true)}>
            {t("attachBtn")}
          </Button>
        }
      >
        <p className="mb-2 px-2 text-note text-ink-soft">{t("subtitleManage")}</p>
        {groups.length === 0 ? (
          <div className="flex items-center justify-center px-2 py-4">
            <EmptyState icon={<Icon icon={Users2} size={20} />} text={t("emptyManage")} />
          </div>
        ) : (
          <ul className="space-y-0.5">
            {groups.map((g) => (
              <li key={g.groupId}>
                <BentoRow
                  icon={Users2}
                  iconTone="bg-blue-soft text-blue"
                  title={g.name}
                  sub={`${t("yearN", { n: g.yearOfStudy })} · ${g.facultyName} · ${t("studentsN", { n: g.studentCount })}`}
                  right={
                    <span className="flex items-center gap-2">
                      <span className="hidden h-1.5 w-24 overflow-hidden rounded-pill bg-line sm:block">
                        {g.avgProgress > 0 && <span className="block h-full rounded-pill bg-brand" style={{ width: `${g.avgProgress}%` }} />}
                      </span>
                      {g.avgProgress}%
                    </span>
                  }
                  onClick={() => navigate(`/teach/groups/${g.groupId}`)}
                  trailing={
                    <button
                      type="button"
                      onClick={() => { setDetachError(null); setDetaching(g); }}
                      className="shrink-0 rounded-pill p-1.5 text-ink-faint transition-colors hover:bg-rose-soft hover:text-rose focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                      aria-label={t("detach")}
                      title={t("detach")}
                    >
                      <Icon icon={X} size={15} />
                    </button>
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </BentoCard>

      {addOpen && <AttachModal courseId={courseId} onClose={() => setAddOpen(false)} />}

      <ConfirmDialog
        open={!!detaching}
        title={t("detachTitle")}
        message={detaching ? t("detachConfirm", { name: detaching.name }) : ""}
        confirmLabel={t("detach")}
        confirmVariant="danger"
        errorMessage={detachError}
        loading={detach.isPending}
        onConfirm={onConfirmDetach}
        onClose={() => setDetaching(null)}
      />
    </div>
  );
}

/** Modal: ulanmagan (o'sha fakultet) guruhlar ro'yxati — bosilsa biriktiriladi. */
function AttachModal({ courseId, onClose }: { courseId: number; onClose: () => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "courseGroups" });
  const { show } = useToast();
  const q = useAssignableGroups(courseId);
  const attach = useAttachGroup(courseId);
  const rows = q.data ?? [];

  const onAttach = (groupId: number, name: string) =>
    attach.mutate(groupId, {
      onSuccess: (r) => show(t("attached", { name, n: r.enrolled })),
    });

  return (
    <Modal open onClose={onClose} title={t("attachTitle")}>
      <p className="mb-3 text-note text-ink-soft">{t("attachHint")}</p>
      {q.isLoading ? (
        <div className="flex h-32 items-center justify-center"><Spinner size={22} /></div>
      ) : rows.length === 0 ? (
        <p className="rounded-control border border-dashed border-line py-8 text-center text-note text-ink-faint">
          {t("noAssignable")}
        </p>
      ) : (
        <div className="max-h-[50vh] space-y-2 overflow-y-auto">
          {rows.map((g) => (
            <div key={g.id} className="flex items-center gap-3 rounded-control border border-line px-3.5 py-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-deep">
                <Icon icon={Users2} size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-note font-semibold text-ink">{g.name}</p>
                <p className="text-micro text-ink-faint">{t("yearN", { n: g.yearOfStudy })} · {t("studentsN", { n: g.studentCount })}</p>
              </div>
              <Button size="sm" variant="soft" disabled={attach.isPending} onClick={() => onAttach(g.id, g.name)}>
                {t("attachOne")}
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 flex justify-end">
        <Button variant="ghost" onClick={onClose}>{t("close")}</Button>
      </div>
    </Modal>
  );
}
