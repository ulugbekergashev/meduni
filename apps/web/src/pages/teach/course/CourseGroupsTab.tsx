import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { GraduationCap, Plus, Users2, X } from "lucide-react";
import { Button, Card, Icon, Modal, Spinner, useToast } from "@meduni/ui";
import { AsyncSection } from "../../../components/AsyncSection";
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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[14px] text-ink-soft">{t("subtitleManage")}</p>
        <Button size="sm" icon={<Icon icon={Plus} size={15} />} onClick={() => setAddOpen(true)}>
          {t("attachBtn")}
        </Button>
      </div>

      {q.isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center"><Spinner size={24} /></div>
      ) : (
        <AsyncSection
          isLoading={false}
          isError={q.isError}
          isEmpty={groups.length === 0}
          emptyIcon={<Icon icon={Users2} size={22} />}
          emptyText={t("emptyManage")}
          onRetry={() => q.refetch()}
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((g) => (
              <Card key={g.groupId} className="group relative flex flex-col gap-3">
                <button
                  onClick={() => { setDetachError(null); setDetaching(g); }}
                  className="absolute right-2.5 top-2.5 z-10 rounded-control p-1.5 text-ink-faint opacity-0 transition-all hover:bg-rose-soft hover:text-rose focus-visible:opacity-100 group-hover:opacity-100"
                  aria-label={t("detach")}
                  title={t("detach")}
                >
                  <Icon icon={X} size={15} />
                </button>
                <button onClick={() => navigate(`/teach/groups/${g.groupId}`)} className="flex flex-col gap-3 text-left">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-[16px] font-bold text-ink">{g.name}</h3>
                      <p className="truncate text-[13px] text-ink-faint">
                        {t("yearN", { n: g.yearOfStudy })} · {g.facultyName}
                      </p>
                    </div>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-deep">
                      <Icon icon={Users2} size={18} />
                    </div>
                  </div>
                  <div className="mt-auto space-y-1.5">
                    <div className="flex items-center justify-between text-[13.5px] text-ink-soft">
                      <span className="inline-flex items-center gap-1.5"><Icon icon={GraduationCap} size={14} /> {t("studentsN", { n: g.studentCount })}</span>
                      <span className="font-semibold text-ink">{g.avgProgress}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-pill bg-bg">
                      <div className="h-full rounded-pill bg-gradient-to-r from-brand to-brand-deep transition-all" style={{ width: `${Math.max(g.avgProgress, 2)}%` }} />
                    </div>
                  </div>
                </button>
              </Card>
            ))}
          </div>
        </AsyncSection>
      )}

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
      <p className="mb-3 text-[13.5px] text-ink-soft">{t("attachHint")}</p>
      {q.isLoading ? (
        <div className="flex h-32 items-center justify-center"><Spinner size={22} /></div>
      ) : rows.length === 0 ? (
        <p className="rounded-control border border-dashed border-line py-8 text-center text-[14px] text-ink-faint">
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
                <p className="truncate text-[14.5px] font-semibold text-ink">{g.name}</p>
                <p className="text-[12.5px] text-ink-faint">{t("yearN", { n: g.yearOfStudy })} · {t("studentsN", { n: g.studentCount })}</p>
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
