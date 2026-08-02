import { useTranslation } from "react-i18next";
import { AlertCircle, Headphones, RefreshCw } from "lucide-react";
import { Button, Icon, Spinner, cls } from "@meduni/ui";
import { API_URL, apiErrorMessage } from "../../../lib/api";
import { useLocale } from "../../../lib/useLocale";
import { useGeneratePodcast, usePodcast } from "./api";

/**
 * Audio-podkast (~20 daqiqa) — buyurtmachi 2026-08-02.
 *
 * Konspekt qadamining ostida turadi, chunki podkast aynan TASDIQLANGAN
 * konspektdan (+ manba fayldan) yoziladi. Qurilish fon-jobda: o'qituvchi
 * sahifani yopib ketishi mumkin, holat qaytganda ko'rinadi.
 *
 * ⚠️ Progress — bosqich nomi emas, HAQIQIY hisob ("Ovoz: 12/34", §12): "montaj
 * qotib qoldi" shikoyatining sababi aynan yolg'on spinner edi.
 */
export function PodcastCard({ topicId, approved }: { topicId: number; approved: boolean }) {
  const { t } = useTranslation(undefined, { keyPrefix: "podcast" });
  const locale = useLocale();
  const q = usePodcast(topicId);
  const gen = useGeneratePodcast(topicId);

  const p = q.data ?? null;
  const building = !!p && p.status !== "done" && p.status !== "error";
  const busy = gen.isPending || building;

  const minutes = p?.durationSec ? Math.max(1, Math.round(p.durationSec / 60)) : null;

  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-violet-soft text-violet">
          <Icon icon={Headphones} size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="text-body font-extrabold text-ink">{t("title")}</h4>
          <p className="text-micro text-ink-soft">
            {p?.status === "done" && minutes ? t("ready", { minutes }) : t("hint")}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {p?.status === "done" && (
            <a
              href={`${API_URL}/api/v1/topics/${topicId}/podcast/audio`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-control border border-line px-2.5 py-1.5 text-micro font-bold text-ink-soft transition-colors hover:bg-surface-raised"
            >
              {t("listen")}
            </a>
          )}
          <Button
            size="sm"
            variant={p?.status === "done" ? "ghost" : "soft"}
            disabled={busy || !approved}
            icon={<Icon icon={p?.status === "done" ? RefreshCw : Headphones} size={15} />}
            onClick={() => gen.mutate({ rebuild: p?.status === "done" || p?.status === "error" })}
          >
            {p?.status === "done" ? t("rebuild") : t("generate")}
          </Button>
        </div>
      </div>

      {/* Konspekt tasdiqlanmagan — podkast ham tekshirilmagan matndan chiqmasin */}
      {!approved && <p className="mt-2 text-micro text-amber">{t("needApprove")}</p>}

      {/* Jonli hisob: ssenariy → ovoz */}
      {building && (
        <div className="mt-3 flex items-center gap-2 text-micro text-ink-soft">
          <Spinner size={14} />
          <span className="font-semibold">
            {p!.status === "script"
              ? t("stageScript")
              : t("stageVoice", { done: p!.progress.voiced, total: p!.progress.total })}
          </span>
          <span className="text-ink-faint">· {t("keepWorking")}</span>
        </div>
      )}
      {building && p!.progress.total > 0 && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-pill bg-line">
          <div
            className="h-full rounded-pill bg-violet transition-[width] duration-500"
            style={{ width: `${Math.round((p!.progress.voiced / p!.progress.total) * 100)}%` }}
          />
        </div>
      )}

      {p?.status === "error" && (
        <p className="mt-2 flex items-start gap-1.5 text-micro text-rose">
          <Icon icon={AlertCircle} size={13} className="mt-[1px] shrink-0" />
          <span>{p.errorStage || t("failed")}</span>
        </p>
      )}
      {gen.isError && (
        <p className="mt-2 text-micro text-rose">{apiErrorMessage(gen.error, locale === "ru" ? "ru" : "uz")}</p>
      )}

      {/* Konspekt o'zgargan — eski podkast endi mos emas */}
      {p?.status === "done" && p.stale && (
        <p className="mt-2 text-micro text-amber">{t("stale")}</p>
      )}

      {/* Boblar — o'qituvchi nima yozilganini ko'radi (talaba pleyerida ham shu) */}
      {p?.status === "done" && p.chapters.length > 0 && (
        <ol className={cls("mt-3 space-y-1 border-t border-line pt-2")}>
          {p.chapters.map((c, i) => (
            <li key={i} className="flex items-baseline gap-2 text-micro">
              <span className="tabular-nums text-ink-faint">{fmt(c.startSec)}</span>
              <span className="min-w-0 flex-1 truncate text-ink-soft">{c.title}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
