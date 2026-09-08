import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarX2, CheckCheck, RotateCcw, Search, Smartphone } from "lucide-react";
import { Button, Icon, Modal, Num, Spinner, cls, useToast } from "@meduni/ui";
import { useCancelLesson, useMarkByDate, useRosterByDate, type AttStatus } from "../../api";
import { STATUS_META, STATUSES } from "./meta";

/** ISO → "HH:MM" (talaba o'zi belgilagan vaqt chipi uchun). */
const hhmm = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/** Yo'qlama — (kurs, sana, VAQT) bo'yicha. Sessiya birinchi belgilashda AVTO
 *  yaratiladi (o'qituvchi qo'lda "yangi mashg'ulot" yaratmaydi).
 *
 *  F2 (2026-09-08): shapkada dars PASPORTI — tur va akademik SOAT. Soat bejiz
 *  emas: davomat limiti darsda emas, soatda hisoblanadi (VM №824). Va "Dars
 *  bo'lmadi" tugmasi — talabaning aybi bo'lmagan dars maxrajdan chiqadi. */
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
  const cancel = useCancelLesson();
  const [marks, setMarks] = useState<Record<number, AttStatus | null>>({});
  const [search, setSearch] = useState("");
  const [reason, setReason] = useState("");
  const [askCancel, setAskCancel] = useState(false);

  useEffect(() => {
    if (rosterQ.data) setMarks(Object.fromEntries(rosterQ.data.students.map((s) => [s.id, s.status])));
  }, [rosterQ.data?.date]);

  const students = rosterQ.data?.students ?? [];
  const filtered = useMemo(
    () => (search.trim() ? students.filter((s) => s.fullName.toLowerCase().includes(search.trim().toLowerCase())) : students),
    [students, search]
  );
  const markedCount = Object.values(marks).filter((v) => v !== null).length;
  const countOf = (st: AttStatus) => Object.values(marks).filter((v) => v === st).length;
  const lesson = rosterQ.data?.lesson;
  const cancelled = lesson?.cancelled ?? false;

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
        <p className="py-6 text-center text-note text-rose">{t("loadError")}</p>
      ) : (
        <>
          {/* DARS PASPORTI: o'qituvchi nimani belgilayotganini aniq bilsin —
              tur va SOAT (soat davomat limitiga tushadi), xona, mavzu. */}
          <div className="mb-4 flex flex-col gap-3">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div className="min-w-0">
                <div className="truncate text-note font-semibold text-ink">{heading}</div>
                {lesson && (
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-pill bg-brand-soft px-2 py-0.5 text-micro font-semibold text-brand-deep">
                      {t(`type${lesson.lessonType}`)}
                    </span>
                    <span className="rounded-pill bg-bg px-2 py-0.5 text-micro font-semibold text-ink-soft">
                      {t("hoursN", { n: lesson.hours })}
                    </span>
                    {lesson.room && <span className="rounded-pill bg-bg px-2 py-0.5 text-micro text-ink-soft">{lesson.room}</span>}
                    {lesson.topicTitle && <span className="truncate text-micro text-ink-faint">{lesson.topicTitle}</span>}
                  </div>
                )}
              </div>
              {!cancelled && (
                <Button variant="soft" size="md" onClick={allPresent} className="w-full font-bold sm:w-auto">
                  <Icon icon={CheckCheck} size={18} /> {t("allPresent")}
                </Button>
              )}
            </div>

            {/* "Dars bo'lmadi" — talabaning aybi emas: maxrajdan chiqadi. */}
            {cancelled ? (
              <div className="flex flex-wrap items-center gap-2 rounded-card border border-line bg-bg px-3 py-2.5">
                <Icon icon={CalendarX2} size={16} className="text-ink-soft" />
                <span className="min-w-0 flex-1 text-note text-ink-soft">
                  {t("cancelledBanner")}
                  {lesson?.cancelReason ? ` · ${lesson.cancelReason}` : ""}
                </span>
                <Button variant="ghost" size="sm" onClick={() => cancel.mutate({ courseId, date, startTime, groupId, cancelled: false })}>
                  <Icon icon={RotateCcw} size={14} /> {t("restoreLesson")}
                </Button>
              </div>
            ) : askCancel ? (
              <div className="flex flex-wrap items-center gap-2 rounded-card border border-line bg-bg px-3 py-2.5">
                <input
                  autoFocus
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t("cancelReasonPh")}
                  className="min-w-0 flex-1 rounded-control border border-line bg-surface px-3 py-1.5 text-note outline-none focus:border-brand"
                />
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    cancel.mutate({ courseId, date, startTime, groupId, cancelled: true, reason });
                    setAskCancel(false);
                  }}
                >
                  {t("cancelLesson")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAskCancel(false)}>{t("close")}</Button>
              </div>
            ) : (
              <button
                onClick={() => setAskCancel(true)}
                className="self-start rounded-control text-micro font-semibold text-ink-faint transition-colors hover:text-rose focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                {t("cancelLesson")}
              </button>
            )}
          </div>

          {!cancelled && (
            <div className="relative mb-4">
              <Icon icon={Search} size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("searchStudent")}
                className="w-full rounded-control border-2 border-line bg-surface py-2.5 pl-10 pr-4 text-body outline-none transition-all focus:border-brand focus:ring-4 focus:ring-brand/10"
              />
            </div>
          )}

          <div className={cls("max-h-[50vh] space-y-2 overflow-y-auto pr-1", cancelled && "pointer-events-none opacity-45")}>
            {filtered.map((st) => (
              <div key={st.id} className="flex flex-col gap-2 rounded-[12px] border border-line bg-surface p-3 transition-all hover:border-brand/30 sm:flex-row sm:items-center sm:gap-3">
                <span className="min-w-0 flex-1 truncate pl-1 text-body font-bold text-ink">
                  {st.fullName}
                  {st.selfMarked && (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-pill bg-blue-soft px-2 py-0.5 align-middle text-micro font-semibold text-blue">
                      <Icon icon={Smartphone} size={11} />
                      {t("selfMarked")}
                      {st.markedAt ? ` · ${hhmm(st.markedAt)}` : ""}
                    </span>
                  )}
                </span>
                <div className="flex shrink-0 gap-1.5">
                  {STATUSES.map((status) => {
                    const on = marks[st.id] === status;
                    const meta = STATUS_META[status];
                    return (
                      <button
                        key={status}
                        onClick={() => setOne(st.id, status)}
                        className={cls(
                          "flex-1 rounded-[8px] border-2 px-3 py-2.5 text-note font-black transition-all active:scale-95 sm:flex-none sm:px-5 sm:py-2",
                          on ? `${meta.solid} scale-[1.02] border-transparent` : "border-line bg-surface text-ink-soft hover:bg-bg hover:text-ink"
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

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-pill bg-bg px-3 py-1 text-note font-medium text-ink-soft">
                {t("markedOf", { marked: markedCount, total: students.length })}
              </span>
              {!cancelled && countOf("PRESENT") > 0 && (
                <span className="rounded-pill bg-emerald-soft px-2.5 py-1 text-micro font-semibold text-emerald">
                  <Num>{countOf("PRESENT")}</Num> {t("status.PRESENT").toLowerCase()}
                </span>
              )}
              {!cancelled && countOf("ABSENT") > 0 && (
                <span className="rounded-pill bg-rose-soft px-2.5 py-1 text-micro font-semibold text-rose">
                  <Num>{countOf("ABSENT")}</Num> {t("status.ABSENT").toLowerCase()}
                </span>
              )}
              {!cancelled && countOf("LATE") > 0 && (
                <span className="rounded-pill bg-amber-soft px-2.5 py-1 text-micro font-semibold text-amber">
                  <Num>{countOf("LATE")}</Num> {t("status.LATE").toLowerCase()}
                </span>
              )}
            </span>
            <Button variant="ghost" onClick={onClose} size="md" className="font-bold">{t("close")}</Button>
          </div>
        </>
      )}
    </Modal>
  );
}
