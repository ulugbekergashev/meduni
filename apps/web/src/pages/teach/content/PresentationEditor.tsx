import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Download, FileDown, ImageOff, Plus, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { Badge, Button, Card, Icon, Input, Spinner, Textarea, useToast, type BadgeTone } from "@meduni/ui";
import {
  API_BASE,
  useGenerateImages,
  useRegenerateImage,
  useUpdateContent,
  type ContentFull,
  type ImageSlot,
  type Slide,
  type SlotStatus,
} from "../topics/api";

const slotTone: Record<SlotStatus, BadgeTone> = { PENDING: "slate", PROCESSING: "blue", DONE: "emerald", ERROR: "rose" };

function SlotView({ slot, onRegenerate }: { slot: ImageSlot; onRegenerate: () => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "presEditor" });
  const statusText = t(`imageStatus.${slot.status.toLowerCase()}`);

  return (
    <div className="rounded-control border border-line p-2">
      <div className="flex aspect-video items-center justify-center overflow-hidden rounded-[6px] bg-bg">
        {slot.status === "DONE" && slot.url ? (
          <img src={`${API_BASE}${slot.url}`} alt="" className="h-full w-full object-contain" />
        ) : slot.status === "PROCESSING" || slot.status === "PENDING" ? (
          <Spinner size={22} />
        ) : (
          <Icon icon={ImageOff} size={26} className="text-ink-faint" />
        )}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5">
          {slot.status === "PROCESSING" && <Spinner size={12} />}
          <Badge tone={slotTone[slot.status]}>{statusText}</Badge>
        </span>
        <Button variant="ghost" size="sm" icon={<Icon icon={RefreshCw} size={14} />} onClick={onRegenerate}>
          {t("regenerateImage")}
        </Button>
      </div>
    </div>
  );
}

export function PresentationEditor({ content }: { content: ContentFull }) {
  const { t } = useTranslation(undefined, { keyPrefix: "presEditor" });
  const navigate = useNavigate();
  const { show } = useToast();
  const presId = content.presentation!.id;

  const update = useUpdateContent(content.id);
  const genImages = useGenerateImages(presId);
  const regen = useRegenerateImage(presId);

  const [slides, setSlides] = useState<Slide[]>(content.presentation!.slides);

  const patch = (i: number, p: Partial<Slide>) => setSlides((ss) => ss.map((s, j) => (j === i ? { ...s, ...p } : s)));
  const setBullet = (si: number, bi: number, val: string) =>
    patch(si, { bullets: slides[si].bullets.map((b, j) => (j === bi ? val : b)) });

  const save = () =>
    update.mutate(
      { slides: slides.map((s) => ({ id: s.id, layout: s.layout, title: s.title, bullets: s.bullets, speakerNotes: s.speakerNotes })) },
      { onSuccess: () => show(t("saved")) }
    );

  return (
    <div>
      <button
        onClick={() => navigate(`/teach/topics/${content.topicId}`)}
        className="text-[13.5px] font-medium text-brand-deep hover:underline"
      >
        {t("back")}
      </button>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h1 font-bold text-ink">{t("title")}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="soft"
            size="sm"
            icon={<Icon icon={Sparkles} size={15} />}
            onClick={() => genImages.mutate()}
            disabled={genImages.isPending}
          >
            {t("generateImages")}
          </Button>
          <a href={`${API_BASE}/api/v1/presentations/${presId}/pdf`}>
            <Button variant="ghost" size="sm" icon={<Icon icon={FileDown} size={15} />}>
              {t("downloadPdf")}
            </Button>
          </a>
          <a href={`${API_BASE}/api/v1/presentations/${presId}/pptx`}>
            <Button variant="ghost" size="sm" icon={<Icon icon={Download} size={15} />}>
              {t("downloadPptx")}
            </Button>
          </a>
          <Button onClick={save} disabled={update.isPending}>
            {t("save")}
          </Button>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {slides.map((slide, si) => (
          <Card key={slide.id} className="grid gap-4 md:grid-cols-[1fr_18rem]">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[13px] font-bold text-ink-soft">
                  {si + 1}
                  <Badge tone="violet">{slide.layout}</Badge>
                </span>
                <button
                  onClick={() => setSlides((ss) => ss.filter((_, j) => j !== si))}
                  className="rounded-control p-1.5 text-ink-faint hover:bg-rose-soft hover:text-rose"
                  aria-label={t("deleteSlide")}
                >
                  <Icon icon={Trash2} size={16} />
                </button>
              </div>

              <Input value={slide.title} onChange={(e) => patch(si, { title: e.target.value })} placeholder={t("slideTitle")} />

              <div className="space-y-2">
                {slide.bullets.map((b, bi) => (
                  <div key={bi} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                    <Input value={b} onChange={(e) => setBullet(si, bi, e.target.value)} />
                    <button
                      onClick={() => patch(si, { bullets: slide.bullets.filter((_, j) => j !== bi) })}
                      className="rounded-control p-1.5 text-ink-faint hover:bg-rose-soft hover:text-rose"
                      aria-label="remove"
                    >
                      <Icon icon={Trash2} size={14} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => patch(si, { bullets: [...slide.bullets, ""] })}
                  className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-deep hover:underline"
                >
                  <Icon icon={Plus} size={14} /> {t("addBullet")}
                </button>
              </div>

              <Textarea
                value={slide.speakerNotes}
                onChange={(e) => patch(si, { speakerNotes: e.target.value })}
                placeholder={t("speakerNotes")}
                className="text-[12.5px]"
              />
            </div>

            <div>
              {slide.imageSlots.length === 0 ? (
                <div className="flex aspect-video items-center justify-center rounded-control bg-bg text-[12px] text-ink-faint">
                  {t("noImage")}
                </div>
              ) : (
                slide.imageSlots.map((slot, sloti) => (
                  <SlotView
                    key={sloti}
                    slot={slot}
                    onRegenerate={() => regen.mutate({ slideIndex: si, slotIndex: sloti })}
                  />
                ))
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
