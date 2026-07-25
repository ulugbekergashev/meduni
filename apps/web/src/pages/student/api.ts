import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";

export type TopicState = "LOCKED" | "AVAILABLE" | "IN_PROGRESS" | "COMPLETED";

export interface Reason {
  uz: string;
  ru: string;
}

export interface TopicElements {
  video: { exists: boolean; watchedPct: number };
  slides: { exists: boolean; viewed: boolean };
  quiz: { exists: boolean; score: number | null };
  case: { exists: boolean; submitted: boolean; reviewed: boolean };
}

export interface StudentTopic {
  id: number;
  title: string;
  orderIndex: number;
  state: TopicState;
  pct: number;
  reason: Reason | null;
  elements: TopicElements;
}

export interface CourseSummary {
  id: number;
  subjectName: string;
  teacherName: string;
  groupName: string | null;
  /** Davr — kurslar semestrlar bo'ylab guruhlash uchun. */
  semester: number;
  academicYear: string;
  topicsTotal: number;
  topicsCompleted: number;
  progressPct: number;
  nextTopic: string | null;
  nextTopicId: number | null;
}

export interface CoursePath extends Omit<CourseSummary, "nextTopic" | "nextTopicId"> {
  topics: StudentTopic[];
}

export interface Resume {
  courseId: number;
  subjectName: string;
  topicId: number;
  topic: string;
  pct: number;
}

export interface Notification {
  type: "case_reviewed";
  caseAttemptId: number;
  topicId: number;
  topic: string;
  score: number | null;
  reviewedAt: string;
}

export interface Dashboard {
  fullName: string;
  resume: Resume | null;
  courses: CourseSummary[];
  notifications: Notification[];
  streak: { days: number; activeToday: boolean };
}

export function useMyDashboard() {
  return useQuery({ queryKey: ["me-dashboard"], queryFn: () => api<Dashboard>("/api/v1/me/dashboard") });
}

// ---------------- My Tasks ----------------

export type TaskTone = "rose" | "amber" | "blue" | "brand" | "violet" | "emerald";
export interface AutoTask {
  type: string;
  count: number;
  tone: TaskTone;
  link: string;
  /** Konkret mavzular — "1 ta test" emas, qaysi test. */
  items?: AutoTaskItem[];
}
export interface AssignedTask {
  id: number;
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: "LOW" | "NORMAL" | "HIGH";
  createdByName: string;
  createdAt: string;
  linkUrl: string | null;
  status: "OPEN" | "DONE" | "DISMISSED";
  doneAt: string | null;
}

/** Vazifaning aniq predmeti — qaysi mavzu, qaysi fandan. */
export interface AutoTaskItem {
  topicId: number;
  topicTitle: string;
  courseName: string;
  link: string;
  value?: number | null;
}
export interface TasksInbox {
  auto: AutoTask[];
  assigned: AssignedTask[];
}

export function useMyTasks(includeDone = false) {
  return useQuery({
    queryKey: ["me-tasks", includeDone],
    queryFn: () => api<TasksInbox>(`/api/v1/me/tasks${includeDone ? "?includeDone=1" : ""}`),
  });
}

