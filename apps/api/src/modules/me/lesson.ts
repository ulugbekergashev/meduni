import { Prisma, prisma } from "../../lib/prisma";
import { ApiError, badRequest, notFound } from "../../lib/errors";
import { readFileBuffer, readText } from "../../lib/storage";
import { buildPdf } from "../content/presentation";
import { digestAudioRel, hasDigestAudio } from "../topics/service";
import { clampQuiz, FALLBACK_POLICY, resolvePolicy } from "../policy/service";
import {
  assertPresence,
  assertSameDevice,
  buildOrder,
  integrityFlags,
  readIntegrity,
  readOrder,
  toOriginalIndex,
  toShownIndex,
} from "./integrity";
import { chaptersFromScript, type PodcastChapter } from "../content/podcast";
import type { CaseJson, DigestJson, PodcastSegment, ScriptSegment, Slide } from "../../ai/types";
import {
  assertTopicOpen,
  computeTopics,
  enrolledCourseIdForTopic,
  forbiddenLocked,
  forbiddenNotEnrolled,
  loadCourse,
  recomputeTopic,
  studentFactsMap,
  syncTopicProgress,
  type TopicOut,
} from "./service";

const persistAndReport = syncTopicProgress;

// ---------- Content shapes ----------

function questionOptions(optionsJson: unknown): string[] {
  return (optionsJson as string[]) ?? [];
}

// ---------- GET /me/topics/:id — the full lesson payload ----------

