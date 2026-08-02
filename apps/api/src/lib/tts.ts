import { readFile, writeFile } from "fs/promises";
import path from "path";
import { generateSpeech } from "../ai/gemini";
import { ttsProvider } from "../ai/config";
import { FFMPEG, run } from "./exec";
import { pcmToWav } from "./wav";

// Umumiy TTS qatlami — video ma'ruza VA audio-podkast ikkalasi ishlatadi.
//
// Ikki dvigatel:
//   - Gemini native TTS (`gemini-2.5-flash-preview-tts`) — studiya sifati, PULLIK.
//   - edge-tts (python moduli) — BEPUL, cheklovsiz; sifat pastroq, lekin
//     20 daqiqalik podkast uchun xarajat $0.
//
// Tartibni `AI_TTS_PROVIDER` belgilaydi (def `gemini`). Qaysi biri birinchi
// bo'lsa ham, IKKINCHISI fallback bo'lib qoladi — bitta segment yiqilgani uchun
// butun podkast/video to'xtamaydi.

/** Barcha segmentlar 24 kHz mono 16-bit WAV — shunda concat toza ishlaydi. */
export const TTS_RATE = 24000;

/** edge-tts ovozlari (til:jins). */
export const EDGE_VOICES: Record<string, string> = {
  "uz:female": "uz-UZ-MadinaNeural",
  "uz:male": "uz-UZ-SardorNeural",
  "ru:female": "ru-RU-SvetlanaNeural",
  "ru:male": "ru-RU-DmitryNeural",
};

/** Gemini native TTS ovozlari (tildan mustaqil). */
export const GEMINI_VOICES: Record<"female" | "male", string> = { female: "Kore", male: "Charon" };

export interface TtsUsage {
  topicId?: number;
  departmentId?: number | null;
  userId?: number | null;
}

export interface VoicePair {
  gemini: string;
  edge: string;
}

/** Til + jins → ikkala dvigatel uchun ovoz juftligi. */
export function voicePair(lang: "uz" | "ru", gender: "female" | "male"): VoicePair {
  return { gemini: GEMINI_VOICES[gender], edge: EDGE_VOICES[`${lang}:${gender}`] };
}

async function viaGemini(text: string, voice: string, dir: string, name: string, usage: TtsUsage): Promise<number> {
  const { pcm, sampleRate } = await generateSpeech(text, voice, usage);
  await writeFile(path.join(dir, `${name}.wav`), pcmToWav(pcm, sampleRate));
  return Math.max(1, Math.round(pcm.length / (sampleRate * 2)));
}

async function viaEdge(text: string, voice: string, dir: string, name: string): Promise<number> {
  // edge-tts faylni STDIN'dan emas, fayldan o'qiydi (uzun matn + unicode uchun).
  await writeFile(path.join(dir, `${name}.txt`), text, "utf8");
  await run("python", ["-m", "edge_tts", "--voice", voice, "--file", `${name}.txt`, "--write-media", `${name}.mp3`], { cwd: dir });
  await run(FFMPEG, ["-y", "-i", `${name}.mp3`, "-ar", String(TTS_RATE), "-ac", "1", `${name}.wav`], { cwd: dir });
  const size = (await readFile(path.join(dir, `${name}.wav`))).length;
  return Math.max(1, Math.round((size - 44) / (TTS_RATE * 2)));
}

/**
 * Bitta matn bo'lagini `${name}.wav` (24 kHz mono) ga ovozlaydi.
 * Qaytaradi: davomiylik (sekund).
 */
export async function synthToWav(
  text: string,
  voices: VoicePair,
  dir: string,
  name: string,
  usage: TtsUsage = {}
): Promise<number> {
  const edgeFirst = ttsProvider() === "edge";
  try {
    return edgeFirst ? await viaEdge(text, voices.edge, dir, name) : await viaGemini(text, voices.gemini, dir, name, usage);
  } catch (err) {
    console.warn(`[tts] ${edgeFirst ? "edge" : "gemini"} failed → fallback:`, (err as Error)?.message);
    return edgeFirst ? await viaGemini(text, voices.gemini, dir, name, usage) : await viaEdge(text, voices.edge, dir, name);
  }
}
