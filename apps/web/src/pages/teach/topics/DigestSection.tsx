import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Check, Eye, Pencil, Sparkles, TriangleAlert } from "lucide-react";
import { Button, Card, Icon, Spinner, useToast } from "@meduni/ui";
import { apiErrorMessage } from "../../../lib/api";
import { useLocale } from "../../../lib/useLocale";
import { DigestEditor } from "./DigestEditor";
import { DigestPreview } from "./DigestPreview";
import { PodcastCard } from "./PodcastCard";
import {
  useApproveDigest,
  useGenerateDigest,
  useUpdateDigest,
  type DigestCheckpoint,
  type DigestJson,
  type DigestSection as DigestSectionData,
  type TopicDetail,
} from "./api";

/**
 * Konspekt qadami (konstruktor 2-bosqichi).
 *
 * 2026-08-02 — buyurtmachi "o'qituvchi qo'rqib ketadi" shikoyati bo'yicha:
 * qadam endi **O'QISH** rejimida ochiladi (`DigestPreview`), asosiy amal esa
 * bitta tugma — "Tasdiqlash va davom etish". Tahrirlagich (20-60+ input)
 * "Tahrirlash" bosilgandan keyin chiziladi (`DigestEditor`).
 *
 * `draft` shu konteynerda turadi — rejim almashganda tahrir YO'QOLMAYDI.
 * Rejim sukut bo'yicha URL'da emas (`?step=digest` deep-linki tinch ko'rinishga
 * tushsin), lekin `?edit=1` bilan to'g'ridan tahrirga kirish mumkin.
 */
export function DigestSection({ topic }: { topic: TopicDetail }) {
  const { t } = useTranslation(undefined, { keyPrefix: "digest" });
  const locale = useLocale();
  const { show } = useToast();

  const generate = useGenerateDigest(topic.id);
  const update = useUpdateDigest(topic.id);
  const approve = useApproveDigest(topic.id);
  const [params, setParams] = useSearchParams();

  const server = topic.digest;
  const [draft, setDraft] = useState<DigestJson | null>(server?.digestJson ?? null);
  const [editing, setEditing] = useState(params.get("edit") === "1");

  /** Tasdiqlangach o'qituvchi darrov generatsiyada bo'ladi — "Keyingi"ni
   *  qidirib o'tirmaydi. */
  const goGenerate = () => {
    const p = new URLSearchParams(params);
    p.set("step", "generate");
    p.delete("autogen");
    p.delete("edit");
    setParams(p);
  };

  // Material qadamidan "Konspekt yaratish" bilan kelinganда — darrov boshlanadi
  // (o'qituvchi yana bitta tugma qidirmaydi). Faqat BIR marta.
  const autogen = params.get("autogen") === "1";
  const started = useRef(false);
  useEffect(() => {
    if (!autogen || server || started.current || generate.isPending) return;
    started.current = true;
    generate.mutate(undefined, {
      onSettled: () => {
        const p = new URLSearchParams(params);
        p.delete("autogen");
        setParams(p, { replace: true });
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autogen, !!server]);

  useEffect(() => {
    setDraft(server?.digestJson ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server?.version, server === null]);

  const dirty = useMemo(
    () => !!draft && !!server && JSON.stringify(draft) !== JSON.stringify(server.digestJson),
    [draft, server]
  );

  if (!server || !draft) {
    return (
      <Card>
        {generate.isPending ? (
          <div className="flex items-center gap-3 py-4">
            <Spinner size={20} />
            <p className="text-body text-ink-soft">{t("generating")}</p>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3">
            <p className="text-body text-ink-soft">{t("generateHint")}</p>
            {generate.isError && (
              <p className="text-body text-rose">{apiErrorMessage(generate.error, locale) ?? t("generateError")}</p>
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
  const approved = server.approvedByTeacher && !dirty;

  /** Tasdiqlash = (kerak bo'lsa) saqlash + tasdiqlash + keyingi qadamga o'tish.
   *  Ilgari bu uchta alohida harakat edi. */
  const saveAndApprove = () => {
    const finish = () =>
      approve.mutate(undefined, {
        onSuccess: () => {
          show(t("approvedToast"));
          goGenerate();
        },
      });
    if (dirty) update.mutate(draft, { onSuccess: finish });
    else finish();
  };

  const sections = (draft.sections ?? []) as DigestSectionData[];
  const setCheckpoint = (i: number, cp: DigestCheckpoint | null) =>
    setDraft({ ...draft, sections: sections.map((s, j) => (j === i ? { ...s, checkpoint: cp } : s)) });

  const busy = approve.isPending || update.isPending;

  return (
    <div className="space-y-3">
    <Card className="p-0">
      {editing ? (
        <DigestEditor draft={draft} onPatch={patch} sections={sections} onSetCheckpoint={setCheckpoint} />
      ) : (
        <DigestPreview draft={draft} />
      )}

      {/* Sticky amal paneli — asosiy amal HAR DOIM bitta: tasdiqlash. */}
      <div className="sticky bottom-0 flex flex-wrap items-center gap-3 rounded-b-card border-t border-line bg-surface px-5 py-3">
        {approved ? (
          <span className="inline-flex items-center gap-1.5 text-body font-semibold text-emerald">
            <Icon icon={Check} size={16} /> {t("approved")}
          </span>
        ) : (
          <>
            {dirty && (
              <Button
                size="sm"
                variant="soft"
                onClick={() => update.mutate(draft, { onSuccess: () => show(t("saved")) })}
                disabled={busy}
              >
                {t("save")}
              </Button>
            )}
            {/* ⚠️ Ilgari tahrir qilingan bo'lsa "Tasdiqlash" O'CHIQ turardi va
                o'qituvchi avval "Saqlash"ni topishi kerak edi. Endi bitta amal:
                kerak bo'lsa o'zi saqlaydi, keyin tasdiqlaydi (qulf saqlanadi —
                tasdiq baribir ONGLI bosish). */}
            <Button size="sm" variant="deep" disabled={busy} onClick={saveAndApprove}>
              {t("approveAndNext")}
            </Button>
          </>
        )}

        {/* O'qish ↔ tahrir */}
        <Button
          size="sm"
          variant="ghost"
          icon={<Icon icon={editing ? Eye : Pencil} size={15} />}
          onClick={() => setEditing((e) => !e)}
        >
          {editing ? t("modeRead") : t("modeEdit")}
        </Button>

        {!approved && (
          <span className="inline-flex items-center gap-1 text-[12.5px] text-amber">
            <Icon icon={TriangleAlert} size={12} /> {t("approveWarning")}
          </span>
        )}
        {dirty && (
          <span className="text-[12.5px] font-semibold text-amber">{t("unsaved")}</span>
        )}

        {/* ⚠️ "Audio yaratish" tugmasi OLIB TASHLANDI (2026-08-02): u 4500 belgi
            bilan cheklangan qisqa o'qish edi va endi uning o'rnini pastdagi
            PODKAST kartasi egalladi (~20 daq, mavzuni to'liq ochadi). Ikkita
            audio tugmasi bir ekranda — §4 "bitta fakt, bitta joy" buzilishi. */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[12.5px] text-ink-faint">v{server.version}</span>
        </div>
      </div>
    </Card>

    {/* Audio-podkast — tasdiqlangan konspekt + manba fayldan */}
    <PodcastCard topicId={topic.id} approved={server.approvedByTeacher} />
    </div>
  );
}
