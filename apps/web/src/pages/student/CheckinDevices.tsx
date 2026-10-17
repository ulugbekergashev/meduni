import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { startRegistration, browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { Loader2, ScanFace, Smartphone, Trash2 } from "lucide-react";
import { Button, Icon, cls, useToast } from "@meduni/ui";
import { BentoCard } from "../../components/bento";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { api, apiErrorMessage } from "../../lib/api";
import { useLocale } from "../../lib/useLocale";
import { formatDate } from "../../lib/date";
import { useWebauthnDevices, useRemoveWebauthnDevice } from "./api";

function guessDeviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  return "Qurilma";
}

/** Profil sozlamalari: FaceID davomat qurilmalari (WebAuthn passkey) — qo'shish/o'chirish. */
export function CheckinDevices() {
  const { t } = useTranslation(undefined, { keyPrefix: "checkin" });
  const locale = useLocale();
  const { show } = useToast();
  const qc = useQueryClient();
  const devicesQ = useWebauthnDevices();
  const remove = useRemoveWebauthnDevice();
  const [adding, setAdding] = useState(false);
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const devices = devicesQ.data ?? [];

  async function addDevice() {
    if (!browserSupportsWebAuthn()) {
      show(t("noWebauthn"));
      return;
    }
    setAdding(true);
    try {
      const regOpts = await api<Record<string, unknown>>("/api/v1/me/webauthn/register-options", { method: "POST", body: "{}" });
      const regResp = await startRegistration({ optionsJSON: regOpts as never });
      await api("/api/v1/me/webauthn/register", { method: "POST", body: JSON.stringify({ response: regResp, deviceName: guessDeviceName() }) });
      qc.invalidateQueries({ queryKey: ["webauthn-devices"] });
      qc.invalidateQueries({ queryKey: ["me-checkin"] });
      show(t("deviceAdded"));
    } catch (err) {
      if (err instanceof Error && (err.name === "NotAllowedError" || err.name === "AbortError")) {
        show(t("cancelled"));
      } else {
        show(apiErrorMessage(err, locale === "ru" ? "ru" : "uz") ?? t("failed"));
      }
    } finally {
      setAdding(false);
    }
  }

  return (
    <BentoCard
      title={
        <span className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-deep">
            <Icon icon={ScanFace} size={14} />
          </span>
          {t("devicesTitle")}
        </span>
      }
      count={devices.length}
      isLoading={devicesQ.isLoading}
      isError={devicesQ.isError}
      onRetry={() => devicesQ.refetch()}
      bodyClassName="space-y-3 px-4 pb-4"
    >
      <p className="text-note text-ink-soft">{t("devicesHint")}</p>

      {devices.length === 0 ? (
        <p className="rounded-control border border-dashed border-line px-3 py-4 text-center text-note text-ink-soft">{t("noDevices")}</p>
      ) : (
        <div className="space-y-2">
          {devices.map((dv) => (
            <div key={dv.id} className="flex items-center gap-3 rounded-control bg-surface-raised px-3 py-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-ink-2">
                <Icon icon={Smartphone} size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-body font-semibold text-ink">{dv.deviceName ?? t("deviceUnnamed")}</p>
                <p className="truncate text-micro text-ink-soft">
                  {dv.lastUsedAt
                    ? t("lastUsed", { date: formatDate(locale === "ru" ? "ru" : "uz", dv.lastUsedAt, "shortYear") })
                    : t("addedOn", { date: formatDate(locale === "ru" ? "ru" : "uz", dv.createdAt, "shortYear") })}
                </p>
              </div>
              <button
                onClick={() => setConfirmId(dv.id)}
                type="button"
                className="shrink-0 rounded-full p-2 text-ink-soft transition-colors hover:bg-rose-soft hover:text-rose focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                aria-label={t("removeDevice")}
              >
                <Icon icon={Trash2} size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      <Button onClick={addDevice} disabled={adding} className={cls("w-full", adding && "opacity-80")}>
        <Icon icon={adding ? Loader2 : ScanFace} size={16} className={adding ? "animate-spin" : undefined} />
        {t("addDevice")}
      </Button>

      <ConfirmDialog
        open={confirmId !== null}
        title={t("removeDevice")}
        message={t("removeConfirm")}
        loading={remove.isPending}
        onConfirm={() => {
          if (confirmId == null) return;
          remove.mutate(confirmId, {
            onSuccess: () => {
              setConfirmId(null);
              show(t("deviceRemoved"));
            },
            onError: (err) => show(apiErrorMessage(err, locale === "ru" ? "ru" : "uz") ?? t("failed")),
          });
        }}
        onClose={() => setConfirmId(null)}
      />
    </BentoCard>
  );
}