export async function getTopicLesson(studentId: number, topicId: number) {
  // ⚠️ TEZLIK: baza uzoq regionda — har so'rov ~200-300ms. Bir-biriga bog'liq
  // bo'lmagan so'rovlarni KETMA-KET emas, PARALLEL yuboramiz (dars sahifasi
  // ~8 ta so'rov qiladi; ketma-ket bo'lsa bu 2-3 soniya sof kutish demak).
  // Mavzu yuklanishi kirish tekshiruvidan mustaqil — birga boshlanadi.
  const topicPromise = prisma.topic.findUnique({
    where: { id: topicId },
    include: {
      contentItems: {
        where: { status: "PUBLISHED" },
        include: { quiz: { include: { questions: { orderBy: { orderIndex: "asc" } } } }, clinicalCase: true, presentation: true, video: true },
      },
      materials: { orderBy: { createdAt: "asc" } },
      links: { orderBy: [{ orderIndex: "asc" }, { id: "asc" }] },
      digest: true,
    },
    // ⚠️ `relationLoadStrategy: "join"` OLIB TASHLANDI — o'lchov service.ts
    // dagi izohda: ko'p savolli mavzuda u 19x SEKIN edi (dekart ko'paytmasi).
  });
  const progressPromise = prisma.progress.findUnique({ where: { studentId_topicId: { studentId, topicId } } });
  const readsPromise = prisma.sectionRead.findMany({ where: { studentId, topicId }, select: { sectionIndex: true } });

  // ⚠️ Quyidagi kirish tekshiruvi 403 tashlashi mumkin — o'shanda yuqoridagi
  // so'rovlar EGASIZ qoladi. Ular keyin rad etilsa Node "unhandledRejection"
  // deb butun jarayonni o'ldiradi (prod'da shu sabab crash-loop bo'lgan).
  // Bo'sh `.catch` xatoni yutmaydi: `await` paytida u baribir otiladi, faqat
  // egasiz qolgan holatda jarayon yiqilmaydi.
  const keepSafe = <T>(p: Promise<T>): Promise<T> => {
    p.catch(() => undefined);
    return p;
  };
  keepSafe(topicPromise);
  keepSafe(progressPromise);
  keepSafe(readsPromise);

  // Enrolled + published + unlocked tekshiruvi — bitta hisob-kitobda: shu yerda
  // "keyingi mavzu" ham chiqadi (dars tugagach to'g'ridan o'tish uchun).
  const enrolledCourseId = await enrolledCourseIdForTopic(studentId, topicId);
  if (enrolledCourseId === null) throw forbiddenNotEnrolled();
  const enrolledCourse = await loadCourse(enrolledCourseId);
  const facts = await studentFactsMap(studentId, enrolledCourse);
  const computed = computeTopics(enrolledCourse, facts);
  const idx = computed.findIndex((t) => t.id === topicId);
  if (idx === -1) throw notFound("Mavzu"); // not published -> invisible to students
  const state = computed[idx];
  if (state.state === "LOCKED") throw forbiddenLocked(state.reason ?? undefined);
  const nextTopic = computed[idx + 1] ?? null;

  // Yuqorida boshlangan so'rov — bu yerda tayyor bo'ladi (kutish yo'q).
  const topic = await topicPromise;
  if (!topic) throw notFound("Mavzu");

  const videoItem = topic.contentItems.find((c) => c.kind === "VIDEO");
  const slidesItem = topic.contentItems.find((c) => c.kind === "PRESENTATION");
  const quizItem = topic.contentItems.find((c) => c.kind === "QUIZ");
  const caseItem = topic.contentItems.find((c) => c.kind === "CASE");

  // Konspekt bo'limlari + shu talaba qaysilarini o'qigani (1a "O'qildi n/N").
  const digestJson = topic.digest?.approvedByTeacher
    ? (topic.digest.digestJson as unknown as DigestJson)
    : null;
  const sectionsRaw = digestJson?.sections ?? [];
  const readSet = new Set((await readsPromise).map((r) => r.sectionIndex));

  // Qolgan mustaqil so'rovlar ham shu yerdan PARALLEL ketadi (test urinishlari,
  // keys javobi, bemor baholashi, audio mavjudligi) — pastda natijasi olinadi.
  const quizForMeta = topic.contentItems.find((c) => c.kind === "QUIZ")?.quiz ?? null;
  const caseForMeta = topic.contentItems.find((c) => c.kind === "CASE")?.clinicalCase ?? null;
  const quizAttemptsPromise = quizForMeta
    ? prisma.quizAttempt.findMany({ where: { studentId, quizId: quizForMeta.id }, orderBy: { attemptNo: "desc" } })
    : Promise.resolve([]);
  keepSafe(quizAttemptsPromise);
  const caseAttemptPromise = caseForMeta
    ? prisma.caseAttempt.findUnique({ where: { studentId_caseId: { studentId, caseId: caseForMeta.id } } })
    : Promise.resolve(null);
  keepSafe(caseAttemptPromise);
  const patientEvalPromise =
    caseForMeta || topic.digest?.approvedByTeacher === true
      ? prisma.patientMessage.findFirst({ where: { studentId, topicId, role: "eval" }, select: { id: true } })
      : Promise.resolve(null);
  keepSafe(patientEvalPromise);
  const digestAudioPromise = topic.digest?.approvedByTeacher
    ? hasDigestAudio(topicId, topic.digest.version)
    : Promise.resolve(false);
  // Audio-podkast: FAQAT tayyor (audioUrl bor) va konspekt tasdiqlangan bo'lsa.
  // Yarim qurilgan podkast talaba uchun kontent emas (video saboqi — o'lik blok).
  const podcastPromise: Promise<{ durationSec: number | null; chapters: PodcastChapter[] } | null> = topic.digest
    ?.approvedByTeacher
    ? prisma.topicPodcast.findUnique({ where: { topicId } }).then((p) =>
        p?.audioUrl
          ? {
              durationSec: p.durationSec,
              chapters: chaptersFromScript((p.scriptJson as unknown as PodcastSegment[]) ?? []),
            }
          : null
      )
    : Promise.resolve(null);
  keepSafe(podcastPromise);

  // Faza 1: bo'lim ichiga media — o'sha bo'limni yorituvchi slayd diagrammasi va
  // videodagi boshlanish vaqti (Faza 0 sectionId xaritasi orqali). Bo'lim id'si
  // bo'lmagan/mos slayd-segment bo'lmagan eski kontentda bo'sh (graceful).
  const presId = slidesItem?.presentation?.id ?? null;
  const presSlides = slidesItem?.presentation ? (slidesItem.presentation.slidesJson as unknown as Slide[]) : [];
  const slideImagesBySection = new Map<string, { slideId: string; url: string }[]>();
  presSlides.forEach((s, si) => {
    if (!s.sectionId || s.imageSlots?.[0]?.status !== "DONE" || presId === null) return;
    const arr = slideImagesBySection.get(s.sectionId) ?? [];
    arr.push({ slideId: s.id, url: `/api/v1/me/presentations/${presId}/image/${si}/0` });
    slideImagesBySection.set(s.sectionId, arr);
  });
  // Videodagi boshlanish sekundi = shu bo'limga tegishli BIRINCHI segmentgacha
  // bo'lgan davomiyliklar yig'indisi. Faqat tayyor (mp4) videoda.
  const videoSegs = videoItem?.video?.mp4Url ? ((videoItem.video.scriptJson as unknown as ScriptSegment[]) ?? []) : [];
  const videoAtBySection = new Map<string, number>();
  let segAcc = 0;
  for (const seg of videoSegs) {
    if (seg.sectionId && !videoAtBySection.has(seg.sectionId)) videoAtBySection.set(seg.sectionId, Math.floor(segAcc));
    segAcc += seg.durationSec || 0;
  }

  const sections = sectionsRaw.map((s, i) => ({
    index: i,
    title: s.title,
    minutes: s.minutes,
    sourceRef: s.sourceRef || null,
    blocks: s.blocks,
    read: readSet.has(i),
    media: {
      slideImages: s.id ? (slideImagesBySection.get(s.id) ?? []) : [],
      videoAt: s.id ? (videoAtBySection.get(s.id) ?? null) : null,
    },
    // Faza 1: active-recall checkpoint (ungraded, self-check). To'liq yuboriladi —
    // bahoga ta'sir qilmaydi, asosiy testdan mustaqil (client javobda ochadi).
    checkpoint:
      s.checkpoint && Array.isArray(s.checkpoint.options) && s.checkpoint.options.length >= 2
        ? {
            question: s.checkpoint.question,
            options: s.checkpoint.options,
            correctIndex: s.checkpoint.correctIndex,
            explanation: s.checkpoint.explanation ?? "",
          }
        : null,
  }));

  const rule = state; // TopicOut carries elements; thresholds come from the course rule below
  const progress = await progressPromise;

  // Latest quiz attempt (for the intro/result state).
  let quizMeta = null;
  if (quizItem?.quiz) {
    const q = quizItem.quiz;
    const attempts = await quizAttemptsPromise;
    const inProgress = attempts.find((a) => a.finishedAt === null) ?? null;
    const finishedList = attempts.filter((a) => a.finishedAt !== null);
    const finishedCount = finishedList.length;
    const latest = attempts[0] ?? null;
    // KORIDOR: haqiqiy sozlamalar = o'qituvchi sozlamasi, kafedra minimumlari
    // bilan siqilgan (urinish soni, tanaffus, vaqt, o'tish balli).
    const effQuiz = clampQuiz(q, enrolledCourse.policy ?? FALLBACK_POLICY, q.questions.length);
    const gate = attemptGate(finishedList, effQuiz);
    quizMeta = {
      quizId: q.id,
      questionCount: q.questions.length,
      passThreshold: effQuiz.passThreshold,
      maxAttempts: effQuiz.maxAttempts,
      canStart: !inProgress && gate.ok,
      /** Nega boshlab bo'lmaydi: attempts_exhausted | cooldown. */
      blockedBy: inProgress || gate.ok ? null : gate.reason,
      nextAttemptAt: gate.nextAt ? gate.nextAt.toISOString() : null,
      attemptsLeft: Math.max(0, effQuiz.maxAttempts - finishedCount),
      inProgressId: inProgress?.id ?? null,
      /** Vaqt chegarasi (daqiqa); 0 = cheklanmagan. */
      timeLimitMin: effQuiz.timeLimitMin,
      attempt: latest
        ? {
            id: latest.id,
            status: latest.finishedAt ? ("finished" as const) : ("in_progress" as const),
            scorePct: latest.finishedAt ? latest.scorePct : null,
            passed: latest.finishedAt ? latest.passed : null,
            attemptNo: latest.attemptNo,
          }
        : null,
    };
  }

  // Case attempt (reference answer only revealed once submitted).
  let caseTab = null;
  if (caseItem?.clinicalCase) {
    const cc = caseItem.clinicalCase;
    const caseJson = cc.caseJson as unknown as CaseJson;
    const attempt = await caseAttemptPromise;
    const steps = caseJson.steps ?? [];
    const picked = (attempt?.stepsJson as Record<string, number>) ?? {};
    const submitted = !!attempt;

    caseTab = {
      present: true,
      caseId: cc.id,
      blocks: {
        complaints: caseJson.complaints,
        anamnesis: caseJson.anamnesis,
        objectiveStatus: caseJson.objectiveStatus,
        labData: caseJson.labData,
      },
      /** v2 — bemor kartasi (bo'sh bo'lsa UI ko'rsatmaydi). */
      patient: {
        name: caseJson.patientName ?? "",
        info: caseJson.patientInfo ?? "",
        vitals: caseJson.vitals ?? null,
      },
      /** v2 — qadamlar. ⚠️ `correct`/`feedback` FAQAT talaba tanlagach yoki
       *  topshirgach ochiladi — aks holda javob oshkor bo'lardi. */
      steps: steps.map((s, si) => {
        const chosen = picked[String(si)];
        const reveal = submitted || chosen !== undefined;
        return {
          index: si,
          title: s.title,
          prompt: s.prompt,
          chosen: chosen ?? null,
          options: s.options.map((o, oi) => ({
            index: oi,
            text: o.text,
            ...(reveal ? { correct: o.correct, feedback: o.feedback } : {}),
          })),
        };
      }),
      questions: caseJson.questions,
      attempt: attempt
        ? {
            id: attempt.id,
            answers: attempt.answersJson as string[],
            referenceAnswer: caseJson.referenceAnswer, // revealed after submission
            submittedAt: attempt.submittedAt,
            score: attempt.score,
            autoScore: attempt.autoScore,
            teacherFeedback: attempt.teacherFeedback,
            reviewed: attempt.reviewedAt !== null,
          }
        : null,
    };
  }

  const courseRule = (topic.unlockRuleJson ?? enrolledCourse?.defaultUnlockRuleJson) as Record<string, unknown> | null;
  const videoThreshold = (courseRule?.videoWatchedPct as number) ?? 80;

  // Virtual bemor (Modul 26) — keys YOKI tasdiqlangan konspekt bo'lsa amaliyot
  // bosqichi ochiq (keys shart emas; konspektdan bemor generatsiya qilinadi).
  // baholash (role="eval") yozilgan bo'lsa — bajarilgan.
  const patientAvailable = !!caseItem?.clinicalCase || topic.digest?.approvedByTeacher === true;
  const patientEval = patientAvailable ? await patientEvalPromise : null;

  return {
    topicId: topic.id,
    orderIndex: topic.orderIndex,
    title: topic.title,
    courseId: enrolledCourseId,
    subjectName: enrolledCourse.name,
    // Tugagach to'g'ridan keyingisiga o'tish uchun (LOCKED bo'lsa tugma chiqmaydi).
    // Tugagach to'g'ridan keyingisiga o'tish uchun. LOCKED bo'lsa SABABI ham
    // keladi — ilgari ekranda faqat kulrang qulf chipi turardi va talaba nega
    // ochilmayotganini bilmasdi.
    nextTopic: nextTopic
      ? { id: nextTopic.id, title: nextTopic.title, state: nextTopic.state, reason: nextTopic.reason }
      : null,
    state: state.state,
    completed: state.state === "COMPLETED",
    /** Mavzuni tugatish uchun QOLGAN talablar — dvigateldan (yagona haqiqat). */
    requirements: state.unmet,
    thresholds: {
      video: videoThreshold,
      /** Testning O'Z o'tish balli (natijadagi "o'tdingiz" chipi shundan). */
      quizPass: quizItem?.quiz?.passThreshold ?? 70,
    },
    elements: rule.elements,
    // Chap panel — o'qituvchi materiallari ("PDF · 24 bet · 2.1 MB").
    materials: topic.materials.map((m) => ({
      id: m.id,
      fileName: m.fileName,
      fileType: m.fileType,
      sizeBytes: m.sizeBytes,
      pageCount: m.pageCount,
      /** Ajratilgan matn mavjudmi ("Material matni" mini-konspekt bloki uchun). */
      hasText: m.parseStatus === "DONE" && !!m.parsedTextUrl,
    })),
    links: topic.links.map((l) => ({ id: l.id, title: l.title, url: l.url, note: l.note })),
    // O'rta panel — AI konspekt (tasdiqlanmagan bo'lsa null → video/slaydlarga fallback).
    digest: digestJson,
    /** 1C: joriy konspekt versiyasiga audio tayyormi (o'qish ustuni pleyeri). */
    digestAudio: await digestAudioPromise,
    /** Audio-podkast (~20 daq, ikki ovoz) — tayyor bo'lsa boblar bilan. */
    podcast: await podcastPromise,
    /** v2 bo'limli o'qish (bo'sh bo'lsa — eski yassi konspekt renderi). */
    sections,
    /** Mavzuning taxminiy vaqti (bo'limlar + test + keys). */
    estimatedMinutes:
      sectionsRaw.reduce((n, s) => n + (s.minutes || 0), 0) +
      (quizItem?.quiz ? quizItem.quiz.questions.length : 0) +
      (caseItem ? 10 : 0),
    /** Virtual bemor amaliyoti (keys yoki konspekt bo'lsa; bosqich sifatida). */
    patient: { available: patientAvailable, finished: !!patientEval },
    tabs: {
      // ⚠️ Video FAQAT mp4 tayyor bo'lsa yuboriladi. Ilgari montaj tugamagan
      // (buildStatus=TTS/RENDER) video ham payloadga tushardi — talaba rail'da
      // "Video ma'ruza" blokini ko'rib bosardi va bo'sh xato ekraniga tushardi,
      // ustiga bosqich foizi ham hech qachon to'lmasdi. Tayyor bo'lmagan video —
      // talaba uchun kontent emas.
      // ⚠️ 2026-08-02: video endi mp4 FAYL emas — ovoz + vaqt jadvali (segmentlar),
      // brauzer ularni sinxron ijro etadi (`SlideshowPlayer`). mp4 ixtiyoriy
      // qoladi (VIDEO_MP4=1 bo'lgan hostда) va bo'lsa oddiy pleyer ishlatiladi.
      // Shart: OVOZ tayyor bo'lsin — aks holda talabaga ko'rsatiladigan narsa yo'q.
      video: videoItem?.video?.audioUrl || videoItem?.video?.mp4Url
        ? {
            present: true,
            videoId: videoItem.video.id,
            hasMp4: !!videoItem.video.mp4Url,
            hasAudio: !!videoItem.video.audioUrl,
            hasSrt: !!videoItem.video.srtUrl,
            durationSec: videoItem.video.durationSec,
            watchedPct: progress?.videoWatchedPct ?? 0,
            positionSec: progress?.videoPositionSec ?? 0,
            done: (progress?.videoWatchedPct ?? 0) >= videoThreshold,
            language: videoItem.language,
            /** Vaqt jadvali: har kadr qachon boshlanadi, nima ko'rsatiladi. */
            segments: ((videoItem.video.scriptJson as unknown as ScriptSegment[]) ?? []).map((seg, si, arr) => ({
              index: si,
              startSec: Math.round(arr.slice(0, si).reduce((a, x) => a + (x.durationSec || 0), 0)),
              durationSec: Math.round(seg.durationSec || 0),
              title: seg.visual?.title ?? "",
              points: seg.visual?.points ?? [],
              kind: seg.visual?.kind ?? "points",
              hasImage: !!seg.visualImageUrl,
              narration: seg.narration,
            })),
          }
        : null,
      slides: slidesItem?.presentation
        ? {
            present: true,
            presentationId: slidesItem.presentation.id,
            slides: (slidesItem.presentation.slidesJson as unknown as Slide[]).map((s, si) => ({
              id: s.id,
              layout: s.layout,
              title: s.title,
              bullets: s.bullets,
              imageUrl: s.imageSlots?.[0]?.status === "DONE" ? `/api/v1/me/presentations/${slidesItem.presentation!.id}/image/${si}/0` : null,
            })),
            viewed: progress?.slidesViewed ?? false,
            done: progress?.slidesViewed ?? false,
          }
        : null,
      quiz: quizMeta ? { present: true, ...quizMeta } : null,
      case: caseTab,
    },
  };
}

