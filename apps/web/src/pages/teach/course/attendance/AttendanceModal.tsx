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

  useEffect(() => {
    if (rosterQ.data) setMarks(Object.fromEntries(rosterQ.data.students.map((s) => [s.id, s.status])));
  }, [rosterQ.data?.session.id]);

  const students = rosterQ.data?.students ?? [];
  const filtered = useMemo(
    () => (search.trim() ? students.filter((s) => s.fullName.toLowerCase().includes(search.trim().toLowerCase())) : students),
    [students, search]
  );
  const markedCount = Object.values(marks).filter((v) => v !== null).length;

  const toggleMark = (stId: number, status: AttStatus) => {
    setMarks((m) => ({ ...m, [stId]: status }));
    mark.mutate(
      { sessionId, marks: [{ studentId: stId, status }] },
      { onError: () => {
          show(t("saveFailed"));
          // Revert optimistic update on error if needed
        } 
      }
    );
  };

  const allPresent = () => {
    setMarks(Object.fromEntries(students.map((s) => [s.id, "PRESENT" as AttStatus])));
    const payload = students.map((s) => ({ studentId: s.id, status: "PRESENT" as AttStatus }));
    mark.mutate({ sessionId, marks: payload }, { onError: () => show(t("saveFailed")) });
  };

  const s = rosterQ.data?.session;

  return (
    <Modal open onClose={onClose} title={t("markTitle")} className="max-w-3xl">
      {rosterQ.isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center"><Spinner size={24} /></div>
      ) : rosterQ.isError || !rosterQ.data ? (
        <p className="py-6 text-center text-[14.5px] text-rose">{t("loadError")}</p>
      ) : (
        <>
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-[14px] text-ink-soft">
              <span className="font-semibold text-ink">{s && fmtDate(s.date, locale)}</span>
              {s?.title && ` · ${s.title}`}
              {s?.groupName && ` · ${s.groupName}`}
            </div>
            <Button variant="soft" size="md" onClick={allPresent} className="w-full sm:w-auto font-bold text-[14px]">
              <Icon icon={CheckCheck} size={18} /> {t("allPresent")}
            </Button>
          </div>

          <div className="relative mb-4">
            <Icon icon={Search} size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchStudent")} className="w-full rounded-control border-2 border-line bg-surface py-2.5 pl-10 pr-4 text-[15px] outline-none transition-all focus:border-brand focus:ring-4 focus:ring-brand/10" />
          </div>

          <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
            {filtered.map((st) => (
              <div key={st.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-[12px] border border-line bg-surface p-3 transition-all hover:border-brand/30 hover:shadow-sm">
                <span className="truncate text-[15.5px] font-bold text-ink pl-1">{st.fullName}</span>
                <div className="flex w-full sm:w-auto shrink-0 gap-1.5">
                  {STATUSES.map((status) => {
                    const on = marks[st.id] === status;
                    const meta = STATUS_META[status];
                    return (
                      <button
                        key={status}
                        onClick={() => toggleMark(st.id, status)}
                        className={cls(
                          "flex-1 sm:flex-none rounded-[8px] border-2 px-3 sm:px-5 py-2.5 sm:py-2 text-[14px] font-black transition-all transform active:scale-95",
                          on 
                            ? `${meta.solid} border-transparent shadow-[0_2px_10px_rgba(0,0,0,0.1)] scale-[1.02]` 
                            : `bg-surface border-line text-ink-soft hover:bg-bg hover:border-line-heavy hover:text-ink`
                        )}
                      >
                        {t(`status.${status}`)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between gap-2 border-t border-line pt-4">
            <span className="text-[14.5px] font-medium text-ink-soft bg-bg px-3 py-1 rounded-pill">
              {t("markedOf", { marked: markedCount, total: students.length })}
            </span>
            <Button variant="ghost" onClick={onClose} size="md" className="font-bold text-[15px]">{t("cancel")} / {t("close")}</Button>
          </div>
        </>
      )}
    </Modal>
  );
}
