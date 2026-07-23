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

export interface LessonSection {
  index: number;
  title: string;
  minutes: number;
  sourceRef: string | null;
  blocks: DigestBlock[];
  read: boolean;
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
  /** v2 bo'limli o'qish. Bo'sh bo'lsa — eski yassi konspekt renderi. */
  sections: LessonSection[];
  /** Mavzuning taxminiy vaqti (daqiqa). */
  estimatedMinutes: number;
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

// ---- Kurs guruh chati (Modul 25) — o'qituvchi + guruh talabalari ----

export interface CourseChatMessage {
  id: number;
  text: string;
  authorId: number;
  authorName: string;
  role: "teacher" | "student";
  mine: boolean;
  createdAt: string;
}

export interface CourseChatMeta {
  courseId: number;
  name: string;
  teacherName: string;
  memberCount: number;
}

/** Kurs chati — 5s polling bilan (real vaqtga yaqin). */
export function useCourseChat(courseId: number | null) {
  return useQuery({
    queryKey: ["me-course-chat", courseId],
    queryFn: () => api<{ messages: CourseChatMessage[] }>(`/api/v1/me/courses/${courseId}/chat`),
    enabled: courseId != null,
    refetchInterval: 5000,
  });
}

export function useCourseChatMeta(courseId: number | null) {
  return useQuery({
    queryKey: ["me-course-chat-meta", courseId],
    queryFn: () => api<CourseChatMeta>(`/api/v1/me/courses/${courseId}/chat/meta`),
    enabled: courseId != null,
  });
}

export function useSendCourseChat(courseId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (text: string) =>
      api<CourseChatMessage>(`/api/v1/me/courses/${courseId}/chat`, {
        method: "POST",
        body: JSON.stringify({ text }),
      }),
    onSuccess: (msg) => {
      qc.setQueryData<{ messages: CourseChatMessage[] }>(["me-course-chat", courseId], (old) => {
        const list = old?.messages ?? [];
        if (list.some((m) => m.id === msg.id)) return old!;
        return { messages: [...list, msg] };
      });
    },
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
  id: number;
  date: string;
  room: string | null;
  courseId: number;
  courseName: string;
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