// ---------- Konspekt bo'limi o'qildi (1a) ----------

/** Bo'limni o'qilgan deb belgilaydi (idempotent). Mavzu qulflangan bo'lsa 403. */
export async function markSectionRead(studentId: number, topicId: number, sectionIndex: number) {
  await assertTopicOpen(studentId, topicId);
  if (!Number.isInteger(sectionIndex) || sectionIndex < 0) throw badRequest("Boʻlim notoʻgʻri", "Неверный раздел");

  // Bo'lim haqiqatan mavjudmi (tasdiqlangan konspektda) — aks holda yozmaymiz.
  const digest = await prisma.topicDigest.findUnique({ where: { topicId } });
  const sections = digest?.approvedByTeacher
    ? ((digest.digestJson as unknown as DigestJson).sections ?? [])
    : [];
  if (sectionIndex >= sections.length) throw notFound("Boʻlim");

  await prisma.sectionRead.upsert({
    where: { studentId_topicId_sectionIndex: { studentId, topicId, sectionIndex } },
    create: { studentId, topicId, sectionIndex },
    update: {},
  });
  const readCount = await prisma.sectionRead.count({ where: { studentId, topicId } });
  return { ok: true, readCount, total: sections.length };
}

// ---------- Video / slides progress ----------

export async function setVideoProgress(studentId: number, topicId: number, watchedPct: number, positionSec: number) {
  await assertTopicOpen(studentId, topicId);
  const pct = Math.max(0, Math.min(100, Math.round(watchedPct)));
  const existing = await prisma.progress.findUnique({ where: { studentId_topicId: { studentId, topicId } } });
  await prisma.progress.upsert({
    where: { studentId_topicId: { studentId, topicId } },
    create: { studentId, topicId, videoWatchedPct: pct, videoPositionSec: Math.max(0, Math.round(positionSec)) },
    // Watched% is monotonic (scrubbing back doesn't lower the gate); position tracks the last spot.
    update: { videoWatchedPct: Math.max(existing?.videoWatchedPct ?? 0, pct), videoPositionSec: Math.max(0, Math.round(positionSec)) },
  });
  return persistAndReport(studentId, topicId);
}

