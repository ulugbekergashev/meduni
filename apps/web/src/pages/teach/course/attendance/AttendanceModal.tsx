import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCheck, Search } from "lucide-react";
import { Button, Icon, Modal, Spinner, cls, useToast } from "@meduni/ui";
import { useLocale } from "../../../../lib/useLocale";
import { useMarkAttendance, useRoster, type AttStatus } from "../../api";
import { STATUS_META, STATUSES, fmtDate } from "./meta";

export function AttendanceModal({ courseId, sessionId, groupId, onClose }: { courseId: number; sessionId: number; groupId?: number; onClose: () => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "attendance" });
  const locale = useLocale();
  const { show } = useToast();
  const rosterQ = useRoster(sessionId, groupId);
  const mark = useMarkAttendance(courseId);
  const [marks, setMarks] = useState<Record<number, AttStatus | null>>({});
  const [search, setSearch] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (rosterQ.data) setMarks(Object.fromEntries(rosterQ.data.students.map((s) => [s.id, s.status])));
  }, [rosterQ.data?.session.id]);

  const students = rosterQ.data?.students ?? [];
  const filtered = useMemo(
    () => (search.trim() ? students.filter((s) => s.fullName.toLowerCase().includes(search.trim().toLowerCase())) : students),
    [students, search]
  );
  const markedCount = Object.values(marks).filter((v) => v !== null).length;

  const allPresent = () => setMarks(Object.fromEntries(students.map((s) => [s.id, "PRESENT" as AttStatus])));

  const save = () => {
    const payload = Object.entries(marks).filter(([, v]) => v !== null).map(([id, status]) => ({ studentId: Number(id), status: status! }));
    mark.mutate(
      { sessionId, marks: payload },
      { onSuccess: () => { show(t("saved")); onClose(); }, onError: () => setErr(t("saveFailed")) }
    );
  };

  const s = rosterQ.data?.session;

  return (
    <Modal open onClose={onClose} title={t("markTitle")} className="max-w-2xl">
      {rosterQ.isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center"><Spinner size={24} /></div>
      ) : rosterQ.isError || !rosterQ.data ? (
        <p className="py-6 text-center text-[14.5px] text-rose">{t("loadError")}</p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-[14px] text-ink-soft">
              <span className="font-semibold text-ink">{s && fmtDate(s.date, locale)}</span>
              {s?.title && ` · ${s.title}`}
              {s?.groupName && ` · ${s.groupName}`}
            </div>
            <Button variant="soft" size="sm" onClick={allPresent}>
              <Icon icon={CheckCheck} size={15} /> {t("allPresent")}
            </Button>
          </div>

          <div className="relative mb-3">
            <Icon icon={Search} size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchStudent")} className="w-full rounded-control border border-line bg-surface py-2 pl-9 pr-3 text-[14.5px] outline-none focus:border-brand" />
          </div>

          <div className="max-h-[45vh] space-y-1.5 overflow-y-auto">
            {filtered.map((st) => (
              <div key={st.id} className="flex items-center justify-between gap-2 rounded-control border border-line px-3 py-2">
                <span className="truncate text-[14.5px] font-medium text-ink">{st.fullName}</span>
                <div className="flex shrink-0 gap-1">
                  {STATUSES.map((status) => {
                    const on = marks[st.id] === status;
                    const meta = STATUS_META[status];
                    return (
                      <button
                        key={status}
                        onClick={() => setMarks((m) => ({ ...m, [st.id]: status }))}
                        className={cls("rounded-control border px-2 py-1 text-[12.5px] font-semibold transition-all", on ? meta.solid : `bg-surface ${meta.ring} opacity-60 hover:opacity-100`)}
                      >
                        {t(`status.${status}`)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {err && <p className="mt-2 text-[13.5px] font-medium text-rose">{err}</p>}

          <div className="mt-4 flex items-center justify-between gap-2">
            <span className="text-[13.5px] text-ink-faint">{t("markedOf", { marked: markedCount, total: students.length })}</span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose} disabled={mark.isPending}>{t("cancel")}</Button>
              <Button onClick={save} disabled={mark.isPending}>{t("save")}</Button>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
