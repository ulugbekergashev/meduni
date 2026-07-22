import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Lock, SendHorizontal, Sparkles } from "lucide-react";
import { Icon, Spinner, cls } from "@meduni/ui";
import { apiErrorMessage } from "../../../lib/api";
import { useLocale } from "../../../lib/useLocale";
import { useSendTutorMessage, useTutorChat } from "../api";
import { Panel } from "./Panel";

function Bubble({ role, text }: { role: "student" | "assistant"; text: string }) {
  const mine = role === "student";
  return (
    <div className={cls("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cls(
          "max-w-[85%] whitespace-pre-wrap rounded-card px-3 py-2 text-note leading-relaxed",
          mine ? "rounded-br-control bg-brand-soft text-ink" : "rounded-bl-control bg-surface-raised text-ink-strong"
        )}
      >
        {text}
      </div>
    </div>
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
  const chat = useTutorChat(topicId);
  const send = useSendTutorMessage(topicId);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages = chat.data?.messages ?? [];
  const pendingText = send.isPending ? (send.variables as string) : null;

  // Yangi xabarda pastga skroll.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, pendingText]);

  const submit = (text: string) => {
    const clean = text.trim();
    if (!clean || send.isPending || locked) return;
    send.mutate(clean);
    setDraft("");
  };

  const errMsg = send.isError ? apiErrorMessage(send.error, locale === "ru" ? "ru" : "uz") : null;
  const suggestions = [t("chatSuggest1"), t("chatSuggest2")];

  return (
    <Panel title={t("chatTitle")} icon={Sparkles} bodyClassName="flex flex-col p-0">
      {/* Xabarlar lentasi */}
      <div ref={scrollRef} className="h-[320px] flex-1 space-y-2 overflow-y-auto p-2.5 lg:h-auto">
        {chat.isLoading ? (
          <div className="flex justify-center py-6">
            <Spinner size={18} />
          </div>
        ) : messages.length === 0 && !pendingText ? (
          <div className="px-1 py-3">
            <p className="text-note font-bold text-ink-soft">{t("chatEmptyTitle")}</p>
            <p className="mt-0.5 text-micro leading-relaxed text-ink-dim">{t("chatEmptyHint")}</p>
            <div className="mt-2.5 space-y-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  disabled={locked}
                  className="block w-full rounded-control border border-line px-2.5 py-1.5 text-left text-micro font-bold text-ink-soft transition-colors hover:border-brand-soft hover:bg-brand-soft hover:text-brand-tint disabled:opacity-40"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((m) => (
              <Bubble key={m.id} role={m.role} text={m.text} />
            ))}
            {pendingText && (
              <>
                <Bubble role="student" text={pendingText} />
                <div className="flex justify-start">
                  <div className="rounded-card rounded-bl-control bg-surface-raised px-3 py-2">
                    <span className="inline-flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-dim"
                          style={{ animationDelay: `${i * 0.15}s` }}
                        />
                      ))}
                    </span>
                  </div>
                </div>
              </>
            )}
          </>
        )}
        {errMsg && !send.isPending && (
          <p className="rounded-control border-l-2 border-rose bg-rose-soft px-2.5 py-1.5 text-micro font-bold text-rose">
            {errMsg}
          </p>
        )}
      </div>

      {/* Kirish maydoni / qulf */}
      {locked ? (
        <div className="flex shrink-0 items-center gap-2 border-t border-line px-3 py-2.5">
          <Icon icon={Lock} size={13} className="shrink-0 text-amber" />
          <p className="text-micro font-bold leading-snug text-amber">{t("chatLockedQuiz")}</p>
        </div>
      ) : (
        <form
          className="flex shrink-0 items-center gap-1.5 border-t border-line p-2"
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
            className="min-w-0 flex-1 rounded-control border border-line bg-surface-raised px-2.5 py-1.5 text-note text-ink outline-none transition-colors placeholder:text-ink-dim focus:border-brand"
          />
          <button
            type="submit"
            disabled={!draft.trim() || send.isPending}
            aria-label={t("chatSend")}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-brand text-white transition-colors hover:bg-brand-deep disabled:opacity-40"
          >
            <Icon icon={SendHorizontal} size={14} />
          </button>
        </form>
      )}
    </Panel>
  );
}
