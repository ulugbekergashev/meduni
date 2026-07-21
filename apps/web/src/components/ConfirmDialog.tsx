import { useTranslation } from "react-i18next";
import { Button, Modal } from "@meduni/ui";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  /** Backend error (e.g. delete-guard) to surface inside the dialog. */
  errorMessage?: string | null;
  loading?: boolean;
  /** Confirm button label (defaults to common "delete"). */
  confirmLabel?: string;
  /** Confirm button style (defaults to danger). */
  confirmVariant?: "danger" | "primary";
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  errorMessage,
  loading,
  confirmLabel,
  confirmVariant = "danger",
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const { t } = useTranslation(undefined, { keyPrefix: "common" });

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-[14.5px] text-ink-soft">{message}</p>

      {errorMessage && (
        <div className="mt-3 rounded-control bg-rose-soft px-3 py-2 text-[14px] text-rose">
          {errorMessage}
        </div>
      )}

      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" size="md" onClick={onClose} disabled={loading}>
          {t("cancel")}
        </Button>
        <Button variant={confirmVariant} size="md" onClick={onConfirm} disabled={loading}>
          {confirmLabel ?? t("delete")}
        </Button>
      </div>
    </Modal>
  );
}
