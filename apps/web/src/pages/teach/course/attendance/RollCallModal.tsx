import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCheck, Search } from "lucide-react";
import { Button, Icon, Modal, Spinner, cls, useToast } from "@meduni/ui";
import { useMarkByDate, useRosterByDate, type AttStatus } from "../../api";
import { STATUS_META, STATUSES } from "./meta";

/** Yo'qlama — (kurs, sana) bo'yicha. Sessiya birinchi belgilashda AVTO yaratiladi
 *  (o'qituvchi qo'lda "yangi mashg'ulot" yaratmaydi). */
export function RollCallModal({
  courseId,
  date,
  startTime,
  groupId,
  heading,
  onClose,
}: {
  courseId: number;
  date: string; // YYYY-MM-DD
  startTime?: string;
  groupId?: number;
  heading: string;
  onClose: () => void;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "attendance" });
  const { show } = useToast();
  // Vaqt ham uzatiladi: bir kunda bir necha dars bo'lsa, har biri O'Z sessiyasini oladi.
  const rosterQ = useRosterByDate(courseId, date, groupId, startTime);
  const mark = useMarkByDate();
  const [marks, setMarks] = useState<Record<number, AttStatus | null>>({});
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (rosterQ.data) setMarks(Object.fromEntries(rosterQ.data.students.map((s) => [s.id, s.status])));
  }, [rosterQ.data?.date]);

  const students = rosterQ.data?.students ?? [];
  const filtered = useMemo(
    () => (search.trim() ? students.filter((s) => s.fullName.toLowerCase().includes(search.trim().toLowerCase())) : students),
    [students, search]
  );
  const markedCount = Object.values(marks).filter((v) => v !== null).length;

  const setOne = (stId: number, status: AttStatus) => {
    setMarks((m) => ({ ...m, [stId]: status }));
    mark.mutate({ courseId, date, startTime, groupId, marks: [{ studentId: stId, status }] }, { onError: () => show(t("saveFailed")) });
  };
  const allPresent = () => {
    setMarks(Object.fromEntries(students.map((s) => [s.id, "PRESENT" as AttStatus])));
    mark.mutate({ courseId, date, startTime, groupId, marks: students.map((s) => ({ studentId: s.id, status: "PRESENT" as AttStatus })) }, { onError: () => show(t("saveFailed")) });
  };

  return (
    <Modal open onClose={onClose} title={t("markTitle")} className="max-w-3xl">
      {rosterQ.isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center"><Spinner size={24} /></div>
      ) : rosterQ.isError || !rosterQ.data ? (
        <p className="py-6 text-center text-[14.5px] text-rose">{t("loadError")}</p>
      ) : (
        <>
          <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="text-[14px] font-semibold text-ink">{heading}</div>
            <Button variant="soft" size="md" onClick={allPresent} className="w-full font-bold sm:w-auto">
              <Icon icon={CheckCheck} size={18} /> {t("allPresent")}
            </Button>
          </div>

          <div className="relative mb-4">
            <Icon icon={Search} size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchStudent")} className="w-full rounded-control border-2 border-line bg-surface py-2.5 pl-10 pr-4 text-[15px] outline-none transition-all focus:border-brand focus:ring-4 focus:ring-brand/10" />
          </div>

          <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
            {filtered.map((st) => (
              <div key={st.id} className="flex flex-col gap-2 rounded-[12px] border border-line bg-surface p-3 transition-all hover:border-brand/30 sm:flex-row sm:items-center sm:gap-3">
                <span className="min-w-0 flex-1 truncate pl-1 text-[15.5px] font-bold text-ink">{st.fullName}</span>
                <div className="flex shrink-0 gap-1.5">
                  {STATUSES.map((status) => {
                    const on = marks[st.id] === status;
                    const meta = STATUS_META[status];
                    return (
                      <button
                        key={status}
                        onClick={() => setOne(st.id, status)}
                        className={cls(
                          "flex-1 rounded-[8px] border-2 px-3 py-2.5 text-[14px] font-black transition-all active:scale-95 sm:flex-none sm:px-5 sm:py-2",
                          on ? `${meta.solid} scale-[1.02] border-transparent shadow-sm` : "border-line bg-surface text-ink-soft hover:bg-bg hover:text-ink"
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
            <span className="rounded-pill bg-bg px-3 py-1 text-[14.5px] font-medium text-ink-soft">
              {t("markedOf", { marked: markedCount, total: students.length })}
            </span>
            <Button variant="ghost" onClick={onClose} size="md" className="font-bold">{t("close")}</Button>
          </div>
        </>
      )}
    </Modal>
  );
}
