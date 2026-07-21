import type { Lesson } from "../api";

/** Bosqichli baholash modeli — SOF prezentatsion. Haqiqiy completion me/service.ts
 *  dvigatelida (computeTopics) hisoblanadi; bu yerda faqat o'ng-panel ko'rinishi.
 *  Spec tartibi: O'rganish → Keys → Test → Kartochkalar → Natija (dvigatel
 *  shartlaridan mustaqil — faqat UI tartibi). */

export type StageKey = "study" | "case" | "quiz" | "flashcards" | "result";
export type StageState = "done" | "open" | "pendingReview" | "soon";
export type ContentView = "konspekt" | "video" | "slides";
export type LessonView = ContentView | "case" | "quiz" | "result";

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

  // Konspekt o'qish treklanmaydi — faqat video/slaydlar kuzatiladi. Agar
  // treklanadigan kontent bo'lmasa (faqat konspekt), study butun mavzu
  // tugaguncha "open" turadi.
  const hasTrackable = !!v || !!s;
  const studyDone = completed || (hasTrackable && (!v || v.done) && (!s || s.viewed));

  const stages: StageInfo[] = [{ key: "study", state: studyDone ? "done" : "open" }];

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

  // Fleshkartalar — keyingi sessiya (qulfli placeholder).
  stages.push({ key: "flashcards", state: "soon" });

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
    case "result":
      return "result";
    default:
      return firstContentView(lesson);
  }
}

/** Sukut bo'yicha ko'rinish — birinchi tugallanmagan (bloklanmagan) bosqich yuzasi. */
export function defaultView(lesson: Lesson): LessonView {
  const stages = buildStages(lesson);
  const firstOpen = stages.find(
    (st) => st.key !== "flashcards" && st.state === "open"
  );
  if (firstOpen) return stageToView(firstOpen.key, lesson);
  return firstContentView(lesson);
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