export async function setSlidesViewed(studentId: number, topicId: number) {
  await assertTopicOpen(studentId, topicId);
  await prisma.progress.upsert({
    where: { studentId_topicId: { studentId, topicId } },
    create: { studentId, topicId, slidesViewed: true },
    update: { slidesViewed: true },
  });
  return persistAndReport(studentId, topicId);
}

// ---------- Quiz lifecycle ----------

async function quizWithTopic(quizId: number) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: { contentItem: true, questions: { where: { retiredAt: null }, orderBy: { orderIndex: "asc" } } },
  });
  if (!quiz) throw notFound("Test");
  if (quiz.contentItem.status !== "PUBLISHED") throw notFound("Test");
  return quiz;
}

interface AttemptRow {
  id: number;
  quizId: number;
  answersJson: unknown;
  flaggedJson: unknown;
  scorePct: number;
  passed: boolean;
  attemptNo: number;
  expiresAt: Date | null;
  finishedAt: Date | null;
  orderJson?: unknown;
  deviceHash?: string | null;
  integrityJson?: unknown;
}
interface QuizRow {
  passThreshold: number;
  questions: {
    id: number;
    text: string;
    optionsJson: unknown;
    correctIndex: number;
    explanationJson: unknown;
    difficulty: string;
    sourceFragment: string | null;
  }[];
}

