import type { Lesson } from "../api";

/** Bosqichli baholash modeli — SOF prezentatsion. Haqiqiy completion me/service.ts
 *  dvigatelida (computeTopics) hisoblanadi; bu yerda faqat o'ng-panel ko'rinishi.
 *  Spec tartibi: O'rganish → Keys → Test → Kartochkalar → Natija (dvigatel
 *  shartlaridan mustaqil — faqat UI tartibi). */

export type StageKey = "study" | "case" | "quiz" | "flashcards" | "result";
export type StageState = "done" | "open" | "pendingReview" | "soon";
/** "materials" — material matni mini-konspekti (ajratilgan matn). */
export type ContentView = "konspekt" | "video" | "slides" | "materials";
/** "overview" — kirish landing'i: bosqichlar obzori (layout v2). */
export type LessonView = "overview" | ContentView | "case" | "quiz" | "flashcards" | "result";

export interface StageInfo {
  key: StageKey;
  state: StageState;
  /** O'ng-panel sub-matn (ball yoki holat). */
  hint?: string;
}

/** O'rta panelda ko'rsatiladigan kontent bormi (konspekt/video/slaydlar). */
export function hasContent(lesson: Lesson): boolean {
  return !!lesson.digest || !!lesson.tabs.video || !!lesson.tabs.slides;
}

/** Birinchi kontent yuzasi — konspekt bo'lsa u, aks holda video, aks holda slaydlar. */
export function firstContentView(lesson: Lesson): ContentView {
  if (lesson.digest) return "konspekt";
  if (lesson.tabs.video) return "video";
  if (lesson.tabs.slides) return "slides";
  return "konspekt";
}

export function buildStages(lesson: Lesson): StageInfo[] {
  const completed = lesson.completed;
  const v = lesson.tabs.video;
  const s = lesson.tabs.slides;
  const qz = lesson.tabs.quiz;
  const cs = lesson.tabs.case;

  // v2: konspekt bo'limlari ham kuzatiladi (SectionRead). Bo'limlar bo'lsa —
  // hammasi o'qilgani study'ni yopadi; bo'lmasa eski mantiq (video/slaydlar).
  const secs = lesson.sections ?? [];
  const hasSections = secs.length > 0;
  const allSectionsRead = hasSections && secs.every((x) => x.read);
  const hasTrackable = hasSections || !!v || !!s;
  const studyDone =
    completed ||
    (hasTrackable && (!hasSections || allSectionsRead) && (!v || v.done) && (!s || s.viewed));

  const studyHint = hasSections
    ? `${secs.filter((x) => x.read).length}/${secs.length}`
    : undefined;
  const stages: StageInfo[] = [{ key: "study", state: studyDone ? "done" : "open", hint: studyHint }];

  if (cs) {
    let state: StageState;
    if (completed || cs.attempt?.reviewed) state = "done";
    else if (cs.attempt) state = "pendingReview";
    else state = "open";
    const hint = cs.attempt?.reviewed && cs.attempt.score !== null ? String(cs.attempt.score) : undefined;
    stages.push({ key: "case", state, hint });
  }

  if (qz) {
    const finished = qz.attempt?.status === "finished";
    let state: StageState;
    if (completed || (finished && (!qz.canStart || qz.attempt?.passed))) state = "done";
    else state = "open";
    const hint = finished && qz.attempt?.scorePct != null ? `${qz.attempt.scorePct}%` : undefined;
    stages.push({ key: "quiz", state, hint });
  }

  // Fleshkartalar — takrorlash. Test savollari javobni oshkor qilgani uchun
  // test yakunlanmaguncha yopiq (backend ham shu qoidani majburlaydi).
  const quizFinished = !qz || qz.attempt?.status === "finished";
  stages.push({ key: "flashcards", state: quizFinished ? "open" : "soon" });

  const caseTerminal = !cs || !!cs.attempt;
  const quizTerminal = !qz || qz.attempt?.status === "finished";
  const resultOpen = caseTerminal && quizTerminal;
  stages.push({ key: "result", state: completed ? "done" : resultOpen ? "open" : "soon" });

  return stages;
}

