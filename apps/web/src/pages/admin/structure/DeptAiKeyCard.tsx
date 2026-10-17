import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ExternalLink, KeyRound, RefreshCw, ShieldAlert, ShieldCheck, Trash2 } from "lucide-react";
import { Button, Icon, Input, Modal, Spinner, cls, useToast } from "@meduni/ui";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { Field } from "../../../components/Field";
import { api, apiErrorMessage } from "../../../lib/api";
import { formatDate } from "../../../lib/date";
import { useLocale } from "../../../lib/useLocale";

/** Server javobi — kalitning O'ZI hech qachon kelmaydi, faqat oxirgi 4 belgi. */
export interface DeptKeyStatus {
  departmentId: number;
  configured: boolean;
  last4: string | null;
  setAt: string | null;
  setByName: string | null;
  checkedAt: string | null;
  platformFallback: boolean;
}

const keyQuery = (deptId: number) => ["dept-ai-key", deptId] as const;

function useDeptKey(deptId: number) {
  return useQuery({
    queryKey: keyQuery(deptId),
    queryFn: () => api<DeptKeyStatus>(`/api/v1/admin/departments/${deptId}/ai-key`),
  });
}

function useKeyMutations(deptId: number) {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: keyQuery(deptId) });
    qc.invalidateQueries({ queryKey: ["ai-keys"] });
  };
  const save = useMutation({
    mutationFn: (apiKey: string) =>
      api<DeptKeyStatus>(`/api/v1/admin/departments/${deptId}/ai-key`, { method: "PUT", body: JSON.stringify({ apiKey }) }),
    onSuccess: refresh,
    meta: { silent: true },
  });
  const remove = useMutation({
    mutationFn: () => api<DeptKeyStatus>(`/api/v1/admin/departments/${deptId}/ai-key`, { method: "DELETE" }),
    onSuccess: refresh,
  });
  const check = useMutation({
    mutationFn: () =>
      api<{ ok: boolean; reason?: string; status: DeptKeyStatus }>(`/api/v1/admin/departments/${deptId}/ai-key/check`, { method: "POST" }),
    onSuccess: refresh,
  });
  return { save, remove, check };
}

