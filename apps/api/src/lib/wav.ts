/** Wrap raw 16-bit PCM into a WAV container. Video segmentlari va audio-konspekt
 *  (1C) ikkalasi ishlatadi. */
export function pcmToWav(pcm: Buffer, rate: number, ch = 1, bits = 16): Buffer {
  const blockAlign = (ch * bits) / 8;
  const byteRate = rate * blockAlign;
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8);
  h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(ch, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(byteRate, 28); h.writeUInt16LE(blockAlign, 32); h.writeUInt16LE(bits, 34);
  h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
