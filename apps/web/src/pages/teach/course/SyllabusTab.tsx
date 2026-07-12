import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BookText, Clock, Plus, Target, Trash2 } from "lucide-react";
import { Button, Card, Icon, Spinner, useToast } from "@meduni/ui";
import { useLocale } from "../../../lib/useLocale";
import { useSaveSyllabus, useSyllabus, type SyllabusTopic } from "../api";

function EditableList({ items, onChange, accent, placeholder, addLabel }: { items: string[]; onChange: (v: string[]) => void; accent: string; placeholder: string; addLabel: string }) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${accent}`} />
          <input value={item} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} placeholder={placeholder} className="flex-1 rounded-control border border-line px-3 py-2 text-[13.5px] outline-none focus:border-brand" />
          <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="rounded-control p-1.5 text-ink-faint hover:bg-rose-soft hover:text-rose"><Icon icon={Trash2} size={15} /></button>
        </div>
      ))}
      <button onClick={() => onChange([...items, ""])} className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-deep hover:underline">
        <Icon icon={Plus} size={14} /> {addLabel}
      </button>
    </div>
  );
}

export function SyllabusTab() {
  const { id } = useParams();
  const courseId = Number(id);
  const { t } = useTranslation(undefined, { keyPrefix: "syllabus" });
  const locale = useLocale();
  const { show } = useToast();
  const q = useSyllabus(courseId);
  const save = useSaveSyllabus(courseId);

  const [description, setDescription] = useState("");
  const [objectives, setObjectives] = useState<string[]>([]);
  const [literature, setLiterature] = useState<string[]>([]);
  const [topics, setTopics] = useState<SyllabusTopic[]>([]);

  useEffect(() => {
    if (q.data) {
      setDescription(q.data.description);
      setObjectives(q.data.objectives);
      setLiterature(q.data.literature);
      setTopics(q.data.topics);
    }
  }, [q.data]);

  const totalHours = topics.reduce((s, t) => s + (Number(t.hours) || 0), 0);
  const setTopic = (tid: number, p: Partial<SyllabusTopic>) => setTopics((ts) => ts.map((x) => (x.id === tid ? { ...x, ...p } : x)));

  const onSave = () =>
    save.mutate(
      { description, objectives, literature, topics: topics.map((t) => ({ id: t.id, hours: Number(t.hours) || 0, note: t.note })) },
      { onSuccess: () => show(t("saved")) }
    );

  if (q.isLoading) return <div className="flex min-h-[30vh] items-center justify-center"><Spinner size={24} /></div>;
  if (q.isError || !q.data) return <Card><p className="py-6 text-center text-[13.5px] text-rose">{t("loadError")}</p></Card>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-ink-soft">{t("subtitle")}</p>
        <span className="inline-flex items-center gap-1.5 rounded-pill bg-brand-soft px-3 py-1 text-[13px] font-semibold text-brand-deep">
          <Icon icon={Clock} size={15} /> {t("totalHours")}: {totalHours}
        </span>
      </div>

      {/* Course-level */}
      <Card className="space-y-5">
        <div>
          <h3 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-ink-soft">{t("description")}</h3>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("descriptionPlaceholder")} rows={3} className="w-full rounded-control border border-line px-3 py-2 text-[13.5px] outline-none focus:border-brand" />
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wide text-ink-soft"><Icon icon={Target} size={14} /> {t("objectives")}</h3>
            <EditableList items={objectives} onChange={setObjectives} accent="bg-brand" placeholder={t("objectivePlaceholder")} addLabel={t("addObjective")} />
          </div>
          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wide text-ink-soft"><Icon icon={BookText} size={14} /> {t("literature")}</h3>
            <EditableList items={literature} onChange={setLiterature} accent="bg-violet" placeholder={t("literaturePlaceholder")} addLabel={t("addLiterature")} />
          </div>
        </div>
      </Card>

      {/* Topics table */}
      <div>
        <h3 className="mb-2 text-section font-bold text-ink">{t("topicsPlan")}</h3>
        {topics.length === 0 ? (
          <Card><p className="py-6 text-center text-[13.5px] text-ink-soft">{t("noTopics")}</p></Card>
        ) : (
          <div className="overflow-x-auto rounded-card border border-line">
            <table className="w-full border-collapse text-[13.5px]">
              <thead>
                <tr className="border-b border-line bg-bg text-left text-[12px] font-bold uppercase text-ink-faint">
                  <th className="w-10 px-3 py-2.5">№</th>
                  <th className="px-3 py-2.5">{t("topic")}</th>
                  <th className="w-24 px-3 py-2.5">{t("hours")}</th>
                  <th className="px-3 py-2.5">{t("note")}</th>
                </tr>
              </thead>
              <tbody>
                {topics.map((tp, i) => (
                  <tr key={tp.id} className="border-b border-line last:border-0">
                    <td className="px-3 py-2 text-ink-soft">{i + 1}</td>
                    <td className="px-3 py-2 font-medium text-ink">{locale === "ru" ? tp.titleRu : tp.titleUz}</td>
                    <td className="px-3 py-2">
                      <input type="number" min={0} value={tp.hours} onChange={(e) => setTopic(tp.id, { hours: Number(e.target.value) })} className="w-16 rounded-control border border-line px-2 py-1 text-[13px] outline-none focus:border-brand" />
                    </td>
                    <td className="px-3 py-2">
                      <input value={tp.note} onChange={(e) => setTopic(tp.id, { note: e.target.value })} placeholder={t("notePlaceholder")} className="w-full rounded-control border border-line px-2 py-1 text-[13px] outline-none focus:border-brand" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={onSave} disabled={save.isPending}>{t("save")}</Button>
        <span className="text-[12px] text-ink-faint">{t("note2")}</span>
      </div>
    </div>
  );
}
