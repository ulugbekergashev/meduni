import { useRef, useState, type DragEvent } from "react";
import { useTranslation } from "react-i18next";
import { FileText, RotateCw, Trash2, Upload } from "lucide-react";
import { Badge, Button, Card, EmptyState, Icon, Modal, Spinner, useToast, type BadgeTone } from "@meduni/ui";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { useLocale } from "../../../lib/useLocale";
import {
  fetchMaterialText,
  useDeleteMaterial,
  useRetryMaterial,
  useUploadMaterial,
  type Material,
  type ParseStatus,
} from "./api";

const statusTone: Record<ParseStatus, BadgeTone> = {
  pending: "slate",
  processing: "blue",
  done: "emerald",
  error: "rose",
};

function StatusBadge({ status }: { status: ParseStatus }) {
  const { t } = useTranslation(undefined, { keyPrefix: "materials.status" });
  return (
    <span className="inline-flex items-center gap-1.5">
      {status === "processing" && <Spinner size={13} />}
      <Badge tone={statusTone[status]}>{t(status)}</Badge>
    </span>
  );
}

export function MaterialsSection({ topicId, materials }: { topicId: number; materials: Material[] }) {
  const { t } = useTranslation(undefined, { keyPrefix: "materials" });
  const { t: tc } = useTranslation(undefined, { keyPrefix: "common" });
  const locale = useLocale();
  const { show } = useToast();

  const upload = useUploadMaterial(topicId);
  const retry = useRetryMaterial(topicId);
  const remove = useDeleteMaterial(topicId);

  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [deleting, setDeleting] = useState<Material | null>(null);
  const [viewing, setViewing] = useState<Material | null>(null);
  const [viewText, setViewText] = useState<string | null>(null);

  const uploadFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) =>
      upload.mutate(file, { onSuccess: () => show(t("uploaded")) })
    );
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    uploadFiles(e.dataTransfer.files);
  };

  const openText = async (m: Material) => {
    setViewing(m);
    setViewText(null);
    try {
      const r = await fetchMaterialText(m.id);
      setViewText(r.text);
    } catch {
      setViewText("");
    }
  };

  return (
    <div>
      {/* Dropzone */}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.pptx,.txt,.md"
        className="hidden"
        onChange={(e) => {
          uploadFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={
          "flex w-full flex-col items-center gap-2 rounded-card border-2 border-dashed px-6 py-10 text-center transition-colors " +
          (dragOver ? "border-brand bg-brand-soft" : "border-line bg-surface hover:bg-bg")
        }
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-brand-deep">
          <Icon icon={Upload} size={20} />
        </div>
        <p className="text-body font-medium text-ink">{t("dropzone")}</p>
        <p className="text-note text-ink-faint">{t("formats")}</p>
        {upload.isPending && (
          <span className="mt-1 flex items-center gap-2 text-note text-ink-soft">
            <Spinner size={14} /> {t("uploading")}
          </span>
        )}
      </button>

      {/* File list */}
      <div className="mt-4">
        {materials.length === 0 ? (
          <EmptyState icon={<Icon icon={FileText} size={22} />} text={t("empty")} />
        ) : (
          <ul className="space-y-2">
            {materials.map((m) => (
              <li key={m.id}>
                <Card className="flex items-center gap-3 py-3">
                  <Icon icon={FileText} size={18} className="shrink-0 text-ink-soft" />
                  <div className="min-w-0 flex-1">
                    <button
                      onClick={() => m.hasText && openText(m)}
                      disabled={!m.hasText}
                      className={
                        "truncate text-left text-body font-medium " +
                        (m.hasText ? "text-brand-deep hover:underline" : "text-ink")
                      }
                    >
                      {m.fileName}
                    </button>
                    {m.parseStatus === "error" && (m.errorUz || m.errorRu) && (
                      <p className="truncate text-note text-rose">{locale === "ru" ? m.errorRu : m.errorUz}</p>
                    )}
                  </div>

                  <StatusBadge status={m.parseStatus} />

                  {m.parseStatus === "error" && (
                    <button
                      onClick={() => retry.mutate(m.id)}
                      className="rounded-control p-1.5 text-ink-soft transition-colors hover:bg-amber-soft hover:text-amber"
                      aria-label={t("retry")}
                    >
                      <Icon icon={RotateCw} size={16} />
                    </button>
                  )}
                  <button
                    onClick={() => setDeleting(m)}
                    className="rounded-control p-1.5 text-ink-soft transition-colors hover:bg-rose-soft hover:text-rose"
                    aria-label={tc("delete")}
                  >
                    <Icon icon={Trash2} size={16} />
                  </button>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Extracted text viewer */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title={t("textTitle")} className="max-w-2xl">
        {viewText === null ? (
          <div className="flex justify-center py-10">
            <Spinner size={24} />
          </div>
        ) : (
          <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-control bg-bg p-4 text-body text-ink">
            {viewText || "—"}
          </pre>
        )}
        <div className="mt-4 flex justify-end">
          <Button variant="ghost" onClick={() => setViewing(null)}>
            {t("close")}
          </Button>
        </div>
      </Modal>

      {/* Delete confirm */}
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