/** Serialize an attempt: public (no answers/explanations) while running; full analysis once finished. */
function serializeAttempt(attempt: AttemptRow, quiz: QuizRow) {
  const answers = (attempt.answersJson as Record<string, number>) ?? {};
  const finished = attempt.finishedAt !== null;
  const total = quiz.questions.length;
  const correctCount = quiz.questions.filter((q) => answers[String(q.id)] === q.correctIndex).length;

  // SNIMOK: har urinishning O'Z tartibi. Yonidagi talaba boshqa ekran ko'radi,
  // qayta topshirishda tartib yana boshqacha bo'ladi.
  const order = readOrder(attempt.orderJson);
  const byId = new Map(quiz.questions.map((q) => [q.id, q]));
  const ordered = order ? order.q.map((id) => byId.get(id)).filter(Boolean) : quiz.questions;
  const shownOptions = (q: { id: number; optionsJson: unknown }) => {
    const opts = questionOptions(q.optionsJson);
    const perm = order?.opt[String(q.id)];
    return perm ? perm.map((i) => opts[i] ?? "") : opts;
  };

  // ⚠️ ESKIRGAN URINISH: o'qituvchi testni QAYTA generatsiya qilsa savollar
  // butunlay yangi id oladi, eski urinishning javoblari esa o'sha eski
  // savollarga tegishli bo'lib qoladi. Natijada ekranda "0/20 · 67%" degan
  // ma'nosiz qator va "20 ta xato javob" ro'yxati chiqardi (o'lchandi:
  // attempt 1 — javoblar 1,2,3; hozirgi savollar 49..68). Bunday holatda
  // saqlangan ball haqiqat, tahlil esa YO'Q — UI uni ko'rsatmaydi.
  const stale = finished && Object.keys(answers).length > 0 && !quiz.questions.some((q) => String(q.id) in answers);

  return {
    id: attempt.id,
    quizId: attempt.quizId,
    status: finished ? ("finished" as const) : ("in_progress" as const),
    attemptNo: attempt.attemptNo,
    passThreshold: quiz.passThreshold,
    total,
    answers: Object.fromEntries(
      Object.entries(answers).map(([qid, v]) => [qid, toShownIndex(order, Number(qid), v) ?? v])
    ),
    /** Belgilangan savollar (keyin qaytish uchun). */
    flagged: ((attempt.flaggedJson as number[]) ?? []).filter((n) => Number.isInteger(n)),
    /** Vaqt tugash momenti (ISO) yoki null — cheklanmagan. Timer shundan hisoblanadi. */
    expiresAt: attempt.expiresAt ? attempt.expiresAt.toISOString() : null,
    scorePct: finished ? attempt.scorePct : null,
    passed: finished ? attempt.passed : null,
    correctCount: finished && !stale ? correctCount : null,
    /** Test urinishdan keyin qayta yaratilgan — javoblar tahlili mavjud emas. */
    stale,
    questions: (ordered as typeof quiz.questions).map((q) => ({
      id: q.id,
      text: q.text,
      options: shownOptions(q),
      difficulty: q.difficulty,
      // Correct answer + explanations are hidden until the attempt is finished.
      // Indekslar EKRAN tartibida beriladi — javoblar esa bazada ASL indeksda.
      ...(finished
        ? {
            correctIndex: toShownIndex(order, q.id, q.correctIndex) ?? q.correctIndex,
            explanations: (q.explanationJson as string[]) ?? [],
            studentAnswer: toShownIndex(order, q.id, answers[String(q.id)] ?? null),
            sourceFragment: q.sourceFragment,
          }
        : { studentAnswerShown: toShownIndex(order, q.id, answers[String(q.id)] ?? null) }),
    })),
  };
}

/**
 * YAGONA shart: urinishni boshlash mumkinmi. Dars payloadi ham (UI sababni
 * ko'rsatishi uchun), start ham (chetlab o'tib bo'lmasligi uchun) shuni o'qiydi.
 * Uch shart: urinish qoldimi -> tanaffus o'tdimi -> xatolar ustida ishlanganmi.
 */
function attemptGate(
  finished: { finishedAt: Date | null; passed: boolean; scorePct: number }[],
  eff: { maxAttempts: number; attemptGapHours: number; passThreshold: number }
): { ok: boolean; reason: "attempts_exhausted" | "cooldown" | null; nextAt: Date | null } {
  if (finished.length === 0) return { ok: true, reason: null, nextAt: null };
  // ⚠️ `a.passed` ISHLATILMAYDI: u testning O'Z balliga qarab yozilgan (masalan
  // 60%), koridor esa 70% talab qilishi mumkin. Shunda talaba "o'tgan" bo'lib
  // ko'rinardi, mavzu esa yopiq qolardi va QAYTA TOPSHIRA ham olmasdi —
  // yana o'sha boshi berk ko'cha. Shuning uchun EFFEKTIV bo'sag'a bilan solishtiramiz.
  const best = finished.reduce((m, a) => Math.max(m, a.scorePct), 0);
  if (best >= eff.passThreshold) return { ok: false, reason: "attempts_exhausted", nextAt: null };
  if (finished.length >= eff.maxAttempts) return { ok: false, reason: "attempts_exhausted", nextAt: null };
  if (eff.attemptGapHours > 0) {
    const last = finished.reduce((m, a) => Math.max(m, a.finishedAt?.getTime() ?? 0), 0);
    const nextAt = new Date(last + eff.attemptGapHours * 3_600_000);
    if (nextAt.getTime() > Date.now()) return { ok: false, reason: "cooldown", nextAt };
  }
  return { ok: true, reason: null, nextAt: null };
}

/** Test qaysi kafedraga tegishli — siyosat koridorini aniqlash uchun. */
async function departmentOfQuiz(quizId: number): Promise<number | null> {
  const row = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: { contentItem: { select: { topic: { select: { course: { select: { departmentId: true } } } } } } },
  });
  return row?.contentItem.topic.course.departmentId ?? null;
}

/**
 * Oldingi urinish xatolari ustida ishlanganmi. Dalil — tренажёрда HAR BIR
 * xato savolga to'g'ri javob (RemediationAnswer). Xato bo'lmasa — ishlash shart emas.
 */
async function remediationDone(studentId: number, quizId: number): Promise<boolean> {
  const last = await prisma.quizAttempt.findFirst({
    where: { studentId, quizId, finishedAt: { not: null } },
    orderBy: { finishedAt: "desc" },
  });
  if (!last) return true;
  const questions = await prisma.question.findMany({
    where: { quizId, retiredAt: null },
    select: { id: true, correctIndex: true },
  });
  const answers = (last.answersJson as Record<string, number>) ?? {};
  const wrong = questions.filter((q) => answers[String(q.id)] !== q.correctIndex).map((q) => q.id);
  if (wrong.length === 0) return true;
  const fixed = await prisma.remediationAnswer.findMany({
    where: { studentId, attemptId: last.id, questionId: { in: wrong }, correct: true },
    select: { questionId: true },
    distinct: ["questionId"],
  });
  return fixed.length >= wrong.length;
}

