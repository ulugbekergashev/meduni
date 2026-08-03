import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  const blobs = new Set((await prisma.fileBlob.findMany({ select: { path: true } })).map((b) => b.path));
  console.log("file_blobs:", blobs.size);

  const miss: string[] = [];
  const have = (p: string | null | undefined) => (p ? blobs.has(p) : null);
  const rep = (label: string, p: string | null | undefined) => {
    if (!p) return;
    if (!blobs.has(p)) miss.push(`${label} -> ${p}`);
  };

  const videos = await prisma.video.findMany({ include: { contentItem: { select: { id: true, topicId: true, status: true } } } });
  for (const v of videos) {
    const tag = `VIDEO id=${v.id} topic=${v.contentItem.topicId} status=${v.contentItem.status} build=${v.buildStatus}`;
    rep(`${tag} audio`, v.audioUrl);
    rep(`${tag} mp4`, v.mp4Url);
    rep(`${tag} srt`, v.srtUrl);
    const segs = (v.scriptJson as any[]) ?? [];
    segs.forEach((s, i) => {
      rep(`${tag} frame${i}`, s?.visualImageUrl);
      rep(`${tag} segAudio${i}`, s?.audioUrl);
    });
  }

  const pres = await prisma.presentation.findMany({ include: { contentItem: { select: { topicId: true, status: true } } } });
  for (const p of pres) {
    const tag = `PRES id=${p.id} topic=${p.contentItem.topicId} status=${p.contentItem.status}`;
    const slides = (p.slidesJson as any[]) ?? [];
    slides.forEach((s, i) =>
      (s?.imageSlots ?? []).forEach((slot: any, j: number) => {
        if (slot?.status === "DONE") rep(`${tag} slide${i}/${j}`, slot.url);
        else if (slot?.url) rep(`${tag} slide${i}/${j}(${slot.status})`, slot.url);
      })
    );
  }

  const mats = await prisma.sourceMaterial.findMany();
  for (const m of mats) {
    rep(`MATERIAL id=${m.id} topic=${m.topicId} parse=${m.parseStatus} file`, m.fileUrl);
    rep(`MATERIAL id=${m.id} topic=${m.topicId} text`, m.parsedTextUrl);
  }

  const pods = await prisma.topicPodcast.findMany();
  for (const p of pods) rep(`PODCAST topic=${p.topicId} build=${p.buildStatus} audio`, p.audioUrl);

  const digests = await prisma.topicDigest.findMany({ select: { topicId: true, version: true, approvedByTeacher: true } });
  for (const d of digests) {
    const path = `topics/${d.topicId}/digest-audio-v${d.version}.wav`;
    console.log(`DIGEST topic=${d.topicId} v${d.version} approved=${d.approvedByTeacher} audio=${blobs.has(path)}`);
  }

  console.log("\n=== MISSING FILES ===");
  if (!miss.length) console.log("(none)");
  miss.forEach((m) => console.log(m));

  // Content items published but whose media is broken
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
