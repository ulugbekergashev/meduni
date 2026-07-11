import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Plus, Sparkles, Trash2, TriangleAlert } from "lucide-react";
import { Button, Card, Icon, Input, Spinner, useToast } from "@meduni/ui";
import { apiErrorMessage } from "../../../lib/api";
import { useLocale } from "../../../lib/useLocale";
import {
  useApproveDigest,
  useGenerateDigest,
  useUpdateDigest,
  type DigestJson,
  type Term,
  type TopicDetail,
} from "./api";

// ---- editable primitives ----

function EditableList({
  items,
  onChange,
  accent,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  accent?: boolean;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: "digest" });
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className={
              "mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full " + (accent ? "bg-amber" : "bg-brand")
            }
          />
          <Input
            value={item}
            onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
          />
          <button
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="rounded-control p-1.5 text-ink-faint hover:bg-rose-soft hover:text-rose"
            aria-label="remove"
          >
            <Icon icon={Trash2} size={15} />
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...items, ""])}
        className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-deep hover:underline"
      >
        <Icon icon={Plus} size={14} /> {t("addItem")}
      </button>
    </div>
  );
}

function TermsTable({ terms, onChange }: { terms: Term[]; onChange: (next: Term[]) => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "digest" });
  const set = (i: number, key: keyof Term, val: string) =>
    onChange(terms.map((tm, j) => (j === i ? { ...tm, [key]: val } : tm)));

  return (
    <div className="space-y-2">
      <div className="hidden grid-cols-[1fr_1fr_1fr_auto] gap-2 px-1 text-[12px] font-semibold uppercase tracking-wide text-ink-faint sm:grid">
        <span>{t("termRu")}</span>
        <span>{t("termUz")}</span>
        <span>{t("termLat")}</span>
        <span />
      </div>
      {terms.map((tm, i) => (
        <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <Input value={tm.ru} onChange={(e) => set(i, "ru", e.target.value)} placeholder={t("termRu")} />
          <Input value={tm.uz} onChange={(e) => set(i, "uz", e.target.value)} placeholder={t("termUz")} />
          <Input value={tm.lat} onChange={(e) => set(i, "lat", e.target.value)} placeholder={t("termLat")} />
          <button
            onClick={() => onChange(terms.filter((_, j) => j !== i))}
            className="justify-self-end rounded-control p-1.5 text-ink-faint hover:bg-rose-soft hover:text-rose"
            aria-label="remove"
          >
            <Icon icon={Trash2} size={15} />
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...terms, { ru: "", uz: "", lat: "" }])}
        className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-deep hover:underline"
      >
        <Icon icon={Plus} size={14} /> {t("addRow")}
      </button>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-ink-soft">{title}</h3>
      {children}
    </div>
  );
}

// ---- section ----

export function DigestSection({ topic }: { topic: TopicDetail }) {
  const { t } = useTranslation(undefined, { keyPrefix: "digest" });
  const locale = useLocale();
  const { show } = useToast();

  const generate = useGenerateDigest(topic.id);
  const update = useUpdateDigest(topic.id);
  const approve = useApproveDigest(topic.id);

  const server = topic.digest;
  const [draft, setDraft] = useState<DigestJson | null>(server?.digestJson ?? null);

  // Re-sync the draft whenever the server digest changes (generate/save).
  useEffect(() => {
    setDraft(server?.digestJson ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server?.version, server === null]);

  const dirty = useMemo(
    () => !!draft && !!server && JSON.stringify(draft) !== JSON.stringify(server.digestJson),
    [draft, server]
  );

  // No digest yet — generate.
  if (!server || !draft) {
    return (
      <Card>
        {generate.isPending ? (
          <div className="flex items-center gap-3 py-4">
            <Spinner size={20} />
            <p className="text-[13.5px] text-ink-soft">{t("generating")}</p>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3">
            <p className="text-[13.5px] text-ink-soft">{t("generateHint")}</p>
            {generate.isError && (
              <p className="text-[13px] text-rose">{apiErrorMessage(generate.error, locale) ?? t("generateError")}</p>
            )}
            <Button icon={<Icon icon={Sparkles} size={16} />} onClick={() => generate.mutate()}>
              {t("generate")}
            </Button>
          </div>
        )}
      </Card>
    );
  }

  const patch = (p: Partial<DigestJson>) => setDraft({ ...draft, ...p });

  return (
    <div className="space-y-4">
      <Card className="space-y-6">
        <Block title={t("objectives")}>
          <EditableList items={draft.objectives} onChange={(v) => patch({ objectives: v })} />
        </Block>
        <Block title={t("concepts")}>
          <EditableList items={draft.concepts} onChange={(v) => patch({ concepts: v })} />
        </Block>
        <Block title={t("terms")}>
          <TermsTable terms={draft.terms} onChange={(v) => patch({ terms: v })} />
        </Block>
        <Block title={t("facts")}>
          <EditableList items={draft.facts} onChange={(v) => patch({ facts: v })} />
        </Block>
        <Block title={t("imageIdeas")}>
          <EditableList items={draft.imageIdeas} onChange={(v) => patch({ imageIdeas: v })} />
        </Block>
      </Card>

      {/* Dosages — medically sensitive, highlighted */}
      <Card className="border-amber/30 bg-amber-soft">
        <div className="mb-2 flex items-center gap-2">
          <Icon icon={TriangleAlert} size={16} className="text-amber" />
          <h3 className="text-[13px] font-bold uppercase tracking-wide text-amber">{t("dosages")}</h3>
        </div>
        <p className="mb-3 text-[12px] text-ink-soft">{t("dosagesNote")}</p>
        <EditableList items={draft.dosages} onChange={(v) => patch({ dosages: v })} accent />
      </Card>

      {/* Save row */}
      {dirty && (
        <div className="flex items-center gap-3">
          <Button
            onClick={() =>
              update.mutate(draft, { onSuccess: () => show(t("saved")) })
            }
            disabled={update.isPending}
          >
            {t("save")}
          </Button>
          <span className="text-[12.5px] text-ink-faint">v{server.version}</span>
        </div>
      )}

      {/* Approve block — first control point */}
      <Card className={server.approvedByTeacher && !dirty ? "border-emerald/30 bg-emerald-soft" : ""}>
        {server.approvedByTeacher && !dirty ? (
          <div className="flex items-center gap-2 text-emerald">
            <Icon icon={Check} size={18} />
            <span className="text-[14px] font-semibold">{t("approved")}</span>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-control bg-amber-soft px-3 py-2 text-[12.5px] text-amber">
              <Icon icon={TriangleAlert} size={15} className="mt-0.5 shrink-0" />
              <span>{t("approveWarning")}</span>
            </div>
            <Button
              variant="deep"
              disabled={dirty || approve.isPending}
              onClick={() => approve.mutate(undefined, { onSuccess: () => show(t("approvedToast")) })}
            >
              {t("approve")}
            </Button>
            {dirty && <p className="text-[12.5px] text-ink-faint">{t("saveBeforeApprove")}</p>}
          </div>
        )}
      </Card>
    </div>
  );
}