/** Bosqich → o'rta-panel ko'rinishi. */
export function stageToView(key: StageKey, lesson: Lesson): LessonView {
  switch (key) {
    case "study":
      return firstContentView(lesson);
    case "case":
      return "case";
    case "quiz":
      return "quiz";
    case "flashcards":
      return "flashcards";
    case "result":
      return "result";
    default:
      return firstContentView(lesson);
  }
}

/** Birinchi tugallanmagan (bloklanmagan) bosqich yuzasi — overview CTA shu yerga
 *  olib boradi ("Davom ettirish"). */
export function resumeView(lesson: Lesson): LessonView {
  const stages = buildStages(lesson);
  const firstOpen = stages.find(
    (st) => st.key !== "flashcards" && st.state === "open"
  );
  if (firstOpen) return stageToView(firstOpen.key, lesson);
  return firstContentView(lesson);
}

/** Joriy bosqichdan KEYINGI ochiq bosqich (pastki "Keyingi bosqich: ..." tugmasi).
 *  soon (qulfli) bosqichlar tashlab ketiladi; oxirida null. */
export function nextOpenStage(stages: StageInfo[], currentKey: StageKey): StageInfo | null {
  const idx = stages.findIndex((s) => s.key === currentKey);
  if (idx === -1) return null;
  for (let i = idx + 1; i < stages.length; i++) {
    const st = stages[i];
    if (st.state === "soon") continue; // qulfli bosqich tashlab ketiladi
    return st;
  }
  return null;
}

/** Mavzu jarayoni % (breadcrumb bari). Mavjud bosqichlar teng ulush oladi;
 *  "O'rganish" ichida bo'limlar qisman hisoblanadi. Fleshkartalar (hali yo'q)
 *  hisobga olinmaydi — aks holda 100% ga hech qachon yetib bo'lmasdi. */
export function overallPct(lesson: Lesson): number {
  const parts: number[] = [];

  const secs = lesson.sections ?? [];
  const v = lesson.tabs.video;
  const s = lesson.tabs.slides;
  if (secs.length || v || s) {
    const bits: number[] = [];
    if (secs.length) bits.push(secs.filter((x) => x.read).length / secs.length);
    if (v) bits.push(Math.min(1, v.watchedPct / 100));
    if (s) bits.push(s.viewed ? 1 : 0);
    parts.push(bits.reduce((a, b) => a + b, 0) / bits.length);
  }
  if (lesson.tabs.case) {
    const at = lesson.tabs.case.attempt;
    parts.push(at ? (at.reviewed ? 1 : 0.5) : 0);
  }
  if (lesson.tabs.quiz) {
    parts.push(lesson.tabs.quiz.attempt?.status === "finished" ? 1 : 0);
  }

  if (lesson.completed) return 100;
  if (!parts.length) return 0;
  return Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100);
}

export interface FinalScore {
  value: number | null;
  quizPart: number | null;
  casePart: number | null;
  pendingCase: boolean;
}

/** Yakuniy ball = test (eng yaxshi) + tekshirilgan keys ballari o'rtachasi.
 *  Backend chaqiruvi YO'Q — mavjud payloaddan hisoblanadi. */
export function finalScore(lesson: Lesson): FinalScore {
  const quizPart = lesson.elements.quiz.exists ? lesson.elements.quiz.score : null;
  const casePart = lesson.tabs.case?.attempt?.reviewed ? lesson.tabs.case.attempt.score : null;
  const parts = [quizPart, casePart].filter((x): x is number => x !== null);
  const value = parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : null;
  const pendingCase = !!(lesson.tabs.case?.attempt && !lesson.tabs.case.attempt.reviewed);
  return { value, quizPart, casePart, pendingCase };
}
