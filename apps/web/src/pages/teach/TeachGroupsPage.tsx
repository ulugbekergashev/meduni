import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { GraduationCap, Plus, Search, Users2 } from "lucide-react";
import { Button, Card, Icon, Input, Modal, Select, useToast } from "@meduni/ui";
import { AsyncSection } from "../../components/AsyncSection";
import { Field } from "../../components/Field";
import { apiErrorMessage } from "../../lib/api";
import { useLocale } from "../../lib/useLocale";
import { useCreateTeacherGroup, useTeachGroups } from "./api";

/** O'qituvchi yangi guruh yaratadi (o'z fakultetida). */
function NewGroupModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "teach" });
  const { t: tc } = useTranslation(undefined, { keyPrefix: "common" });
  const locale = useLocale();
  const { show } = useToast();
  const create = useCreateTeacherGroup();
  const [name, setName] = useState("");
  const [year, setYear] = useState("3");
  const [err, setErr] = useState<string | null>(null);

  return (
    <Modal open onClose={onClose} title={t("newGroupTitle")}>
      <div className="space-y-4">
        <Field label={t("groupNameLabel")}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("groupNamePlaceholder")} autoFocus />
        </Field>
        <Field label={t("groupYear")}>
          <Select value={year} onChange={(e) => setYear(e.target.value)}>
            {[1, 2, 3, 4, 5, 6].map((y) => (<option key={y} value={y}>{t("yearN", { n: y })}</option>))}
          </Select>
        </Field>
        {err && <p className="text-[14px] text-rose">{err}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{tc("cancel")}</Button>
          <Button
            disabled={create.isPending || !name.trim()}
            onClick={() =>
              create.mutate(
                { name: name.trim(), yearOfStudy: Number(year) },
                { onSuccess: () => { show(tc("added")); onClose(); }, onError: (e) => setErr(apiErrorMessage(e, locale) ?? tc("genericError")) }
              )
            }
          >
            {tc("add")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// Group cards with search — click opens the group profile (schedule/roll-call).
export function TeachGroupsPage() {
  const { t } = useTranslation(undefined, { keyPrefix: "groups" });
  const { t: tc } = useTranslation(undefined, { keyPrefix: "teach" });
  const navigate = useNavigate();
  const q = useTeachGroups();
  const groups = q.data ?? [];
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return groups;
    return groups.filter(
      (g) =>
        g.name.toLowerCase().includes(needle) ||
        g.facultyName.toLowerCase().includes(needle) ||
        g.courses.some((c) => c.name.toLowerCase().includes(needle))
    );
  }, [groups, search]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-h1 font-bold text-ink">{t("title")}</h1>
          <p className="mt-1 text-[14px] text-ink-soft">{t("subtitle")}</p>
        </div>
        <Button icon={<Icon icon={Plus} size={16} />} onClick={() => setAddOpen(true)}>{tc("createGroupBtn")}</Button>
      </div>

      {addOpen && <NewGroupModal onClose={() => setAddOpen(false)} />}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Icon icon={Search} size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-full rounded-control border border-line bg-surface py-2 pl-9 pr-3 text-[14.5px] outline-none focus:border-brand"
          />
        </div>
        <span className="text-note font-semibold text-ink-soft">{tc("totalN", { n: filtered.length })}</span>
      </div>

      <div className="mt-4">
        <AsyncSection
          isLoading={q.isLoading}
          isError={q.isError}
          isEmpty={filtered.length === 0}
          emptyIcon={<Icon icon={Users2} size={22} />}
          emptyText={groups.length === 0 ? t("empty") : t("noMatch")}
          onRetry={() => q.refetch()}
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((g) => (
              <Card key={g.id} interactive onClick={() => navigate(`/teach/groups/${g.id}`)} className="flex flex-col gap-3">
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
                <div className="flex flex-wrap gap-1.5">
                  {g.courses.map((c) => (
                    <span key={c.id} className="rounded-pill bg-bg px-2 py-0.5 text-[13px] text-ink-soft">{c.name}</span>
                  ))}
                </div>
                <div className="mt-auto flex items-center gap-1.5 text-[14px] text-ink-soft">
                  <Icon icon={GraduationCap} size={15} /> {t("studentsN", { n: g.studentCount })}
                </div>
              </Card>
            ))}
          </div>
        </AsyncSection>
      </div>
    </div>
  );
}
