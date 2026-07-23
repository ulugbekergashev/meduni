import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, ChevronUp, FileText, Trash2 } from "lucide-react";
import { Badge, Button, Card, Icon, Input, cls, useToast } from "@meduni/ui";
import { AsyncSection } from "../../../components/AsyncSection";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { Field } from "../../../components/Field";
import { apiErrorMessage } from "../../../lib/api";
import { useLocale } from "../../../lib/useLocale";
import {
  useCreateTopic,
  useDeleteTopic,
  useReorderTopics,
  useTopics,
  type TopicRow,
  type TopicScope,
} from "./api";

/** Tiny pipeline chip: filled soft tone when the stage is done/published, outline otherwise. */
function StageChip({ label, state }: { label: string; state: "done" | "pending" | "missing" }) {
  return (
    <span
      className={cls(
        "rounded-pill px-2 py-0.5 text-[12px] font-semibold",
        state === "done" && "bg-emerald-soft text-emerald",
        state === "pending" && "bg-amber-soft text-amber",
        state === "missing" && "border border-line text-ink-faint"
      )}
    >
      {label}
    </span>
  );
}

/** Per-topic pipeline summary: material → konspekt → kontent turlari. */
function PipelineChips({ tp, t }: { tp: TopicRow; t: (k: string) => string }) {
  const kindState = (k: string): "done" | "pending" | "missing" => {
    const c = tp.contentKinds.find((x) => x.kind === k);
    if (!c) return "missing";
    return c.status === "published" ? "done" : "pending";
  };
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      <StageChip label={`${t("chipMaterial")} ${tp.materialCount}`} state={tp.materialCount > 0 ? "done" : "missing"} />
      <StageChip
        label={t("chipDigest")}
        state={tp.digestState === "approved" ? "done" : tp.digestState === "draft" ? "pending" : "missing"}
      />
      <StageChip label={t("chipQuiz")} state={kindState("quiz")} />
      <StageChip label={t("chipCase")} state={kindState("case")} />
      <StageChip label={t("chipSlides")} state={kindState("presentation")} />
      <StageChip label={t("chipVideo")} state={kindState("video")} />
    </div>
  );
}

/** Mavzular ro'yxati + qo'shish/tartiblash/o'chirish. Kurs tabida ham,
 *  fan sahifasida ham ishlatiladi (qamrov `scope` orqali beriladi). */
export function TopicListSection({ scope }: { scope: TopicScope }) {
  const { t } = useTranslation(undefined, { keyPrefix: "topics" });
  const { t: tc } = useTranslation(undefined, { keyPrefix: "common" });
  const locale = useLocale();
  const { show } = useToast();
  const navigate = useNavigate();

  const list = useTopics(scope);
  const create = useCreateTopic(scope);
  const remove = useDeleteTopic();
  const reorder = useReorderTopics();

  const [title, setTitle] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<TopicRow | null>(null);

  const topics = list.data ?? [];

  const onAdd = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!title.trim()) {
      setFormError(t("titleRequired"));
      return;
    }
    create.mutate(
      { title: title.trim() },
      {
        onSuccess: () => {
          setTitle("");
          show(t("added"));
        },
        onError: (err) => setFormError(apiErrorMessage(err, locale) ?? tc("genericError")),
      }
    );
  };

  const move = (index: number, dir: -1 | 1) => {
    const next = [...topics];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    reorder.mutate(next.map((tp) => tp.id));
  };

  return (
    <div className="space-y-3">
      <Card>
        <h2 className="mb-4 text-section font-bold text-ink">{t("addForm")}</h2>
        <form onSubmit={onAdd} className="flex flex-wrap items-start gap-3">
          <div className="min-w-[240px] flex-1">
            <Field label={t("titleOne")}>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("titlePlaceholder")} />
            </Field>
            {formError && <p className="mt-1 text-[14px] text-rose">{formError}</p>}
          </div>
          <div className="pt-6">
            <Button type="submit" icon={<span className="text-lg leading-none">+</span>} disabled={create.isPending}>
              {t("add")}
            </Button>
          </div>
        </form>
      </Card>

      <AsyncSection
        isLoading={list.isLoading}
        isError={list.isError}
        isEmpty={topics.length === 0}
        emptyIcon={<Icon icon={FileText} size={22} />}
        emptyText={t("empty")}
        onRetry={() => list.refetch()}
      >
        <ul className="space-y-2">
          {topics.map((tp, i) => (
            <li key={tp.id}>
              <Card className="flex items-center gap-3 py-3">
                <div className="flex flex-col">
                  <button
                    onClick={() => move(i, -1)}
                    disabled={i === 0 || reorder.isPending}
                    className="text-ink-faint hover:text-ink disabled:opacity-30"
                    aria-label={t("moveUp")}
                  >
                    <Icon icon={ChevronUp} size={16} />
                  </button>
                  <button
                    onClick={() => move(i, 1)}
                    disabled={i === topics.length - 1 || reorder.isPending}
                    className="text-ink-faint hover:text-ink disabled:opacity-30"
                    aria-label={t("moveDown")}
                  >
                    <Icon icon={ChevronDown} size={16} />
                  </button>
                </div>

                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bg text-[14px] font-bold text-ink-soft">
                  {i + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <button
                    onClick={() => navigate(`/teach/topics/${tp.id}`)}
                    className="block max-w-full truncate text-left font-medium text-ink hover:text-brand-deep hover:underline"
                  >
                    {tp.title}
                  </button>
                  <PipelineChips tp={tp} t={t} />
                </div>

                <Badge tone={tp.status === "published" ? "emerald" : "slate"}>{t(`status.${tp.status}`)}</Badge>

                <button
                  onClick={() => setDeleting(tp)}
                  className="rounded-control p-1.5 text-ink-soft transition-colors hover:bg-rose-soft hover:text-rose"
                  aria-label={tc("delete")}
                >
                  <Icon icon={Trash2} size={16} />
                </button>

                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Icon icon={ChevronRight} size={16} />}
                  onClick={() => navigate(`/teach/topics/${tp.id}`)}
                >
                  {t("open")}
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      </AsyncSection>

      <ConfirmDialog
        open={!!deleting}
        title={t("confirmDeleteTitle")}
        message={t("confirmDelete")}
        loading={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => {
              setDeleting(null);
              show(tc("deleted"));
            },
          })
        }
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
