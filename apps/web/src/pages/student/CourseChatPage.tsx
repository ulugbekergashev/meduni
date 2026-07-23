import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, GraduationCap, MessagesSquare, SendHorizontal, Users } from "lucide-react";
import { Icon, Spinner, cls } from "@meduni/ui";
import { formatDate } from "../../lib/date";
import { useLocale } from "../../lib/useLocale";
import {
  useCourseChat,
  useCourseChatMeta,
  useMyCourses,
  useSendCourseChat,
  type CourseChatMessage,
  type CourseSummary,
} from "./api";

/** Ismdan initsial (avatar). */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

const hhmm = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/** Chap ustun — kurslar ro'yxati (chat kanallari). */
function CourseList({
  courses,
  activeId,
  onPick,
}: {
  courses: CourseSummary[];
  activeId: number | null;
  onPick: (id: number) => void;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "courseChat" });
  return (
    <div className="flex h-full min-h-0 flex-col rounded-card border border-line bg-surface">
      <div className="flex shrink-0 items-center gap-2 border-b border-line px-3.5 py-3">
        <Icon icon={MessagesSquare} size={16} className="text-brand-tint" />
        <p className="text-section font-extrabold text-ink">{t("title")}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {courses.length === 0 ? (
          <p className="px-2 py-4 text-note text-ink-dim">{t("noCourses")}</p>
        ) : (
          courses.map((c) => {
            const on = c.id === activeId;
            return (
              <button
                key={c.id}
                onClick={() => onPick(c.id)}
                className={cls(
                  "flex w-full items-center gap-2.5 rounded-control px-2 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                  on ? "bg-brand-soft" : "hover:bg-surface-raised"
                )}
              >
                <span
                  className={cls(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-note font-extrabold",
                    on ? "bg-brand text-white" : "bg-surface-raised text-ink-soft"
                  )}
                >
                  {initials(c.subjectName)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cls("block truncate text-note font-bold", on ? "text-brand-tint" : "text-ink")}>
                    {c.subjectName}
                  </span>
                  <span className="block truncate text-micro text-ink-dim">{c.teacherName}</span>
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

/** Bitta xabar puffagi. Guruh chati — begona xabarda ism/rol ko'rsatiladi. */
function Bubble({ m, showAuthor, animate }: { m: CourseChatMessage; showAuthor: boolean; animate: boolean }) {
  const { t } = useTranslation(undefined, { keyPrefix: "courseChat" });
  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16, ease: "easeOut" }}
      className={cls("flex flex-col", m.mine ? "items-end" : "items-start")}
    >
      {showAuthor && !m.mine && (
        <span className="mb-0.5 ml-1 inline-flex items-center gap-1 text-micro font-bold text-ink-faint">
          {m.authorName}
          {m.role === "teacher" && (
            <span className="inline-flex items-center gap-0.5 rounded-pill bg-brand-soft px-1.5 py-px text-[10.5px] font-extrabold text-brand-tint">
              <Icon icon={GraduationCap} size={10} />
              {t("teacherTag")}
            </span>
          )}
        </span>
      )}
      <div
        className={cls(
          "max-w-[78%] whitespace-pre-wrap rounded-card px-3 py-2 text-body leading-relaxed",
          m.mine
            ? "rounded-br-control bg-brand text-white"
            : m.role === "teacher"
              ? "rounded-bl-control border border-brand-soft bg-surface-raised text-ink-strong"
              : "rounded-bl-control bg-surface-raised text-ink-strong"
        )}
      >
        {m.text}
      </div>
      <span className="mt-0.5 px-1 text-[10.5px] tabular-nums text-ink-dim">{hhmm(m.createdAt)}</span>
    </motion.div>
  );
}

/** O'ng ustun — faol kurs chati. */
function ChatView({ courseId, onBack }: { courseId: number; onBack: () => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "courseChat" });
  const locale = useLocale();
  const reduce = useReducedMotion();
  const meta = useCourseChatMeta(courseId).data;
  const chat = useCourseChat(courseId);
  const send = useSendCourseChat(courseId);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const messages = chat.data?.messages ?? [];
  const prevCount = useRef(0);

  // Yangi xabar kelганда pastga skroll (birinchi yuklashda darrov).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const first = prevCount.current === 0;
    prevCount.current = messages.length;
    el.scrollTo({ top: el.scrollHeight, behavior: first || reduce ? "auto" : "smooth" });
  }, [messages.length, reduce]);

  const submit = () => {
    const text = draft.trim();
    if (!text || send.isPending) return;
    send.mutate(text);
    setDraft("");
  };

  // Sanaga qarab "bugun/kecha/sana" ajratgichlar.
  const withDividers = useMemo(() => {
    const out: { divider?: string; msg?: CourseChatMessage; showAuthor?: boolean }[] = [];
    let lastDay = "";
    let lastAuthor = -1;
    for (const m of messages) {
      const day = new Date(m.createdAt).toDateString();
      if (day !== lastDay) {
        out.push({ divider: formatDate(locale === "ru" ? "ru" : "uz", new Date(m.createdAt), "long") });
        lastDay = day;
        lastAuthor = -1;
      }
      out.push({ msg: m, showAuthor: m.authorId !== lastAuthor });
      lastAuthor = m.authorId;
    }
    return out;
  }, [messages, locale]);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-card border border-line bg-surface">
      {/* Shapka */}
      <div className="flex shrink-0 items-center gap-2.5 border-b border-line px-3 py-2.5">
        <button
          onClick={onBack}
          className="rounded-control p-1.5 text-ink-soft transition-colors hover:bg-surface-raised lg:hidden"
          aria-label={t("back")}
        >
          <Icon icon={ArrowLeft} size={16} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-section font-extrabold text-ink">{meta?.name ?? "…"}</p>
          {meta && (
            <p className="flex items-center gap-2 text-micro text-ink-dim">
              <span className="inline-flex items-center gap-1">
                <Icon icon={GraduationCap} size={11} />
                {meta.teacherName}
              </span>
              <span className="inline-flex items-center gap-1">
                <Icon icon={Users} size={11} />
                {t("membersN", { n: meta.memberCount })}
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Xabarlar */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-3">
        {chat.isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner size={20} />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-card bg-surface-raised text-ink-faint">
              <Icon icon={MessagesSquare} size={22} />
            </div>
            <p className="text-note font-bold text-ink-soft">{t("emptyTitle")}</p>
            <p className="max-w-[240px] text-micro text-ink-dim">{t("emptyHint")}</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {withDividers.map((row, i) =>
              row.divider ? (
                <div key={`d${i}`} className="flex justify-center py-1.5">
                  <span className="rounded-pill bg-surface-raised px-2.5 py-0.5 text-micro font-bold text-ink-dim">
                    {row.divider}
                  </span>
                </div>
              ) : (
                <Bubble key={row.msg!.id} m={row.msg!} showAuthor={!!row.showAuthor} animate={!reduce} />
              )
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Kirish */}
      <form
        className="flex shrink-0 items-end gap-1.5 border-t border-line p-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          placeholder={t("placeholder")}
          maxLength={2000}
          className="max-h-28 min-h-[38px] min-w-0 flex-1 resize-none rounded-control border border-line bg-surface-raised px-3 py-2 text-body text-ink outline-none transition-colors placeholder:text-ink-dim focus:border-brand"
        />
        <button
          type="submit"
          disabled={!draft.trim() || send.isPending}
          aria-label={t("send")}
          className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-control bg-brand text-white transition-[background-color,transform] duration-150 hover:bg-brand-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand active:scale-95 disabled:opacity-40"
        >
          {send.isPending ? <Spinner size={14} /> : <Icon icon={SendHorizontal} size={16} />}
        </button>
      </form>
    </div>
  );
}

/** Kurs guruh chati sahifasi (Modul 25). O'qituvchi + guruh talabalari.
 *  Dars ichidagi AI-tutor chatdan alohida — bu real odamlar muloqoti. */
export function CourseChatPage() {
  const { t } = useTranslation(undefined, { keyPrefix: "courseChat" });
  const [params, setParams] = useSearchParams();
  const coursesQ = useMyCourses();
  const courses = coursesQ.data ?? [];

  const raw = params.get("course");
  const paramId = raw ? Number(raw) : null;
  // Faqat yozilgan kursni ochamiz; desktopda default birinchi kurs.
  const activeId = paramId && courses.some((c) => c.id === paramId) ? paramId : null;

  const pick = (id: number) => setParams({ course: String(id) }, { replace: true });
  const back = () => setParams({}, { replace: true });

  if (coursesQ.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size={24} />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col p-2">
      <div className="grid min-h-0 flex-1 gap-2 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* Chap: kurslar ro'yxati (mobil'da faqat kurs tanlanmagan bo'lsa) */}
        <div className={cls("min-h-0", activeId ? "hidden lg:block" : "block")}>
          <CourseList courses={courses} activeId={activeId} onPick={pick} />
        </div>

        {/* O'ng: chat yoki bo'sh holat */}
        <div className={cls("min-h-0", activeId ? "block" : "hidden lg:block")}>
          {activeId ? (
            <ChatView courseId={activeId} onBack={back} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2.5 rounded-card border border-dashed border-line bg-surface text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-card bg-surface-raised text-ink-faint">
                <Icon icon={MessagesSquare} size={26} />
              </div>
              <p className="text-section font-extrabold text-ink">{t("pickTitle")}</p>
              <p className="max-w-[280px] text-note text-ink-dim">{t("pickHint")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
