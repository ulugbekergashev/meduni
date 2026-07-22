import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Lock, SendHorizontal, Sparkles } from "lucide-react";
import { Icon, Spinner, cls } from "@meduni/ui";
import { apiErrorMessage } from "../../../lib/api";
import { useLocale } from "../../../lib/useLocale";
import { useSendTutorMessage, useTutorChat } from "../api";
import { Panel } from "./Panel";

function Bubble({ role, text, animate }: { role: "student" | "assistant"; text: string; animate: boolean }) {
  const mine = role === "student";
  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className={cls("flex", mine ? "justify-end" : "justify-start")}
    >
      <div
        className={cls(
          "max-w-[85%] whitespace-pre-wrap rounded-card px-3 py-2 text-body leading-relaxed",
          mine ? "rounded-br-control bg-brand-soft text-ink" : "rounded-bl-control bg-surface-raised text-ink-strong"
        )}
      >
        {text}
      </div>
    </motion.div>
  );
}

/** O'ng ustun — AI-tutor chat (talaba + AI; layout v2). Test paytida qulf. */
export function ChatPanel({
  topicId,
  locked = false,
}: {
  topicId: number;
  locked?: boolean;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "lesson" });
  const locale = useLocale();
  const reduce = useReducedMotion();
  const chat = useTutorChat(topicId);
  const send = useSendTutorMessage(topicId);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages = chat.data?.messages ?? [];
  const pendingText = send.isPending ? (send.variables as string) : null;

  // Yangi xabarda pastga silliq skroll.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [messages.length, pendingText, reduce]);

  const submit = (text: string) => {
    const clean = text.trim();
    if (!clean || send.isPending || locked) return;
    send.mutate(clean);
    setDraft("");
  };

  const errMsg = send.isError ? apiErrorMessage(send.error, locale === "ru" ? "ru" : "uz") : null;
  const suggestions = [t("chatSuggest1"), t("chatSuggest2")];

  return (
    <Panel tone="chrome" title={t("chatTitle")} icon={Sparkles} bodyClassName="flex flex-col p-0">
      {/* Xabarlar lentasi */}
      <div ref={scrollRef} className="h-[320px] flex-1 space-y-2 overflow-y-auto px-1.5 pb-2 lg:h-auto">
        {chat.isLoading ? (
          <div className="flex justify-center py-6">
            <Spinner size={18} />
          </div>
        ) : messages.length === 0 && !pendingText ? (
          <div className="px-1.5 py-2">
            <p className="text-note font-bold text-ink-soft">{t("chatEmptyTitle")}</p>
            <p className="mt-0.5 text-micro leading-relaxed text-ink-dim">{t("chatEmptyHint")}</p>
            <div className="mt-2.5 space-y-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  disabled={locked}
                  className="block w-full rounded-control border border-line px-2.5 py-1.5 text-left text-note font-semibold text-ink-soft transition-colors hover:border-brand-soft hover:bg-brand-soft hover:text-brand-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-40"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((m) => (
              <Bubble key={m.id} role={m.role} text={m.text} animate={!reduce} />
            ))}
            {pendingText && (
              <div key="pending" className="space-y-2">
                <Bubble role="student" text={pendingText} animate={!reduce} />
                <div className="flex justify-start">
                  <div className="rounded-card rounded-bl-control bg-surface-raised px-3 py-2.5">
                    <span className="inline-flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <motion.span
                          key={i}
                          animate={reduce ? undefined : { y: [0, -3, 0] }}
                          transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut", delay: i * 0.15 }}
                          className="h-1.5 w-1.5 rounded-full bg-ink-dim"
                        />
                      ))}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </AnimatePresence>
        )}
        {errMsg && !send.isPending && (
          <p className="rounded-control border-l-2 border-rose bg-rose-soft px-2.5 py-1.5 text-note font-bold text-rose">
            {errMsg}
          </p>
        )}
      </div>

      {/* Kirish maydoni / qulf */}
      {locked ? (
        <div className="flex shrink-0 items-center gap-2 rounded-control bg-amber-soft px-3 py-2.5">
          <Icon icon={Lock} size={13} className="shrink-0 text-amber" />
          <p className="text-micro font-bold leading-snug text-amber">{t("chatLockedQuiz")}</p>
        </div>
      ) : (
        <form
          className="flex shrink-0 items-center gap-1.5 p-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            submit(draft);
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("chatPlaceholder")}
            maxLength={2000}
            className="min-w-0 flex-1 rounded-control border border-line bg-surface px-2.5 py-2 text-body text-ink outline-none transition-colors placeholder:text-ink-dim focus:border-brand"
          />
          <button
            type="submit"
            disabled={!draft.trim() || send.isPending}
            aria-label={t("chatSend")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-brand text-white transition-[background-color,transform] duration-150 hover:bg-brand-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand active:scale-95 disabled:opacity-40"
          >
            {send.isPending ? <Spinner size={14} /> : <Icon icon={SendHorizontal} size={15} />}
          </button>
        </form>
      )}
    </Panel>
  );
}
