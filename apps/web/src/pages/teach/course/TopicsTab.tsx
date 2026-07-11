import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, ChevronUp, FileText, Trash2 } from "lucide-react";
import { Badge, Button, Card, Icon, Input, useToast } from "@meduni/ui";
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
} from "../topics/api";

export function TopicsTab() {
  const { id } = useParams();
  const courseId = Number(id);
  const { t } = useTranslation(undefined, { keyPrefix: "topics" });
  const { t: tc } = useTranslation(undefined, { keyPrefix: "common" });
  const locale = useLocale();
  const { show } = useToast();
  const navigate = useNavigate();

  const list = useTopics(courseId);
  const create = useCreateTopic(courseId);
  const remove = useDeleteTopic(courseId);
  const reorder = useReorderTopics(courseId);

  const [titleUz, setTitleUz] = useState("");
  const [titleRu, setTitleRu] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<TopicRow | null>(null);

  const topics = list.data ?? [];

  const onAdd = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    create.mutate(
      { titleUz: titleUz.trim(), titleRu: titleRu.trim() },
      {
        onSuccess: () => {
          setTitleUz("");
          setTitleRu("");
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
    <div className="space-y-6">
      {/* Add form */}
      <Card>
        <h2 className="mb-4 text-section font-bold text-ink">{t("addForm")}</h2>
        <form onSubmit={onAdd} className="grid gap-4 sm:grid-cols-2">
          <Field label={t("titleUz")}>
            <Input value={titleUz} onChange={(e) => setTitleUz(e.target.value)} required />
          </Field>
          <Field label={t("titleRu")}>
            <Input value={titleRu} onChange={(e) => setTitleRu(e.target.value)} required />
          </Field>
          {formError && <p className="text-[13px] text-rose sm:col-span-2">{formError}</p>}
          <div className="sm:col-span-2">
            <Button type="submit" icon={<span className="text-lg leading-none">+</span>} disabled={create.isPending}>
              {t("add")}
            </Button>
          </div>
        </form>
      </Card>

      {/* Topic list */}
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

                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bg text-[13px] font-bold text-ink-soft">
                  {i + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">
                    {locale === "ru" ? tp.titleRu : tp.titleUz}
                  </p>
                  <p className="truncate text-[12px] text-ink-faint">
                    {locale === "ru" ? tp.titleUz : tp.titleRu}
                  </p>
                </div>

                <Badge tone={tp.status === "published" ? "emerald" : "slate"}>
                  {t(`status.${tp.status}`)}
                </Badge>

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
