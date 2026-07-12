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
  titleUz: string;
  titleRu: string;
  orderIndex: number;
  state: TopicState;
  pct: number;
  reason: Reason | null;
  elements: TopicElements;
}

export interface CourseSummary {
  id: number;
  subjectNameUz: string;
  subjectNameRu: string;
  teacherName: string;
  groupName: string | null;
  topicsTotal: number;
  topicsCompleted: number;
  progressPct: number;
  nextTopicUz: string | null;
  nextTopicRu: string | null;
  nextTopicId: number | null;
}

export interface CoursePath extends Omit<CourseSummary, "nextTopicUz" | "nextTopicRu" | "nextTopicId"> {
  topics: StudentTopic[];
}

export interface Resume {
  courseId: number;
  subjectNameUz: string;
  subjectNameRu: string;
  topicId: number;
  topicUz: string;
  topicRu: string;
  pct: number;
}

export interface Notification {
  type: "case_reviewed";
  caseAttemptId: number;
  topicId: number;
  topicUz: string;
  topicRu: string;
  score: number | null;
  reviewedAt: string;
}

export interface Dashboard {
  fullName: string;
  resume: Resume | null;
  courses: CourseSummary[];
  notifications: Notification[];
}

export function useMyDashboard() {
  return useQuery({ queryKey: ["me-dashboard"], queryFn: () => api<Dashboard>("/api/v1/me/dashboard") });
}

export function useMyCourse(id: number) {
  return useQuery({
    queryKey: ["me-course", id],
    queryFn: () => api<CoursePath>(`/api/v1/me/courses/${id}`),
    retry: false,
  });
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
  attempt: QuizAttemptSummary | null;
}

export interface CaseAttemptData {
  id: number;
  answers: string[];
  referenceAnswer: string[];
  submittedAt: string;
  score: number | null;
  teacherFeedback: string | null;
  reviewed: boolean;
}

export interface CaseTabData {
  present: true;
  caseId: number;
  blocks: { complaints: string; anamnesis: string; objectiveStatus: string; labData: string };
  questions: string[];
  attempt: CaseAttemptData | null;
}

export interface Lesson {
  topicId: number;
  orderIndex: number;
  titleUz: string;
  titleRu: string;
  courseId: number;
  state: TopicState;
  completed: boolean;
  thresholds: { video: number; quizPass: number };
  elements: TopicElements;
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
    mutationFn: (b: { caseId: number; answers: string[] }) =>
      api<CaseAttemptView>(`/api/v1/me/cases/${b.caseId}/attempts`, { method: "POST", body: JSON.stringify({ answers: b.answers }) }),
    onSuccess: invalidate,
  });
}
