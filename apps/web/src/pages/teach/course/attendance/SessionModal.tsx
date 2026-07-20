import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Modal, useToast } from "@meduni/ui";
import { useCreateSession, useUpdateSession, type SessionRow } from "../../api";
import { useTopics } from "../../topics/api";

export function SessionModal({ courseId, edit, onClose }: { courseId: number; edit: SessionRow | null; onClose: () => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "attendance" });
  const { show } = useToast();
  const topics = useTopics({ courseId });
  const create = useCreateSession(courseId);
  const update = useUpdateSession(courseId);

  const [date, setDate] = useState(edit ? new Date(edit.date).toISOString().slice(0, 10) : "");
  const [mode, setMode] = useState<"text" | "topic">(edit?.topicId ? "topic" : "text");
  const [title, setTitle] = useState(edit && !edit.topicId ? edit.title ?? "" : "");
  const [topicId, setTopicId] = useState<number | "">(edit?.topicId ?? "");
  const [room, setRoom] = useState(edit?.room ?? "");
  const [err, setErr] = useState<string | null>(null);

  const busy = create.isPending || update.isPending;

  const submit = () => {
    if (!date) { setErr(t("dateRequired")); return; }
    const body = {
      date,
      title: mode === "text" ? title.trim() || undefined : undefined,
      topicId: mode === "topic" ? (topicId ? Number(topicId) : null) : null,
      room: room.trim() || undefined,
    };
    const onSuccess = () => { show(t("saved")); onClose(); };
    if (edit) update.mutate({ id: edit.id, ...body }, { onSuccess, onError: () => setErr(t("saveFailed")) });
    else create.mutate(body, { onSuccess, onError: () => setErr(t("saveFailed")) });
  };

  return (
    <Modal open onClose={onClose} title={edit ? t("editSession") : t("newSession")}>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-[13.5px] font-semibold text-ink-soft">{t("date")} *</label>
          <input type="date" value={date} onChange={(e) => { setDate(e.target.value); setErr(null); }} className="w-full rounded-control border border-line px-3 py-2 text-[14.5px] outline-none focus:border-brand" />
        </div>

        <div>
          <div className="mb-1 flex items-center gap-3 text-[13.5px] font-semibold text-ink-soft">
            <span>{t("lessonTitle")}</span>
            <button onClick={() => setMode("text")} className={mode === "text" ? "text-brand-deep underline" : "text-ink-faint"}>{t("asText")}</button>
            <button onClick={() => setMode("topic")} className={mode === "topic" ? "text-brand-deep underline" : "text-ink-faint"}>{t("fromTopic")}</button>
          </div>
          {mode === "text" ? (
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("titlePlaceholder")} className="w-full rounded-control border border-line px-3 py-2 text-[14.5px] outline-none focus:border-brand" />
          ) : (
            <select value={topicId} onChange={(e) => setTopicId(e.target.value ? Number(e.target.value) : "")} className="w-full rounded-control border border-line bg-surface px-3 py-2 text-[14.5px] outline-none focus:border-brand">
              <option value="">{t("selectTopic")}</option>
              {(topics.data ?? []).map((tp) => (
                <option key={tp.id} value={tp.id}>{tp.title}</option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="mb-1 block text-[13.5px] font-semibold text-ink-soft">{t("room")}</label>
          <input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="302" className="w-full rounded-control border border-line px-3 py-2 text-[14.5px] outline-none focus:border-brand" />
        </div>

        {err && <p className="text-[13.5px] font-medium text-rose">{err}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>{t("cancel")}</Button>
          <Button onClick={submit} disabled={busy}>{t("save")}</Button>
        </div>
      </div>
    </Modal>
  );
}
