import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowUp, Sparkles } from "lucide-react";
import { Icon } from "@meduni/ui";
import { BentoCard } from "../../../components/bento";

/** Savol uzunligi chegarasi — chat ham shuncha qabul qiladi. */
const MAX_QUESTION = 500;

/**
 * AI-tutorga kirish. Tutor mavzu konspekti va materialiga tayanadi, shuning
 * uchun savol joriy mavzu sahifasida ochiladi (`?ask=` — chat o'zi yuboradi).
 * ⚠️ Test jarayonida chat qulf — u holda savol yuborilmaydi (halollik qoidasi).
 */
export function TutorCard({ topic }: { topic: { id: number; title: string } | null }) {
  const { t } = useTranslation(undefined, { keyPrefix: "student" });
  const navigate = useNavigate();
  const [draft, setDraft] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = draft.trim().slice(0, MAX_QUESTION);
    if (!q || !topic) return;
    // Chat faqat o'rganish ko'rinishida bor (overview — fokus rejimi), shuning
    // uchun to'g'ridan konspektga ochiladi.
    navigate(`/app/topics/${topic.id}?view=konspekt&ask=${encodeURIComponent(q)}`);
  };

  return (
    <BentoCard
      className="h-full"
      title={
        <span className="inline-flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-soft text-violet">
            <Icon icon={Sparkles} size={15} />
          </span>
          {t("aiTitle")}
        </span>
      }
    >
      <p className="text-note text-ink-soft">{topic ? t("aiHint") : t("aiNoTopic")}</p>
      {topic && (
        <p className="mt-1 truncate text-micro font-semibold text-ink-2">{t("aiTopic", { topic: topic.title })}</p>
      )}
      <form onSubmit={submit} className="mt-auto flex items-center gap-2 pt-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={!topic}
          maxLength={MAX_QUESTION}
          placeholder={t("aiPlaceholder")}
          aria-label={t("aiPlaceholder")}
          className="h-10 min-w-0 flex-1 rounded-pill border border-line-raised bg-surface-raised px-4 text-note text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!topic || !draft.trim()}
          aria-label={t("aiSend")}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-surface transition-colors hover:bg-ink-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-40"
        >
          <Icon icon={ArrowUp} size={16} />
        </button>
      </form>
    </BentoCard>
  );
}
