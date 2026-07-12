import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BookMarked, Plus, Trash2, Upload } from "lucide-react";
import { Button, Card, Icon, Spinner, useToast } from "@meduni/ui";
import { AsyncSection } from "../../../components/AsyncSection";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { apiErrorMessage } from "../../../lib/api";
import { useLocale, pickName } from "../../../lib/useLocale";
import { API_URL, useCreateTerm, useDeleteTerm, useDepartments, useGlossary, type Term } from "../api";

export function GlossaryPage() {
  const { t } = useTranslation(undefined, { keyPrefix: "glossary" });
  const locale = useLocale();
  const { show } = useToast();
  const depts = useDepartments();
  const [deptId, setDeptId] = useState<number | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ termRu: "", termUz: "", termLat: "" });
  const [del, setDel] = useState<Term | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (deptId === undefined && depts.data?.length) setDeptId(depts.data[0].id); }, [depts.data]);

  const q = useGlossary(deptId, search);
  const create = useCreateTerm();
  const remove = useDeleteTerm();

  const add = () => {
    if (!deptId || !form.termRu.trim() || !form.termUz.trim()) return;
    create.mutate(
      { departmentId: deptId, termRu: form.termRu, termUz: form.termUz, termLat: form.termLat || undefined },
      { onSuccess: () => { show(t("added")); setForm({ termRu: "", termUz: "", termLat: "" }); }, onError: (e) => show(apiErrorMessage(e, locale) ?? t("dupError")) }
    );
  };

  const doImport = async (file: File) => {
    if (!deptId) return;
    setImporting(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("departmentId", String(deptId));
    try {
      const res = await fetch(`${API_URL}/api/v1/glossary/import`, { method: "POST", credentials: "include", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error();
      show(t("imported", { added: json.added, skipped: json.skipped }));
      q.refetch();
    } catch { show(t("importError")); } finally { setImporting(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  return (
    <div>
      <h1 className="text-h1 font-bold text-ink">{t("title")}</h1>
      <p className="mt-1 max-w-2xl text-[13px] text-ink-soft">{t("subtitle")}</p>

      {/* Controls */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <select value={deptId ?? ""} onChange={(e) => setDeptId(Number(e.target.value))} className="rounded-control border border-line bg-surface px-2 py-2 text-[13px] outline-none focus:border-brand">
          {(depts.data ?? []).map((d) => <option key={d.id} value={d.id}>{pickName(locale, d.nameUz, d.nameRu)}</option>)}
        </select>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("search")} className="min-w-[160px] flex-1 rounded-control border border-line bg-surface px-3 py-2 text-[13.5px] outline-none focus:border-brand" />
        <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])} />
        <Button variant="ghost" onClick={() => fileRef.current?.click()} disabled={importing || !deptId}>
          {importing ? <Spinner size={14} /> : <Icon icon={Upload} size={15} />} {t("import")}
        </Button>
      </div>

      {/* Add form */}
      <Card className="mt-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <input value={form.termRu} onChange={(e) => setForm({ ...form, termRu: e.target.value })} placeholder={t("termRu")} className="rounded-control border border-line px-3 py-2 text-[13.5px] outline-none focus:border-brand" />
          <input value={form.termUz} onChange={(e) => setForm({ ...form, termUz: e.target.value })} placeholder={t("termUz")} className="rounded-control border border-line px-3 py-2 text-[13.5px] outline-none focus:border-brand" />
          <input value={form.termLat} onChange={(e) => setForm({ ...form, termLat: e.target.value })} placeholder={t("termLat")} className="rounded-control border border-line px-3 py-2 text-[13.5px] outline-none focus:border-brand" />
          <Button onClick={add} disabled={create.isPending || !form.termRu.trim() || !form.termUz.trim()}><Icon icon={Plus} size={15} /> {t("add")}</Button>
        </div>
      </Card>

      {/* Table */}
      <div className="mt-4">
        {q.isLoading ? <div className="flex justify-center py-10"><Spinner size={24} /></div> : (
          <AsyncSection isLoading={false} isError={q.isError} isEmpty={!!q.data && q.data.length === 0} emptyIcon={<Icon icon={BookMarked} size={22} />} emptyText={t("empty")} onRetry={() => q.refetch()}>
            <div className="overflow-x-auto rounded-card border border-line">
              <table className="w-full border-collapse text-[13.5px]">
                <thead>
                  <tr className="border-b border-line bg-bg text-left text-[12px] font-bold uppercase text-ink-faint">
                    <th className="px-3 py-2.5">{t("termRu")}</th><th className="px-3 py-2.5">{t("termUz")}</th><th className="px-3 py-2.5">{t("termLat")}</th><th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {q.data?.map((term) => (
                    <tr key={term.id} className="border-b border-line last:border-0 hover:bg-bg">
                      <td className="px-3 py-2.5 text-ink">{term.termRu}</td>
                      <td className="px-3 py-2.5 font-medium text-ink">{term.termUz}</td>
                      <td className="px-3 py-2.5 italic text-ink-soft">{term.termLat ?? "—"}</td>
                      <td className="px-3 py-2.5"><button onClick={() => setDel(term)} className="rounded-control p-1.5 text-ink-faint hover:bg-rose-soft hover:text-rose"><Icon icon={Trash2} size={15} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AsyncSection>
        )}
      </div>

      <ConfirmDialog open={del !== null} title={t("deleteTitle")} message={t("deleteConfirm", { term: del?.termUz })} loading={remove.isPending}
        onConfirm={() => del && remove.mutate(del.id, { onSuccess: () => { show(t("deleted")); setDel(null); } })} onClose={() => setDel(null)} />
    </div>
  );
}
