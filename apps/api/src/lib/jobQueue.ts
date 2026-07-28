// Og'ir media joblari uchun KETMA-KET navbat (concurrency = 1).
//
// ⚠️ NEGA KERAK (2026-07-29, jonli muammo): o'qituvchi slaydlarni va videoni
// ketma-ket bosganda ikkala fon-job BIR VAQTDA ishlardi — Nano Banana rasm
// buferi + sharp PNG render + ffmpeg + Gemini TTS bufer. Render Free'da atigi
// 512 MB xotira bor → konteyner OOM bilan o'ldirilardi, job yo'qolardi va
// o'qituvchi soatlab "Ovoz yaratilmoqda…" spinneriga qarab o'tirardi.
//
// Endi og'ir joblar navbatga qo'yiladi: bir vaqtda bittasi ishlaydi. Sekinroq
// emas (baribir CPU/xotira bitta), lekin OMON QOLADI.
type Job = () => Promise<void>;

let chain: Promise<void> = Promise.resolve();
let queued = 0;
let running: string | null = null;

/** Navbatga qo'shadi va darrov qaytadi (fon-job). Xato butun navbatni buzmaydi. */
export function enqueueMediaJob(name: string, job: Job): void {
  queued++;
  chain = chain.then(async () => {
    queued--;
    running = name;
    try {
      await job();
    } catch (e) {
      console.error(`[jobQueue] ${name}:`, e);
    } finally {
      running = null;
    }
  });
}

export function mediaQueueState() {
  return { running, queued };
}
