import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { BookMarked, Plus, Trash2 } from "lucide-react";
import { Button, Card, Icon, Spinner, useToast } from "@meduni/ui";
import { AsyncSection } from "../../../components/AsyncSection";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { api, apiErrorMessage } from "../../../lib/api";
import { useLocale } from "../../../lib/useLocale";
import { useCreateTerm, useDeleteTerm, type Term } from "../../admin/api";

export function TeachGlossaryPage() {
  const { t } = useTranslation(undefined, { keyPrefix: "glossary" });
  const locale = useLocale();
  const { show } = useToast();
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ termRu: "", termUz: "", termLat: "" });
  const [del, setDel] = useState<Term | null>(null);

  // Backend pins teachers to their own department, so no departmentId needed.
  const q = useQuery({
    queryKey: ["teach-glossary", search],
    queryFn: () => api<Term[]>(`/api/v1/glossary${search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ""}`),
  });
  const create = useCreateTerm();
  const remove = useDeleteTerm();

  const add = () => {
    if (!form.termRu.trim() || !form.termUz.trim()) return;
    create.mutate(
      { departmentId: 0, termRu: form.termRu, termUz: form.termUz, termLat: form.termLat || undefined },
      { onSuccess: () => { show(t("added")); setForm({ termRu: "", termUz: "", termLat: "" }); q.refetch(); }, onError: (e) => show(apiErrorMessage(e, locale) ?? t("dupError")) }
    );
  };

  return (
    <div>
      <h1 className="text-h1 font-bold text-ink">{t("title")}</h1>
      <p className="mt-1 max-w-2xl text-[13px] text-ink-soft">{t("teacherSubtitle")}</p>

      <div className="mt-5">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("search")} className="w-full max-w-sm rounded-control border border-line bg-surface px-3 py-2 text-[13.5px] outline-none focus:border-brand" />
      </div>

      <Card className="mt-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <input value={form.termRu} onChange={(e) => setForm({ ...form, termRu: e.target.value })} placeholder={t("termRu")} className="rounded-control border border-line px-3 py-2 text-[13.5px] outline-none focus:border-brand" />
          <input value={form.termUz} onChange={(e) => setForm({ ...form, termUz: e.target.value })} placeholder={t("termUz")} className="rounded-control border border-line px-3 py-2 text-[13.5px] outline-none focus:border-brand" />
          <input value={form.termLat} onChange={(e) => setForm({ ...form, termLat: e.target.value })} placeholder={t("termLat")} className="rounded-control border border-line px-3 py-2 text-[13.5px] outline-none focus:border-brand" />
          <Button onClick={add} disabled={create.isPending || !form.termRu.trim() || !form.termUz.trim()}><Icon icon={Plus} size={15} /> {t("add")}</Button>
        </div>
      </Card>

      <div className="mt-4">
        {q.isLoading ? <div className="flex justify-center py-10"><Spinner size={24} /></div> : (
          <AsyncSection isLoading={false} isError={q.isError} isEmpty={!!q.data && q.data.length === 0} emptyIcon={<Icon icon={BookMarked} size={22} />} emptyText={t("emptyTeacher")} onRetry={() => q.refetch()}>
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
        onConfirm={() => del && remove.mutate(del.id, { onSuccess: () => { show(t("deleted")); setDel(null); q.refetch(); } })} onClose={() => setDel(null)} />
    </div>
  );
}
