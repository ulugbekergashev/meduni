import { useQuery } from "@tanstack/react-query";
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

export interface Dashboard {
  fullName: string;
  resume: Resume | null;
  courses: CourseSummary[];
  notifications: unknown[];
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
