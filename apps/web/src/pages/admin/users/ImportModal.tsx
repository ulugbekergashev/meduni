import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FileSpreadsheet, Upload } from "lucide-react";
import { Button, Icon, Modal, Spinner } from "@meduni/ui";
import { useLocale } from "../../../lib/useLocale";
import { useImportUsers, type ImportResult } from "./api";

export function ImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "users.import" });
  const locale = useLocale();
  const inputRef = useRef<HTMLInputElement>(null);
  const importer = useImportUsers();
  const [result, setResult] = useState<ImportResult | null>(null);

  const onFile = (file: File) => {
    setResult(null);
    importer.mutate(file, { onSuccess: (r) => setResult(r) });
  };

  const close = () => {
    setResult(null);
    importer.reset();
    onClose();
  };

  return (
    <Modal open={open} onClose={close} title={t("title")}>
      <p className="text-[13.5px] font-medium text-ink">{t("columns")}</p>
      <p className="mt-1 text-[12.5px] text-ink-soft">{t("note")}</p>

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />

      <div className="mt-4 flex items-center gap-3">
        <Button
          variant="soft"
          icon={<Icon icon={Upload} size={16} />}
          onClick={() => inputRef.current?.click()}
          disabled={importer.isPending}
        >
          {t("choose")}
        </Button>
        {importer.isPending && (
          <span className="flex items-center gap-2 text-[13px] text-ink-soft">
            <Spinner size={16} /> {t("importing")}
          </span>
        )}
      </div>

      {result && (
        <div className="mt-5 space-y-3">
          <div className="flex gap-2">
            <span className="inline-flex items-center rounded-pill bg-emerald-soft px-3 py-1 text-[13px] font-semibold text-emerald">
              {t("resultAdded", { n: result.added })}
            </span>
            {result.errors.length > 0 && (
              <span className="inline-flex items-center rounded-pill bg-rose-soft px-3 py-1 text-[13px] font-semibold text-rose">
                {t("resultErrors", { n: result.errors.length })}
              </span>
            )}
          </div>

          {result.errors.length > 0 && (
            <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-control border border-line p-3">
              {result.errors.map((e, i) => (
                <div key={i} className="text-[13px] text-ink-soft">
                  <span className="font-semibold text-rose">
                    {t("row")} {e.row}:
                  </span>{" "}
                  {locale === "ru" ? e.messageRu : e.messageUz}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[12px] text-ink-faint">
          <Icon icon={FileSpreadsheet} size={14} /> .xlsx
        </div>
        <Button variant="ghost" onClick={close}>
          {t("close")}
        </Button>
      </div>
    </Modal>
  );
}
