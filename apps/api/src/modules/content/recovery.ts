// Uzilib qolgan generatsiya joblarini tiklash (server ishga tushganda).
//
// ⚠️ NEGA KERAK: video montaji va rasm generatsiyasi — SHU JARAYON ichidagi fon
// joblari (`setImmediate`). Jarayon qayta ishga tushsa (deploy, Render Free
// uxlashi, crash, dev-serverning hot-restarti) job o'ladi, lekin bazadagi holat
// "ishlayapti" bo'lib QOLADI: `Video.buildStatus = SCRIPT|TTS|RENDER` yoki
// slayd `imageSlots[].status = PROCESSING`.
//
// Natijada o'qituvchi panelida abadiy "Ovoz yaratilmoqda…" spinneri turardi —
// aslida hech narsa ishlamayotgan bo'lsa ham. Ya'ni UI yolg'on gapirardi va
// o'qituvchi qancha kutsa ham hech narsa o'zgarmasdi.
//
// Yangi jarayon boshlanganda AVVALGI jarayonning joblari ta'rifiga ko'ra o'lik
// bo'ladi — shuning uchun ularni ERROR ga o'tkazamiz: UI "uzilib qoldi" deb
// ko'rsatadi va "Qayta urinish" tugmasi ishlaydi.
import { prisma } from "../../lib/prisma";
import type { Slide } from "../../ai/types";

/** Video montajining oraliq (terminal bo'lmagan) holatlari. PENDING ham shu
 *  yerda: pipeline `setImmediate` bilan darrov boshlanadi, ya'ni yangi jarayon
 *  ko'tarilganda PENDING'da qolgan video — eskisining o'lik qoldig'i. */
const RUNNING_VIDEO = ["PENDING", "SCRIPT", "TTS", "RENDER"] as const;

export async function recoverStaleJobs(): Promise<void> {
  try {
    const videos = await prisma.video.updateMany({
      where: { buildStatus: { in: RUNNING_VIDEO as unknown as ("PENDING" | "SCRIPT" | "TTS" | "RENDER")[] } },
      data: { buildStatus: "ERROR", errorStage: "interrupted" },
    });

    // Rasm slotlari slaydlar JSON ichida — har prezentatsiyani alohida yangilaymiz.
    const presentations = await prisma.presentation.findMany({ select: { id: true, slidesJson: true } });
    let slotCount = 0;
    for (const p of presentations) {
      const slides = (p.slidesJson as unknown as Slide[]) ?? [];
      let touched = false;
      const next = slides.map((s) => ({
        ...s,
        imageSlots: (s.imageSlots ?? []).map((slot) => {
          if (slot.status !== "PROCESSING") return slot;
          touched = true;
          slotCount++;
          return { ...slot, status: "ERROR" as const };
        }),
      }));
      if (touched) {
        await prisma.presentation.update({ where: { id: p.id }, data: { slidesJson: next as never } });
      }
    }

    if (videos.count || slotCount) {
      console.log(`  tiklash    : ${videos.count} video, ${slotCount} rasm sloti uzilib qolgan deb belgilandi`);
    }
  } catch (e) {
    // Tiklash server ishga tushishiga TO'SIQ bo'lmasligi kerak.
    console.error("[recoverStaleJobs]", e);
  }
}
