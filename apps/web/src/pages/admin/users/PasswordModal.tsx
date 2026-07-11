import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy } from "lucide-react";
import { Button, Icon, Modal } from "@meduni/ui";

export function PasswordModal({ password, onClose }: { password: string | null; onClose: () => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "users.password" });
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password ?? "");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — user can select manually */
    }
  };

  return (
    <Modal open={!!password} onClose={onClose} title={t("title")}>
      <p className="text-[13.5px] text-ink-soft">{t("hint")}</p>
      <div className="mt-3 flex items-center gap-2">
        <code className="flex-1 rounded-control bg-bg px-3 py-2.5 font-mono text-[16px] font-bold tracking-wider text-ink">
          {password}
        </code>
        <Button
          variant="soft"
          onClick={copy}
          icon={<Icon icon={copied ? Check : Copy} size={16} />}
        >
          {copied ? t("copied") : t("copy")}
        </Button>
      </div>
      <div className="mt-6 flex justify-end">
        <Button variant="ghost" onClick={onClose}>
          {t("close")}
        </Button>
      </div>
    </Modal>
  );
}
