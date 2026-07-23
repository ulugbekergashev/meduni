import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { GraduationCap, MessagesSquare, SendHorizontal, Users } from "lucide-react";
import { Card, Icon, Spinner, cls } from "@meduni/ui";
import { useCourseChat, useCourseChatMeta, useSendCourseChat, type ChatMessage } from "../api";

const hhmm = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

function Bubble({ m, showAuthor, animate }: { m: ChatMessage; showAuthor: boolean; animate: boolean }) {
  const { t } = useTranslation(undefined, { keyPrefix: "courseChat" });
  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16, ease: "easeOut" }}
      className={cls("flex flex-col", m.mine ? "items-end" : "items-start")}
    >
      {showAuthor && !m.mine && (
        <span className="mb-0.5 ml-1 inline-flex items-center gap-1 text-[12px] font-bold text-ink-faint">
          {m.authorName}
          {m.role === "teacher" && (
            <span className="rounded-pill bg-brand-soft px-1.5 py-px text-[11px] font-extrabold text-brand-deep">
              {t("teacherTag")}
            </span>
          )}
        </span>
      )}
      <div
        className={cls(
          "max-w-[78%] whitespace-pre-wrap rounded-card px-3 py-2 text-[14px] leading-relaxed",
          m.mine ? "rounded-br-control bg-brand text-white" : "rounded-bl-control bg-bg text-ink-strong"
        )}
      >
        {m.text}
      </div>
      <span className="mt-0.5 px-1 text-[11px] tabular-nums text-ink-faint">{hhmm(m.createdAt)}</span>
    </motion.div>
  );
}

/** O'qituvchi kurs chati tabi (Modul 25) — o'qituvchi guruhga javob beradi. */
export function CourseChatTab() {
  const { id } = useParams();
  const courseId = Number(id);
  const { t } = useTranslation(undefined, { keyPrefix: "courseChat" });
  const reduce = useReducedMotion();
  const meta = useCourseChatMeta(courseId).data;
  const chat = useCourseChat(courseId);
  const send = useSendCourseChat(courseId);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const messages = chat.data?.messages ?? [];
  const prevCount = useRef(0);

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

  let lastAuthor = -1;

  return (
    <Card className="flex h-[560px] flex-col overflow-hidden p-0">
      {/* Shapka */}
      <div className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-2.5">
        <Icon icon={MessagesSquare} size={16} className="text-brand-deep" />
        <p className="flex-1 text-[15px] font-bold text-ink">{t("title")}</p>
        {meta && (
          <span className="inline-flex items-center gap-1 text-[12.5px] text-ink-soft">
            <Icon icon={Users} size={13} />
            {t("membersN", { n: meta.memberCount })}
          </span>
        )}
      </div>

      {/* Xabarlar */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-4 py-3">
        {chat.isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner size={20} />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-card bg-bg text-ink-faint">
              <Icon icon={GraduationCap} size={22} />
            </div>
            <p className="text-[14px] font-bold text-ink-soft">{t("teacherEmptyTitle")}</p>
            <p className="max-w-[280px] text-[12.5px] text-ink-faint">{t("teacherEmptyHint")}</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((m) => {
              const showAuthor = m.authorId !== lastAuthor;
              lastAuthor = m.authorId;
              return <Bubble key={m.id} m={m} showAuthor={showAuthor} animate={!reduce} />;
            })}
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
          placeholder={t("teacherPlaceholder")}
          maxLength={2000}
          className="max-h-28 min-h-[38px] min-w-0 flex-1 resize-none rounded-control border border-line bg-surface px-3 py-2 text-[14px] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-brand"
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
    </Card>
  );
}
