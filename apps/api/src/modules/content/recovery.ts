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
import { resumeVideo } from "./video";
import { resumePodcast } from "./podcast";

/** Video montajining oraliq (terminal bo'lmagan) holatlari. PENDING ham shu
 *  yerda: pipeline `setImmediate` bilan darrov boshlanadi, ya'ni yangi jarayon
 *  ko'tarilganda PENDING'da qolgan video — eskisining o'lik qoldig'i. */
const RUNNING_VIDEO = ["PENDING", "SCRIPT", "TTS", "RENDER"] as const;

/** Necha marta avtomatik davom ettiramiz. Har urinish oldingi ishni (ovozlangan
 *  segmentlar, generatsiya qilingan rasmlar) QAYTA ISHLATADI — ya'ni har safar
 *  oldinga siljiydi va qayta to'lov bo'lmaydi. Shu bois 3 urinish yetadi;
 *  keyin to'xtaymiz (cheksiz sikl bo'lmasin). */
const MAX_AUTO_RESUME = 3;

/**
 * ⚠️ BITTA BOOTDA NECHTA og'ir job qayta boshlanadi.
 *
 * 2026-08-02 (jonli server o'lib qoldi): oldingi uzilishdan keyin bazada UCHTA
 * video "ishlayapti" holatida qolgan edi va server ko'tarilishi bilan uchalasi
 * ham navbatga tushdi. Navbat concurrency=1 bo'lsa ham, 512 MB / 0.1 CPU
 * konteynerда birinchi jobning o'zi event loop'ni bo'g'adi → Render health
 * check javob olmaydi → konteynerni o'ldiradi → boot → yana resume…
 *
 * Endi bootда ENG KO'PI BITTA ish davom ettiriladi; qolganlari ERROR bo'lib
 * turadi va o'qituvchi "Davom ettirish" tugmasi bilan o'zi boshlaydi (ish
 * yo'qolmaydi — ovozlangan segmentlar keshda).
 */
const MAX_RESUME_PER_BOOT = Number(process.env.MAX_RESUME_PER_BOOT ?? 1);

/** `interrupted`, `interrupted (2)`, `interrupted (3)` → urinish raqami.
 *  `interrupted_giveup` → limit (qaytadan avtomatik urinilmaydi; faqat
 *  o'qituvchi o'zi bosganda hisob nolga tushadi). */
function attemptOf(errorStage: string | null): number {
  if (errorStage === "interrupted_giveup") return MAX_AUTO_RESUME;
  const m = /^interrupted(?: \((\d+)\))?$/.exec(errorStage ?? "");
  return m ? Number(m[1] ?? 1) : 0;
}

export async function recoverStaleJobs(): Promise<void> {
  let resumed = 0;
  try {
    // Uzilgan montajlar — belgilashdan OLDIN o'qiymiz (davom ettirish uchun).
    const stale = await prisma.video.findMany({
      where: { buildStatus: { in: RUNNING_VIDEO as unknown as ("PENDING" | "SCRIPT" | "TTS" | "RENDER")[] } },
      select: { id: true, errorStage: true },
    });

    const videos = await prisma.video.updateMany({
      where: { buildStatus: { in: RUNNING_VIDEO as unknown as ("PENDING" | "SCRIPT" | "TTS" | "RENDER")[] } },
      data: { buildStatus: "ERROR", errorStage: "interrupted" },
    });

    // ⚠️ Faqat ERROR qilib qo'yish YETARLI EMAS edi: o'qituvchi soatlab kutib,
    // keyin o'zi "Qayta generatsiya" bosishi kerak edi (va ish NOLDAN ketardi).
    // Endi server ko'tarilganda uzilgan montaj O'ZI davom etadi — ovozlangan
    // segmentlar keshdan olinadi, faqat qolgani ishlanadi.
    for (const v of stale) {
      const attempt = attemptOf(v.errorStage) + 1;
      if (attempt > MAX_AUTO_RESUME) {
        await prisma.video.update({ where: { id: v.id }, data: { errorStage: "interrupted_giveup" } });
        console.log(`  tiklash    : video ${v.id} — ${MAX_AUTO_RESUME} marta uzildi, avtomatik davom ettirilmaydi`);
        continue;
      }
      await prisma.video.update({
        where: { id: v.id },
        data: { errorStage: attempt > 1 ? `interrupted (${attempt})` : "interrupted" },
      });
      if (resumed >= MAX_RESUME_PER_BOOT) {
        console.log(`  tiklash    : video ${v.id} navbatda qoldirildi (bootда ${MAX_RESUME_PER_BOOT} ish chegarasi)`);
        continue;
      }
      resumed++;
      await resumeVideo(v.id).catch((e) => console.error("[recoverStaleJobs] resume", v.id, e));
      console.log(`  tiklash    : video ${v.id} davom ettirilmoqda (urinish ${attempt}/${MAX_AUTO_RESUME})`);
    }

    // Audio-podkast — xuddi shu naqsh (u ham uzun fon-job: ssenariy + o'nlab
    // TTS chaqiruvi). Ovozlangan replikalar keshda, shuning uchun davom ettirish
    // arzon va har safar oldinga siljiydi.
    const stalePods = await prisma.topicPodcast.findMany({
      where: { buildStatus: { in: ["PENDING", "SCRIPT", "TTS", "RENDER"] } },
      select: { id: true, errorStage: true },
    });
    for (const p of stalePods) {
      const attempt = attemptOf(p.errorStage) + 1;
      if (attempt > MAX_AUTO_RESUME) {
        await prisma.topicPodcast.update({ where: { id: p.id }, data: { buildStatus: "ERROR", errorStage: "interrupted_giveup" } });
        console.log(`  tiklash    : podkast ${p.id} — ${MAX_AUTO_RESUME} marta uzildi, avtomatik davom ettirilmaydi`);
        continue;
      }
      await prisma.topicPodcast.update({
        where: { id: p.id },
        data: { buildStatus: "ERROR", errorStage: attempt > 1 ? `interrupted (${attempt})` : "interrupted" },
      });
      if (resumed >= MAX_RESUME_PER_BOOT) {
        console.log(`  tiklash    : podkast ${p.id} navbatda qoldirildi (bootда ${MAX_RESUME_PER_BOOT} ish chegarasi)`);
        continue;
      }
      resumed++;
      await resumePodcast(p.id).catch((e) => console.error("[recoverStaleJobs] podcast", p.id, e));
      console.log(`  tiklash    : podkast ${p.id} davom ettirilmoqda (urinish ${attempt}/${MAX_AUTO_RESUME})`);
    }

    // Rasm slotlari slaydlar JSON ichida — har prezentatsiyani alohida yangilaymiz.
    const presentations = await prisma.presentation.findMany({ select: { id: true, slidesJson: true } });
    let slotCount = 0;
    for (const p of presentations) {
      const slides = (p.slidesJson as unknown as Slide[]) ?? [];
      let touched = false;
      const next = slides.map((s) => ({
        ...s,
        imageSlots: (s.imageSlots ?? []).map((slot) => {
          // ⚠️ PENDING ham hisobga olinadi: rasm joblari navbatga qo'yiladi va
          // jarayon o'lsa navbatdagilar ABADIY "kutmoqda" bo'lib qolardi
          // (2026-08-01 da baza uzilganда aynan shunday bo'ldi: 4 rasm tayyor,
          // qolgan 4 tasi hech qachon boshlanmadi va UI buni aytmasdi).
          if (slot.status !== "PROCESSING" && slot.status !== "PENDING") return slot;
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