/** Xatolar ustida ishlash holati (UI "yana N ta qoldi" deb ko'rsatadi). */
export async function remediationStatus(studentId: number, quizId: number) {
  const last = await prisma.quizAttempt.findFirst({
    where: { studentId, quizId, finishedAt: { not: null } },
    orderBy: { finishedAt: "desc" },
  });
  if (!last) return { required: false, total: 0, done: 0, attemptId: null as number | null };
  const questions = await prisma.question.findMany({
    where: { quizId, retiredAt: null },
    select: { id: true, correctIndex: true },
  });
  const answers = (last.answersJson as Record<string, number>) ?? {};
  const wrong = questions.filter((q) => answers[String(q.id)] !== q.correctIndex).map((q) => q.id);
  const fixed = await prisma.remediationAnswer.findMany({
    where: { studentId, attemptId: last.id, questionId: { in: wrong }, correct: true },
    select: { questionId: true },
    distinct: ["questionId"],
  });
  return { required: wrong.length > 0, total: wrong.length, done: fixed.length, attemptId: last.id };
}

/** Tренажёрдаги javob — xatolar ustida ishlash DALILI sifatida yoziladi. */
export async function recordRemediation(
  studentId: number,
  attemptId: number,
  questionId: number,
  selectedIndex: number
) {
  const attempt = await prisma.quizAttempt.findUnique({ where: { id: attemptId } });
  if (!attempt || attempt.studentId !== studentId) throw notFound("Urinish");
  const q = await prisma.question.findUnique({ where: { id: questionId }, select: { id: true, correctIndex: true, quizId: true } });
  if (!q || q.quizId !== attempt.quizId) throw notFound("Savol");
  const correct = q.correctIndex === selectedIndex;
  await prisma.remediationAnswer.create({
    data: { studentId, attemptId, questionId, selectedIndex, correct },
  });
  return { correct, ...(await remediationStatus(studentId, attempt.quizId)) };
}

export async function startQuizAttempt(studentId: number, quizId: number, device?: string) {
  const quiz = await quizWithTopic(quizId);
  await assertTopicOpen(studentId, quiz.contentItem.topicId);

  const attempts = await prisma.quizAttempt.findMany({ where: { studentId, quizId }, orderBy: { attemptNo: "desc" } });
  const inProgress = attempts.find((a) => a.finishedAt === null);
  if (inProgress) {
    // Boshlangan urinishni BOSHQA qurilmada davom ettirib bo'lmaydi.
    if (device) assertSameDevice(inProgress.deviceHash, device);
    return serializeAttempt(inProgress, quiz); // resume, not a new attempt
  }

  const finished = attempts.filter((a) => a.finishedAt !== null);
  const finishedCount = finished.length;

  // KORIDOR: urinish soni va tanaffusni test emas, kafedra siyosati belgilaydi.
  // Ilgari bu yerda qat'iy maxAttempts = 1 turardi — test provali BOSHI BERK
  // KO'CHA edi, yagona chiqish esa "bilmaganni o'tkazib yuborish".
  const policy = await resolvePolicy(await departmentOfQuiz(quizId));
  const eff = clampQuiz(quiz, policy, quiz.questions.length);

  // OCHIQ REJIM: yakuniy imtihonlar faqat auditoriyada. Bu — "o'zi topshirdimi"
  // degan savolga yagona haqiqiy javob (qolgani faqat narxini oshiradi).
  if (quiz.requiresPresence || policy.requirePresence) {
    const courseId = await enrolledCourseIdForTopic(studentId, quiz.contentItem.topicId);
    if (courseId === null) throw forbiddenNotEnrolled();
    await assertPresence(studentId, courseId);
  }
  const gate = attemptGate(finished, eff);
  if (!gate.ok) {
    if (gate.reason === "cooldown") {
      const when = gate.nextAt!;
      throw new ApiError(
        403,
        "quiz_cooldown",
        `Keyingi urinish ${when.toLocaleString("uz-UZ")} dan keyin ochiladi`,
        `Следующая попытка откроется после ${when.toLocaleString("ru-RU")}`
      );
    }
    throw new ApiError(403, "quiz_max_attempts", "Test urinishlari tugadi", "Попытки теста исчерпаны");
  }

  // XATOLAR USTIDA ISHLASH MAJBURIY: aks holda "qayta topshirish" o'rganish
  // emas, variantlarni terib chiqishga aylanadi.
  if (finishedCount > 0 && policy.requireRemediation && !(await remediationDone(studentId, quizId))) {
    throw new ApiError(
      403,
      "remediation_required",
      "Qayta topshirishdan oldin xatolaringiz ustida ishlang",
      "Перед пересдачей разберите свои ошибки в тренажёре"
    );
  }

  // Vaqt chegarasi bo'lsa — tugash momentini SERVER belgilaydi (klient soatiga
  // ishonilmaydi); vaqt tugagach har qanday so'rovda avtomatik yakunlanadi.
  const expiresAt = eff.timeLimitMin > 0 ? new Date(Date.now() + eff.timeLimitMin * 60_000) : null;

  const created = await prisma.quizAttempt.create({
    data: {
      quizId,
      studentId,
      answersJson: {},
      attemptNo: finishedCount + 1,
      expiresAt,
      orderJson: { ...buildOrder(quiz.questions) },
      deviceHash: device ?? null,
    },
  });
  return serializeAttempt(created, quiz);
}

/** Urinishni baholab yakunlaydi (finish va vaqt tugaganda ishlatiladi). */
async function gradeAndFinish(studentId: number, attempt: AttemptRow, quiz: QuizRow & { contentItem: { topicId: number } }) {
  const answers = (attempt.answersJson as Record<string, number>) ?? {};
  const total = quiz.questions.length;
  const correct = quiz.questions.filter((q) => answers[String(q.id)] === q.correctIndex).length;
  const scorePct = total === 0 ? 0 : Math.round((correct / total) * 100);
  // "O'tdingiz" ham koridor bo'sag'asiga qarab yoziladi — ekran va dvigatel
  // bir xil raqamdan qaror qilishi shart.
  const effPass = Math.max(
    quiz.passThreshold,
    (await resolvePolicy(await departmentOfQuiz(attempt.quizId))).minQuizPassedPct
  );
  const passed = scorePct >= effPass;

  const finished = await prisma.quizAttempt.update({
    where: { id: attempt.id },
    data: { scorePct, passed, finishedAt: new Date() },
  });
  const topic = await persistAndReport(studentId, quiz.contentItem.topicId);
  return { attempt: serializeAttempt(finished, quiz), topic };
}