export function useSetMyTaskDone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api(`/api/v1/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ done: true }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me-tasks"] }), // prefiks — ikkala variant
  });
}

export function useMyCourse(id: number) {
  return useQuery({
    queryKey: ["me-course", id],
    queryFn: () => api<CoursePath>(`/api/v1/me/courses/${id}`),
    retry: false,
  });
}

export function useMyCourses() {
  return useQuery({ queryKey: ["me-courses"], queryFn: () => api<CourseSummary[]>("/api/v1/me/courses") });
}

// ---------------- Lesson (Module 12) ----------------

export type SlideLayout = string;

export interface LessonSlide {
  id: string;
  layout: SlideLayout;
  title: string;
  bullets: string[];
  imageUrl: string | null;
}

export interface VideoTabData {
  present: true;
  videoId: number;
  hasMp4: boolean;
  hasSrt: boolean;
  durationSec: number | null;
  watchedPct: number;
  positionSec: number;
  done: boolean;
  language: "uz" | "ru";
}

export interface SlidesTabData {
  present: true;
  presentationId: number;
  slides: LessonSlide[];
  viewed: boolean;
  done: boolean;
}

export interface QuizAttemptSummary {
  id: number;
  status: "in_progress" | "finished";
  scorePct: number | null;
  passed: boolean | null;
  attemptNo: number;
}

export interface QuizTabData {
  present: true;
  quizId: number;
  questionCount: number;
  passThreshold: number;
  maxAttempts: number;
  canStart: boolean;
  inProgressId: number | null;
  /** Vaqt chegarasi (daqiqa); 0 = cheklanmagan. */
  timeLimitMin: number;
  attempt: QuizAttemptSummary | null;
}

export interface CaseAttemptData {
  id: number;
  answers: string[];
  referenceAnswer: string[];
  submittedAt: string;
  score: number | null;
  /** v2 — qadam qarorlari bo'yicha avto-baho (0-100). */
  autoScore: number | null;
  teacherFeedback: string | null;
  reviewed: boolean;
}

/** v2 — qadam varianti. `correct`/`feedback` faqat tanlangach/topshirgach keladi. */
export interface CaseOption {
  index: number;
  text: string;
  correct?: boolean;
  feedback?: string;
}

export interface CaseStep {
  index: number;
  title: string;
  prompt: string;
  chosen: number | null;
  options: CaseOption[];
}

export interface CasePatient {
  name: string;
  info: string;
  vitals: { bp: string; pulse: string; spo2: string; temp: string } | null;
}

export interface CaseTabData {
  present: true;
  caseId: number;
  blocks: { complaints: string; anamnesis: string; objectiveStatus: string; labData: string };
  /** v2 — bemor kartasi (bo'sh bo'lsa ko'rsatilmaydi). */
  patient: CasePatient;
  /** v2 — bosqichma-bosqich qarorlar. Bo'sh bo'lsa eski erkin-matnli format. */
  steps: CaseStep[];
  questions: string[];
  attempt: CaseAttemptData | null;
}

/** AI konspekt (TopicDigest) — o'qituvchi tasdiqlagan bo'lsagina keladi. */
export interface Term {
  ru: string;
  uz: string;
  lat: string;
}
export interface DigestJson {
  objectives: string[];
  concepts: string[];
  terms: Term[];
  facts: string[];
  dosages: string[];
  imageIdeas: string[];
}

export type MaterialType = "pdf" | "docx" | "pptx" | "txt" | "md" | string;
export interface LessonMaterial {
  id: number;
  fileName: string;
  fileType: MaterialType;
  /** null bo'lsa UI ko'rsatmaydi (soxta raqam yo'q). */
  sizeBytes: number | null;
  pageCount: number | null;
  /** Ajratilgan matn mavjudmi ("Material matni" bloki uchun). */
  hasText: boolean;
}

export function useMaterialText(materialId: number | null) {
  return useQuery({
    queryKey: ["me-material-text", materialId],
    queryFn: () => api<{ id: number; fileName: string; text: string }>(`/api/v1/me/materials/${materialId}/text`),
    enabled: materialId !== null,
    staleTime: 5 * 60_000,
  });
}

/** Mavzuga biriktirilgan tashqi manba (darslik bobi, klinik ma'lumotnoma). */
export interface LessonLink {
  id: number;
  title: string;
  url: string;
  note: string | null;
}

// --- Bo'limli konspekt (1a) ---
export type DigestBlock =
  | { type: "para"; text: string }
  | { type: "callout"; tone: "important" | "warning"; text: string }
  | { type: "list"; ordered: boolean; items: { lead?: string; text: string }[] };

/** Faza 1: bo'lim oxiri active-recall savoli (ungraded self-check). */
export interface LessonCheckpoint {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface LessonSection {
  index: number;
  title: string;
  minutes: number;
  sourceRef: string | null;
  blocks: DigestBlock[];
  read: boolean;
  /** Faza 1: bo'lim ichiga media — diagramma(lar) + videodagi boshlanish sekundi. */
  media?: {
    slideImages: { slideId: string; url: string }[];
    videoAt: number | null;
  };
  /** Faza 1: bo'lim oxiri o'zini-tekshirish savoli (bo'lsa). */
  checkpoint?: LessonCheckpoint | null;
}

export interface Lesson {
  topicId: number;
  orderIndex: number;
  title: string;
  courseId: number;
  subjectName: string;
  /** Keyingi mavzu — tugagach to'g'ridan o'tish uchun (oxirgisi bo'lsa null). */
  nextTopic: { id: number; title: string; state: TopicState } | null;
  state: TopicState;
  completed: boolean;
  thresholds: { video: number; quizPass: number };
  elements: TopicElements;
  /** Chap panel — o'qituvchi manba materiallari. */
  materials: LessonMaterial[];
  /** Chap panel — tashqi manbalar. */
  links: LessonLink[];
  /** O'rta panel — AI konspekt (tasdiqlanmagan bo'lsa null). */
  digest: DigestJson | null;
  /** 1C: joriy konspekt versiyasiga audio tayyormi (o'qish ustuni pleyeri). */
  digestAudio?: boolean;
  /** v2 bo'limli o'qish. Bo'sh bo'lsa — eski yassi konspekt renderi. */
  sections: LessonSection[];
  /** Mavzuning taxminiy vaqti (daqiqa). */
  estimatedMinutes: number;
  /** Virtual bemor amaliyoti — bosqich holati (keys bo'lsa ochiq). */
  patient: { available: boolean; finished: boolean };
  tabs: {
    video: VideoTabData | null;
    slides: SlidesTabData | null;
    quiz: QuizTabData | null;
    case: CaseTabData | null;
  };
}

export interface QuizQ {
  id: number;
  text: string;
  options: string[];
  difficulty: string;
  correctIndex?: number;
  explanations?: string[];
  studentAnswer?: number | null;
  sourceFragment?: string | null;
}

export interface QuizAttemptView {
  id: number;
  quizId: number;
  status: "in_progress" | "finished";
  attemptNo: number;
  passThreshold: number;
  total: number;
  answers: Record<string, number>;
  /** Belgilangan savol id'lari (keyin qaytish uchun). */
  flagged: number[];
  /** Vaqt tugash momenti (ISO) yoki null — cheklanmagan. */
  expiresAt: string | null;
  scorePct: number | null;
  passed: boolean | null;
  correctCount: number | null;
  questions: QuizQ[];
}

export interface CaseAttemptView {
  id: number;
  answers: string[];
  referenceAnswer: string[];
  questions: string[];
  submittedAt: string;
  score: number | null;
  teacherFeedback: string | null;
  reviewed: boolean;
}

export function useLesson(topicId: number) {
  return useQuery({
    queryKey: ["me-lesson", topicId],
    queryFn: () => api<Lesson>(`/api/v1/me/topics/${topicId}`),
    retry: false,
  });
}

function useInvalidateLesson(topicId: number) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["me-lesson", topicId] });
    qc.invalidateQueries({ queryKey: ["me-course"] });
    qc.invalidateQueries({ queryKey: ["me-dashboard"] });
  };
}

// ---- Fleshkartalar (takrorlash) ----

export interface Flashcard {
  key: string;
  kind: "quiz" | "term";
  front: string;
  back: string;
  note: string | null;
  known: boolean | null;
}

export interface FlashcardsData {
  locked: boolean;
  reason: "quiz_not_finished" | null;
  cards: Flashcard[];
  total: number;
  knownCount: number;
  hasQuiz?: boolean;
}

export function useFlashcards(topicId: number) {
  return useQuery({
    queryKey: ["me-flashcards", topicId],
    queryFn: () => api<FlashcardsData>(`/api/v1/me/topics/${topicId}/flashcards`),
  });
}

export function useReviewFlashcard(topicId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { cardKey: string; known: boolean }) =>
      api<{ ok: boolean; knownCount: number; total: number }>(`/api/v1/me/topics/${topicId}/flashcards/review`, {
        method: "POST",
        body: JSON.stringify(b),
      }),
    onSuccess: (_r, b) => {
      // Optimistik: kartaning holatini keshda yangilaymiz (qayta so'rovsiz).
      qc.setQueryData<FlashcardsData>(["me-flashcards", topicId], (old) =>
        old
          ? {
              ...old,
              cards: old.cards.map((c) => (c.key === b.cardKey ? { ...c, known: b.known } : c)),
              knownCount: old.cards.filter((c) => (c.key === b.cardKey ? b.known : c.known === true)).length,
            }
          : old
      );
    },
  });
}

export function useResetFlashcards(topicId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api(`/api/v1/me/topics/${topicId}/flashcards/reset`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me-flashcards", topicId] }),
  });
}

// ---- AI-tutor chat (layout v2, 2C) ----

export interface TutorMsg {
  id: number;
  role: "student" | "assistant";
  text: string;
  createdAt: string;
}

export function useTutorChat(topicId: number) {
  return useQuery({
    queryKey: ["me-tutor-chat", topicId],
    queryFn: () => api<{ messages: TutorMsg[] }>(`/api/v1/me/topics/${topicId}/chat`),
  });
}

export function useSendTutorMessage(topicId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (text: string) =>
      api<{ messages: TutorMsg[] }>(`/api/v1/me/topics/${topicId}/chat`, {
        method: "POST",
        body: JSON.stringify({ text }),
      }),
    onSuccess: (res) => {
      // Yangi juftlikni keshga qo'shamiz (to'liq refetch shart emas).
      qc.setQueryData<{ messages: TutorMsg[] }>(["me-tutor-chat", topicId], (old) => ({
        messages: [...(old?.messages ?? []), ...res.messages],
      }));
    },
  });
}

// ---- Virtual bemor roleplay (Modul 26) ----

export interface PatientEval {
  diagnosis: string;
  correct: boolean;
  anamnesisScore: number;
  examinationScore: number;
  treatmentScore: number;
  safetyScore: number;
  communicationScore: number;
  overallScore: number;
  strengths: string;
  improvements: string;
}

export interface PatientMsg {
  id: number;
  /** "test" — buyurilgan tekshiruv natijasi (chatда alohida ko'rinadi). */
  role: "student" | "patient" | "eval" | "test";
  text: string;
  eval?: PatientEval;
  createdAt: string;
}

export interface DDxItem {
  diagnosis: string;
  probability: number;
  keyFinding: string;
}

export interface PatientData {
  available: boolean;
  patientInfo: { name: string; info: string } | null;
  finished: boolean;
  messages: PatientMsg[];
}

export function usePatient(topicId: number) {
  return useQuery({
    queryKey: ["me-patient", topicId],
    queryFn: () => api<PatientData>(`/api/v1/me/topics/${topicId}/patient`),
  });
}

export function useSendPatient(topicId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (text: string) =>
      api<{ messages: PatientMsg[] }>(`/api/v1/me/topics/${topicId}/patient`, {
        method: "POST",
        body: JSON.stringify({ text }),
      }),
    onSuccess: (res) => {
      qc.setQueryData<PatientData>(["me-patient", topicId], (old) =>
        old ? { ...old, messages: [...old.messages, ...res.messages] } : old
      );
    },
  });
}

export function useFinishPatient(topicId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (diagnosis: string) =>
      api<{ eval: PatientEval; finished: boolean }>(`/api/v1/me/topics/${topicId}/patient/finish`, {
        method: "POST",
        body: JSON.stringify({ diagnosis }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me-patient", topicId] });
      // Bosqich holati (stepper/obzor) lesson payloadida — uni ham yangilaymiz.
      qc.invalidateQueries({ queryKey: ["me-lesson", topicId] });
    },
  });
}

export function useResetPatient(topicId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api(`/api/v1/me/topics/${topicId}/patient/reset`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me-patient", topicId] });
      qc.invalidateQueries({ queryKey: ["me-lesson", topicId] });
    },
  });
}

/** Tekshiruv buyurish (EKG/lab/instrumental → natija chatда paydo bo'ladi). */
export function useOrderTest(topicId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (testType: string) =>
      api<{ message: PatientMsg }>(`/api/v1/me/topics/${topicId}/patient/test`, {
        method: "POST",
        body: JSON.stringify({ testType }),
      }),
    onSuccess: (res) => {
      qc.setQueryData<PatientData>(["me-patient", topicId], (old) =>
        old ? { ...old, messages: [...old.messages, res.message] } : old
      );
    },
  });
}

/** Jonli differensial tashxis (DDx) — mavjud dalillar asosida (AI chaqiruvi). */
export function usePatientDDx(topicId: number) {
  return useMutation({
    mutationFn: () => api<{ ddx: DDxItem[] }>(`/api/v1/me/topics/${topicId}/patient/ddx`),
  });
}

// ---- Interval takrorlash (Modul 26) — bugun takrorlanadigan kartalar ----

export interface ReviewDueTopic {
  topicId: number;
  topicTitle: string;
  subjectName: string;
  dueCount: number;
}

export function useReviewDue() {
  return useQuery({
    queryKey: ["me-review-due"],
    queryFn: () => api<{ total: number; topics: ReviewDueTopic[] }>("/api/v1/me/review/due"),
  });
}

/** Kross-mavzu takrorlash sessiyasi kartasi (Modul 27). */
export interface ReviewSessionCard extends Flashcard {
  topicId: number;
  topicTitle: string;
  subjectName: string;
}

export function useReviewSession(topicId?: number | null) {
  return useQuery({
    queryKey: ["me-review-session", topicId ?? null],
    queryFn: () =>
      api<{ cards: ReviewSessionCard[]; total: number }>(
        `/api/v1/me/review/session${topicId ? `?topicId=${topicId}` : ""}`
      ),
  });
}

export interface ReviewStats {
  dueNow: number;
  reviewedToday: number;
  knownPct: number | null;
  nextDueAt: string | null;
  upcoming: { topicId: number; topicTitle: string; subjectName: string; nextDueAt: string; count: number }[];
}

export function useReviewStats() {
  return useQuery({ queryKey: ["me-review-stats"], queryFn: () => api<ReviewStats>("/api/v1/me/review/stats") });
}

/** Sessiya kartasini belgilash — kartaning O'Z mavzusi bo'yicha (global). */
export function useReviewSessionMark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { topicId: number; cardKey: string; known: boolean }) =>
      api(`/api/v1/me/topics/${b.topicId}/flashcards/review`, {
        method: "POST",
        body: JSON.stringify({ cardKey: b.cardKey, known: b.known }),
      }),
    onSuccess: (_r, b) => {
      qc.invalidateQueries({ queryKey: ["me-review-due"] });
      qc.invalidateQueries({ queryKey: ["me-review-stats"] });
      qc.invalidateQueries({ queryKey: ["me-flashcards", b.topicId] });
      // Sessiya keshiga tegmaymiz — pleyer o'z indeksi bilan yuradi, yakunda refetch.
    },
  });
}

// ---- Qo'shimcha mashg'ulotlar (Modul 27) ----

export interface PracticeTopic {
  topicId: number;
  topicTitle: string;
  subjectName: string;
  wrongQuiz: number;
  wrongSteps: number;
  unknownCards: number;
  total: number;
}

export type PracticeItem =
  | {
      kind: "quiz";
      questionId: number;
      text: string;
      options: string[];
      correctIndex: number;
      explanations: string[];
      sourceFragment: string | null;
      yourAnswer: number | null;
    }
  | {
      kind: "step";
      title: string;
      prompt: string;
      options: { text: string; correct: boolean; feedback: string }[];
      yourAnswer: number | null;
    }
  | { kind: "card"; front: string; back: string; note: string | null };

export function usePracticeOverview() {
  return useQuery({ queryKey: ["me-practice"], queryFn: () => api<{ topics: PracticeTopic[] }>("/api/v1/me/practice") });
}

export function usePracticeSet(topicId: number | null) {
  return useQuery({
    queryKey: ["me-practice-set", topicId],
    queryFn: () =>
      api<{ topicId: number; topicTitle: string; subjectName: string; items: PracticeItem[] }>(
        `/api/v1/me/practice/${topicId}`
      ),
    enabled: topicId !== null,
  });
}

export interface PatientPracticeItem {
  topicId: number;
  topicTitle: string;
  subjectName: string;
  patientName: string;
  patientInfo: string;
  finished: boolean;
  /** true = bemor konspektdan generatsiya qilinadi (published keys yo'q). */
  generated?: boolean;
}

export function usePatientPractice() {
  return useQuery({
    queryKey: ["me-practice-patients"],
    queryFn: () => api<{ patients: PatientPracticeItem[] }>("/api/v1/me/practice/patients"),
  });
}

/** Konspekt bo'limini o'qildi deb belgilaydi (1a — "O'qildi n/N"). */
export function useMarkSectionRead(topicId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sectionIndex: number) =>
      api<{ ok: boolean; readCount: number; total: number }>(
        `/api/v1/me/topics/${topicId}/sections/${sectionIndex}/read`,
        { method: "POST" }
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me-lesson", topicId] }),
  });
}

export function useVideoProgress(topicId: number) {
  return useMutation({
    mutationFn: (b: { watchedPct: number; positionSec: number }) =>
      api(`/api/v1/me/topics/${topicId}/video-progress`, { method: "POST", body: JSON.stringify(b) }),
  });
}

export function useSlidesViewed(topicId: number) {
  const invalidate = useInvalidateLesson(topicId);
  return useMutation({
    mutationFn: () => api(`/api/v1/me/topics/${topicId}/slides-viewed`, { method: "POST" }),
    onSuccess: invalidate,
  });
}

export function useStartAttempt() {
  return useMutation({
    mutationFn: (quizId: number) => api<QuizAttemptView>(`/api/v1/me/quizzes/${quizId}/attempts`, { method: "POST" }),
  });
}

export function useSaveAnswers() {
  return useMutation({
    mutationFn: (b: { attemptId: number; answers: Record<string, number> }) =>
      api<QuizAttemptView>(`/api/v1/me/attempts/${b.attemptId}/answers`, { method: "PUT", body: JSON.stringify({ answers: b.answers }) }),
  });
}

export function useFinishAttempt(topicId: number) {
  const invalidate = useInvalidateLesson(topicId);
  return useMutation({
    mutationFn: (attemptId: number) => api<{ attempt: QuizAttemptView; topic: unknown }>(`/api/v1/me/attempts/${attemptId}/finish`, { method: "POST" }),
    onSuccess: invalidate,
  });
}

/** Savolni belgilash / belgini olib tashlash (1c). */
export function useFlagQuestion(attemptId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { questionId: number; flagged: boolean }) =>
      api<QuizAttemptView>(`/api/v1/me/attempts/${attemptId}/flag`, {
        method: "POST",
        body: JSON.stringify(b),
      }),
    onSuccess: (view) => qc.setQueryData(["me-attempt", attemptId], view),
  });
}

export function useAttempt(attemptId: number | null) {
  return useQuery({
    queryKey: ["me-attempt", attemptId],
    queryFn: () => api<QuizAttemptView>(`/api/v1/me/attempts/${attemptId}`),
    enabled: attemptId !== null,
    retry: false,
  });
}

export function useSubmitCase(topicId: number) {
  const invalidate = useInvalidateLesson(topicId);
  return useMutation({
    mutationFn: (b: { caseId: number; answers: string[]; steps?: Record<string, number> }) =>
      api<CaseAttemptView>(`/api/v1/me/cases/${b.caseId}/attempts`, {
        method: "POST",
        body: JSON.stringify({ answers: b.answers, steps: b.steps }),
      }),
    onSuccess: invalidate,
  });
}

// ---------------- Attendance + profile (Module 16) ----------------

export type AttStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

export interface MyAttendance {
  stats: { present: number; absent: number; late: number; excused: number; pct: number | null };
  /** Kurslar kesimi — eng past davomat birinchi. */
  byCourse: {
    courseId: number;
    courseName: string;
    present: number;
    absent: number;
    late: number;
    excused: number;
    marked: number;
    pct: number | null;
  }[];
  /** Oxirgi 6 oy trendi. */
  byMonth: { month: string; marked: number; pct: number }[];
  sessions: {
    id: number;
    date: string;
    courseName: string;
    title: string | null;
    status: AttStatus;
  }[];
}

export interface MyProfile {
  /** Ma'lumotnoma — kim, qayerda o'qiydi. */
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  locale: "uz" | "ru";
  groupName: string | null;
  facultyName: string | null;
  yearOfStudy: number | null;
  academicYear: string | null;
  semester: number | null;
  /** Ko'rsatkichlar — bosh sahifa/davomat modullarida ishlatiladi. */
  coursesCount: number;
  completedTopics: number;
  attendancePct: number | null;
}

export function useMyAttendance(courseId: number | undefined, range: { from?: string; to?: string }) {
  const p = new URLSearchParams();
  if (courseId) p.set("courseId", String(courseId));
  if (range.from) p.set("from", range.from);
  if (range.to) p.set("to", range.to);
  return useQuery({ queryKey: ["me-attendance", courseId, range], queryFn: () => api<MyAttendance>(`/api/v1/me/attendance?${p}`) });
}

export function useMyProfile() {
  return useQuery({ queryKey: ["me-profile"], queryFn: () => api<MyProfile>("/api/v1/me/profile") });
}

// ---- Baholarim (Modul 22) ----

export interface GradeQuiz {
  topicId: number;
  topicTitle: string;
  orderIndex: number;
  bestScore: number;
  attempts: number;
  passed: boolean;
  lastAt: string | null;
  passThreshold: number;
  /** Urinishlar tarixi — qator ochilganda ko'rsatiladi. */
  history: { attemptNo: number; scorePct: number; passed: boolean; finishedAt: string | null }[];
}

export interface GradeCase {
  topicId: number;
  topicTitle: string;
  orderIndex: number;
  score: number | null;
  feedback: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  submittedAt: string;
  reviewed: boolean;
}

export interface GradesCourse {
  courseId: number;
  subjectName: string;
  semester: number;
  academicYear: string;
  avgQuiz: number | null;
  quizzes: GradeQuiz[];
  cases: GradeCase[];
}

export interface MyGrades {
  courses: GradesCourse[];
  summary: {
    avgQuiz: number | null;
    quizzesPassed: number;
    quizzesTotal: number;
    casesGraded: number;
    casesTotal: number;
  };
}

export function useMyGrades() {
  return useQuery({ queryKey: ["me-grades"], queryFn: () => api<MyGrades>("/api/v1/me/grades") });
}

// ---- Jadval / faollik / o'rin (Modul 21) ----

export interface ScheduleItem {
  /** Barqaror React kaliti — dars endi slotlardan hosil bo'ladi (materializatsiya
   *  qilinmagan bo'lsa ham noyob): "courseId-groupId-dayKey-startTime". */
  key: string;
  /** Materializatsiya qilingan LessonSession id (bo'lsa), aks holda null. */
  sessionId: number | null;
  date: string;
  room: string | null;
  courseId: number;
  courseName: string;
  groupId: number | null;
  title: string | null;
  isPast: boolean;
  /** O'tgan dars uchun mening yo'qlama holatim (belgilanmagan — null). */
  myStatus: AttStatus | null;
}

export type ActivityType =
  | "topic_completed"
  | "topic_activity"
  | "quiz_passed"
  | "quiz_failed"
  | "case_submitted"
  | "case_graded";

export interface ActivityItem {
  type: ActivityType;
  at: string;
  topicId: number;
  topic: string;
  score: number | null;
}

export function useMySchedule(range?: { from: string; to: string }) {
  const qs = range ? `?from=${range.from}&to=${range.to}` : "";
  return useQuery({
    queryKey: ["me-schedule", range?.from ?? "next7", range?.to ?? ""],
    queryFn: () => api<ScheduleItem[]>(`/api/v1/me/schedule${qs}`),
  });
}

export function useMyActivity() {
  return useQuery({ queryKey: ["me-activity"], queryFn: () => api<ActivityItem[]>("/api/v1/me/activity") });
}

// ---- FaceID davomat (WebAuthn passkey + GPS) ----

export interface CheckinOpen {
  key: string;
  courseId: number;
  courseName: string;
  room: string | null;
  date: string;
  /** Hozir bosilsa yoziladigan holat (vaqt oynasiga qarab). */
  wouldBe: "PRESENT" | "LATE";
  myStatus: AttStatus | null;
}
export interface CheckinState {
  hasCredential: boolean;
  geofenceRequired: boolean;
  /** Vaqt oynasi ochiq dars (bo'lmasa null → tugma ko'rsatilmaydi). */
  open: CheckinOpen | null;
  next: { courseName: string; room: string | null; date: string } | null;
}

export function useCheckinState() {
  return useQuery({
    queryKey: ["me-checkin"],
    queryFn: () => api<CheckinState>("/api/v1/me/checkin"),
    refetchInterval: 30000, // vaqt oynasi ochilishi/yopilishini kuzatadi
  });
}

export interface WebauthnDevice {
  id: number;
  deviceName: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}
export function useWebauthnDevices() {
  return useQuery({ queryKey: ["webauthn-devices"], queryFn: () => api<WebauthnDevice[]>("/api/v1/me/webauthn/credentials") });
}
export function useRemoveWebauthnDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<{ ok: boolean }>(`/api/v1/me/webauthn/credentials/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["webauthn-devices"] });
      qc.invalidateQueries({ queryKey: ["me-checkin"] });
    },
  });
}

/** O'z o'rni guruhda — boshqa talabalar ro'yxati qaytmaydi. */
export interface LeaderboardRow {
  rank: number;
  fullName: string;
  completed: number;
  isMe: boolean;
}
export interface MyRank {
  rank: number | null;
  total: number;
  completed: number;
  top: LeaderboardRow[];
}

export function useMyRank() {
  return useQuery({
    queryKey: ["me-rank"],
    queryFn: () => api<MyRank>("/api/v1/me/rank"),
  });
}

export function useSetLocale() {
  return useMutation({
    mutationFn: (locale: "uz" | "ru") => api<{ ok: boolean; locale: string }>("/api/v1/me/locale", { method: "PUT", body: JSON.stringify({ locale }) }),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (b: { oldPassword: string; newPassword: string }) =>
      api("/api/v1/me/change-password", { method: "POST", body: JSON.stringify(b) }),
  });
}