function KeyModal({ deptId, replacing, onClose }: { deptId: number; replacing: boolean; onClose: () => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "aiKey" });
  const { t: tc } = useTranslation(undefined, { keyPrefix: "common" });
  const locale = useLocale();
  const { show } = useToast();
  const { save } = useKeyMutations(deptId);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    save.mutate(value.trim(), {
      onSuccess: () => {
        save.reset(); // kalit mutatsiya keshida (variables) qolib ketmasin
        show(t("saved"));
        onClose();
      },
      onError: (err) => setError(apiErrorMessage(err, locale) ?? tc("genericError")),
    });
  };

  return (
    <Modal open onClose={onClose} title={replacing ? t("replaceTitle") : t("addTitle")}>
      <form onSubmit={onSubmit} className="space-y-4" autoComplete="off">
        <ol className="space-y-1 rounded-control bg-bg p-3 text-note text-ink-soft">
          <li>
            1. {t("step1")}{" "}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 font-medium text-brand-deep hover:underline"
            >
              aistudio.google.com/apikey <Icon icon={ExternalLink} size={12} />
            </a>
          </li>
          <li>2. {t("step2")}</li>
          <li>3. {t("step3")}</li>
        </ol>
        <Field label={t("fieldLabel")}>
          <Input
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="AIza…"
            autoComplete="new-password"
            spellCheck={false}
            autoFocus
            required
          />
          <p className="mt-1 text-note text-ink-faint">{t("hint")}</p>
        </Field>
        {error && <p className="text-note text-rose">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>{tc("cancel")}</Button>
          <Button type="submit" disabled={save.isPending || value.trim().length < 20}>
            {save.isPending ? t("verifying") : t("saveBtn")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Kafedra sahifasidagi "Gemini AI kaliti" kartasi — kafedra o'z kalitini o'zi kiritadi. */
export function DeptAiKeyCard({ deptId, canManage }: { deptId: number; canManage: boolean }) {
  const { t } = useTranslation(undefined, { keyPrefix: "aiKey" });
  const locale = useLocale();
  const { show } = useToast();
  const status = useDeptKey(deptId);
  const { remove, check } = useKeyMutations(deptId);
  const [modal, setModal] = useState<"add" | "replace" | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  if (status.isLoading) {
    return <section className="flex h-full min-h-20 items-center justify-center rounded-card border border-line bg-surface"><Spinner size={20} /></section>;
  }
  if (status.isError || !status.data) {
    return (
      <section className="flex h-full items-center justify-between gap-3 rounded-card border border-line bg-surface p-4">
        <p className="text-note text-rose">{t("loadError")}</p>
        <Button size="sm" variant="ghost" onClick={() => status.refetch()}>{t("retry")}</Button>
      </section>
    );
  }

  const s = status.data;
  const date = (iso: string | null) => (iso ? formatDate(locale, iso, "shortYear") : "");

  return (
    // Kalit yo‘q — bu kafedra AI ishlata olmaydi: pastel amber urg‘u (diqqat).
    <section className={cls("h-full rounded-card p-4", s.configured ? "border border-line bg-surface" : "bg-amber-soft")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={cls(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
              s.configured ? "bg-emerald-soft text-emerald" : "bg-surface/70 text-amber"
            )}
          >
            <Icon icon={s.configured ? ShieldCheck : ShieldAlert} size={18} />
          </div>
          <div className="min-w-0">
            <h2 className="text-section font-semibold text-ink">{t("title")}</h2>
            {s.configured ? (
              <>
                <p className="mt-0.5 text-body text-ink-2">
                  <span className="font-data">••••{s.last4}</span> · {t("statusSet")}
                </p>
                <p className="mt-0.5 text-note text-ink-soft">
                  {[
                    s.setByName ? t("setBy", { name: s.setByName }) : null,
                    s.setAt ? t("setAt", { date: date(s.setAt) }) : null,
                    s.checkedAt ? t("checkedAt", { date: date(s.checkedAt) }) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </>
            ) : (
              <p className="mt-0.5 text-note text-ink-2">
                {s.platformFallback ? t("whyFallback") : t("whyMissing")}
              </p>
            )}
          </div>
        </div>

        {canManage && (
          <div className="flex flex-wrap gap-2">
            {s.configured ? (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Icon icon={RefreshCw} size={15} />}
                  disabled={check.isPending}
                  onClick={() =>
                    check.mutate(undefined, {
                      onSuccess: (r) =>
                        show(r.ok ? t("checkOk") : r.reason === "unreachable" ? t("checkUnreachable") : t("checkFail")),
                    })
                  }
                >
                  {t("check")}
                </Button>
                <Button size="sm" variant="soft" icon={<Icon icon={KeyRound} size={15} />} onClick={() => setModal("replace")}>
                  {t("replace")}
                </Button>
                <Button size="sm" variant="ghost" icon={<Icon icon={Trash2} size={15} />} onClick={() => setConfirmRemove(true)}>
                  {t("remove")}
                </Button>
              </>
            ) : (
              <Button size="sm" icon={<Icon icon={KeyRound} size={15} />} onClick={() => setModal("add")}>
                {t("add")}
              </Button>
            )}
          </div>
        )}
      </div>

      {modal && <KeyModal deptId={deptId} replacing={modal === "replace"} onClose={() => setModal(null)} />}
      <ConfirmDialog
        open={confirmRemove}
        title={t("removeTitle")}
        message={t("removeMessage")}
        confirmLabel={t("remove")}
        confirmVariant="danger"
        loading={remove.isPending}
        onConfirm={() =>
          remove.mutate(undefined, {
            onSuccess: () => {
              setConfirmRemove(false);
              show(t("removed"));
            },
          })
        }
        onClose={() => setConfirmRemove(false)}
      />
    </section>
  );
}