async function ownAttempt(studentId: number, attemptId: number) {
  const attempt = await prisma.quizAttempt.findUnique({ where: { id: attemptId } });
  if (!attempt) throw notFound("Urinish");
  if (attempt.studentId !== studentId) throw new ApiError(403, "forbidden", "Ruxsat yoʻq", "Нет доступа");
  const quiz = await quizWithTopic(attempt.quizId);
  await assertTopicOpen(studentId, quiz.contentItem.topicId);
  return { attempt, quiz };
}

/** Vaqti tugagan urinishni avtomatik yakunlaydi. Har o'qish/yozish yo'lida
 *  chaqiriladi — klient timerni chetlab o'ta olmaydi. */
async function autoFinishIfExpired(
  studentId: number,
  attempt: AttemptRow,
  quiz: QuizRow & { contentItem: { topicId: number } }
) {
  if (attempt.finishedAt || !attempt.expiresAt) return null;
  if (attempt.expiresAt.getTime() > Date.now()) return null;
  return gradeAndFinish(studentId, attempt, quiz);
}

export async function setQuizFlag(studentId: number, attemptId: number, questionId: number, flagged: boolean) {
  const { attempt, quiz } = await ownAttempt(studentId, attemptId);
  const expired = await autoFinishIfExpired(studentId, attempt, quiz);
  if (expired) return expired.attempt;
  if (attempt.finishedAt) throw new ApiError(403, "attempt_finished", "Urinish yakunlangan", "Попытка завершена");

  const exists = quiz.questions.some((q) => q.id === questionId);
  if (!exists) throw notFound("Savol");

  const cur = new Set(((attempt.flaggedJson as number[]) ?? []).filter((n) => Number.isInteger(n)));
  if (flagged) cur.add(questionId);
  else cur.delete(questionId);

  const updated = await prisma.quizAttempt.update({
    where: { id: attemptId },
    data: { flaggedJson: [...cur] },
  });
  return serializeAttempt(updated, quiz);
}

export async function saveQuizAnswers(studentId: number, attemptId: number, answers: Record<string, number>) {
  const { attempt, quiz } = await ownAttempt(studentId, attemptId);
  const expired = await autoFinishIfExpired(studentId, attempt, quiz);
  if (expired) return expired.attempt; // vaqt tugagan — javob qabul qilinmaydi
  if (attempt.finishedAt) throw new ApiError(403, "attempt_finished", "Urinish yakunlangan", "Попытка завершена");

  // Keep only valid question ids / option indexes.
  const valid: Record<string, number> = { ...((attempt.answersJson as Record<string, number>) ?? {}) };
  const byId = new Map(quiz.questions.map((q) => [String(q.id), questionOptions(q.optionsJson).length]));
  for (const [qid, idx] of Object.entries(answers ?? {})) {
    const optCount = byId.get(qid);
    if (optCount !== undefined && Number.isInteger(idx) && idx >= 0 && idx < optCount) valid[qid] = idx;
  }
  const updated = await prisma.quizAttempt.update({ where: { id: attemptId }, data: { answersJson: valid } });
  return serializeAttempt(updated, quiz);
}

export async function finishQuizAttempt(studentId: number, attemptId: number) {
  const { attempt, quiz } = await ownAttempt(studentId, attemptId);
  if (attempt.finishedAt)
    return { attempt: serializeAttempt(attempt, quiz), topic: await recomputeTopic(studentId, quiz.contentItem.topicId) };
  return gradeAndFinish(studentId, attempt, quiz);
}

export async function getQuizAttempt(studentId: number, attemptId: number) {
  const { attempt, quiz } = await ownAttempt(studentId, attemptId);
  const expired = await autoFinishIfExpired(studentId, attempt, quiz);
  if (expired) return expired.attempt;
  return serializeAttempt(attempt, quiz);
}

// ---------- Case lifecycle ----------

async function caseWithTopic(caseId: number) {
  const cc = await prisma.clinicalCase.findUnique({ where: { id: caseId }, include: { contentItem: true } });
  if (!cc) throw notFound("Keys");
  if (cc.contentItem.status !== "PUBLISHED") throw notFound("Keys");
  return cc;
}

function serializeCaseAttempt(
  attempt: {
    id: number;
    answersJson: unknown;
    submittedAt: Date;
    score: number | null;
    autoScore: number | null;
    teacherFeedback: string | null;
    reviewedAt: Date | null;
  },
  caseJson: CaseJson
) {
  return {
    id: attempt.id,
    answers: attempt.answersJson as string[],
    referenceAnswer: caseJson.referenceAnswer,
    questions: caseJson.questions,
    submittedAt: attempt.submittedAt,
    score: attempt.score,
    // v2 — qadamlar bo'yicha avto-baho (eski urinishlarda null).
    autoScore: attempt.autoScore,
    teacherFeedback: attempt.teacherFeedback,
    reviewed: attempt.reviewedAt !== null,
  };
}

export async function submitCase(
  studentId: number,
  caseId: number,
  answers: string[],
  steps?: Record<string, number>
) {
  const cc = await caseWithTopic(caseId);
  await assertTopicOpen(studentId, cc.contentItem.topicId);
  const caseJson = cc.caseJson as unknown as CaseJson;

  const existing = await prisma.caseAttempt.findUnique({ where: { studentId_caseId: { studentId, caseId } } });
  if (existing) throw new ApiError(409, "case_already_submitted", "Keys allaqachon topshirilgan", "Кейс уже сдан");

  if (!Array.isArray(answers) || answers.length !== caseJson.questions.length || answers.some((a) => !a || !a.trim())) {
    throw badRequest("Barcha savolga javob bering", "Ответьте на все вопросы");
  }

  // v2 — qadam qarorlari: hammasi tanlangan bo'lishi shart, avto-baho hisoblanadi.
  const defs = caseJson.steps ?? [];
  const picked: Record<string, number> = {};
  let autoScore: number | null = null;
  if (defs.length > 0) {
    let correct = 0;
    for (let i = 0; i < defs.length; i++) {
      const idx = steps?.[String(i)];
      const optCount = defs[i].options.length;
      if (!Number.isInteger(idx) || idx! < 0 || idx! >= optCount) {
        throw badRequest("Barcha qadamda qaror qabul qiling", "Примите решение на всех шагах");
      }
      picked[String(i)] = idx!;
      if (defs[i].options[idx!].correct) correct++;
    }
    autoScore = Math.round((correct / defs.length) * 100);
  }

  const created = await prisma.caseAttempt.create({
    data: {
      caseId,
      studentId,
      answersJson: answers.map((a) => a.trim()),
      stepsJson: picked,
      autoScore,
    },
  });
  await persistAndReport(studentId, cc.contentItem.topicId);
  return serializeCaseAttempt(created, caseJson);
}

export async function getCaseAttempt(studentId: number, attemptId: number) {
  const attempt = await prisma.caseAttempt.findUnique({
    where: { id: attemptId },
    include: { clinicalCase: true },
  });
  if (!attempt) throw notFound("Keys javobi");
  if (attempt.studentId !== studentId) throw new ApiError(403, "forbidden", "Ruxsat yoʻq", "Нет доступа");
  return serializeCaseAttempt(attempt, attempt.clinicalCase.caseJson as unknown as CaseJson);
}

// ---------- Student media (published + enrolled + unlocked) ----------

async function videoAccess(studentId: number, videoId: number) {
  const v = await prisma.video.findUnique({ where: { id: videoId }, include: { contentItem: true } });
  if (!v) throw notFound("Video");
  if (v.contentItem.status !== "PUBLISHED") throw notFound("Video");
  await assertTopicOpen(studentId, v.contentItem.topicId);
  return v;
}

/** Fayl yozuvi bazada bor, o'zi esa yo'q bo'lishi mumkin (eski, disk drayveri
 *  davridagi media). Bunda 500 emas — toza 404 qaytaramiz, UI buzilmasin. */
async function readMediaOr404(rel: string, what: string): Promise<Buffer> {
  const buf = await readFileBuffer(rel).catch(() => null);
  if (!buf) throw notFound(what);
  return buf;
}

export async function studentVideoMedia(studentId: number, videoId: number, kind: "mp4" | "srt" | "audio"): Promise<Buffer> {
  const v = await videoAccess(studentId, videoId);
  const rel = kind === "mp4" ? v.mp4Url : kind === "audio" ? v.audioUrl : v.srtUrl;
  if (!rel) throw notFound("Fayl");
  return readMediaOr404(rel, "Video");
}

/** Slayd-pleyer kadri — segmentning rasmi (bo'lsa). Rasm yo'q segmentda
 *  brauzer matnli karta chizadi, shuning uchun bu 404 normal holat. */
export async function studentVideoFrame(studentId: number, videoId: number, index: number): Promise<Buffer> {
  const v = await videoAccess(studentId, videoId);
  const seg = ((v.scriptJson as unknown as ScriptSegment[]) ?? [])[index];
  if (!seg?.visualImageUrl) throw notFound("Kadr");
  return readMediaOr404(seg.visualImageUrl, "Kadr");
}

async function presentationAccess(studentId: number, presentationId: number) {
  const p = await prisma.presentation.findUnique({ where: { id: presentationId }, include: { contentItem: true } });
  if (!p) throw notFound("Prezentatsiya");
  if (p.contentItem.status !== "PUBLISHED") throw notFound("Prezentatsiya");
  await assertTopicOpen(studentId, p.contentItem.topicId);
  return p;
}

export async function studentSlotImage(studentId: number, presentationId: number, slideIndex: number, slotIndex: number): Promise<Buffer> {
  const p = await presentationAccess(studentId, presentationId);
  const slot = (p.slidesJson as unknown as Slide[])[slideIndex]?.imageSlots?.[slotIndex];
  if (!slot?.url) throw notFound("Rasm");
  return readMediaOr404(slot.url, "Rasm");
}

export async function studentPresentationPdf(studentId: number, presentationId: number): Promise<Buffer> {
  const p = await presentationAccess(studentId, presentationId);
  return buildPdf(p.slidesJson as unknown as Slide[]);
}

/** 1C: audio-konspekt oqimi (joriy tasdiqlangan versiya). assertTopicOpen himoyasi. */
export async function studentDigestAudio(studentId: number, topicId: number): Promise<Buffer> {
  await assertTopicOpen(studentId, topicId);
  const digest = await prisma.topicDigest.findUnique({ where: { topicId } });
  if (!digest?.approvedByTeacher) throw notFound("Audio");
  const buf = await readFileBuffer(digestAudioRel(topicId, digest.version)).catch(() => null);
  if (!buf) throw notFound("Audio");
  return buf;
}

/** Audio-podkast (~20 daq). Himoya digest-audio bilan bir xil: mavzu ochiq +
 *  konspekt tasdiqlangan bo'lishi shart. */
export async function studentPodcastAudio(studentId: number, topicId: number): Promise<Buffer> {
  await assertTopicOpen(studentId, topicId);
  const digest = await prisma.topicDigest.findUnique({ where: { topicId } });
  if (!digest?.approvedByTeacher) throw notFound("Podkast");
  const p = await prisma.topicPodcast.findUnique({ where: { topicId } });
  if (!p?.audioUrl) throw notFound("Podkast");
  const buf = await readFileBuffer(p.audioUrl).catch(() => null);
  if (!buf) throw notFound("Podkast");
  return buf;
}

/** Materialning AJRATILGAN MATNI — "Material matni" mini-konspekt bloki.
 *  Xuddi shu himoya: assertTopicOpen. Matn 60k belgi bilan cheklanadi. */
export async function studentMaterialText(studentId: number, materialId: number) {
  const m = await prisma.sourceMaterial.findUnique({ where: { id: materialId } });
  if (!m) throw notFound("Fayl");
  await assertTopicOpen(studentId, m.topicId);
  if (m.parseStatus !== "DONE" || !m.parsedTextUrl) throw notFound("Matn");
  const raw = await readText(m.parsedTextUrl).catch(() => null);
  if (raw === null) throw notFound("Matn");
  return { id: m.id, fileName: m.fileName, text: raw.slice(0, 60_000) };
}

/** O'qituvchi manba materialini talabaga oqim qiladi. Egalik/qulf tekshiruvi
 *  assertTopicOpen orqali (enrolled + published + unlocked; aks holda 403). */
export async function studentMaterialFile(
  studentId: number,
  materialId: number
): Promise<{ buf: Buffer; fileName: string; fileType: string }> {
  const m = await prisma.sourceMaterial.findUnique({ where: { id: materialId } });
  if (!m) throw notFound("Fayl");
  await assertTopicOpen(studentId, m.topicId);
  const buf = await readMediaOr404(m.fileUrl, "Fayl");
  return { buf, fileName: m.fileName, fileType: m.fileType };
}
