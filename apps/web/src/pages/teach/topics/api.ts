import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";

export type TopicStatus = "draft" | "published";
export type ParseStatus = "pending" | "processing" | "done" | "error";

export interface TopicRow {
  id: number;
  courseId: number;
  titleUz: string;
  titleRu: string;
  orderIndex: number;
  status: TopicStatus;
  materialCount: number;
}

export interface Material {
  id: number;
  topicId: number;
  fileName: string;
  fileType: string;
  parseStatus: ParseStatus;
  hasText: boolean;
  errorUz: string | null;
  errorRu: string | null;
  createdAt: string;
}

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

export interface Digest {
  digestJson: DigestJson;
  version: number;
  approvedByTeacher: boolean;
}

export type ContentKind = "quiz" | "case" | "presentation" | "video";
export type ContentStatus = "draft" | "review" | "approved" | "published";
export type Difficulty = "RECALL" | "UNDERSTAND" | "APPLY";

export interface ContentSummary {
  id: number;
  kind: ContentKind;
  status: ContentStatus;
  editedByTeacher: boolean;
}

export interface TopicDetail extends TopicRow {
  materials: Material[];
  digestUnlocked: boolean;
  digest: Digest | null;
  generateUnlocked: boolean;
  content: ContentSummary[];
}

export interface QuizQuestion {
  id?: number;
  text: string;
  options: string[];
  correctIndex: number;
  explanations: string[];
  difficulty: Difficulty;
  sourceFragment: string | null;
}

export interface CaseJson {
  complaints: string;
  anamnesis: string;
  objectiveStatus: string;
  labData: string;
  questions: string[];
  referenceAnswer: string[];
}

export interface ContentFull {
  id: number;
  topicId: number;
  kind: ContentKind;
  language: "uz" | "ru";
  status: ContentStatus;
  version: number;
  editedByTeacher: boolean;
  quiz: { passThreshold: number; maxAttempts: number; questions: QuizQuestion[] } | null;
  clinicalCase: { caseJson: CaseJson; format: "SHORT" | "EXTENDED" } | null;
}

// ---- Topics ----

export function useTopics(courseId: number) {
  return useQuery({
    queryKey: ["topics", courseId],
    queryFn: () => api<TopicRow[]>(`/api/v1/topics?courseId=${courseId}`),
  });
}

export function useCreateTopic(courseId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { titleUz: string; titleRu: string }) =>
      api<TopicRow>("/api/v1/topics", { method: "POST", body: JSON.stringify({ courseId, ...body }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["topics", courseId] }),
  });
}

export function useDeleteTopic(courseId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api(`/api/v1/topics/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["topics", courseId] }),
  });
}

export function useReorderTopics(courseId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: number[]) =>
      api("/api/v1/topics/reorder", { method: "PATCH", body: JSON.stringify({ orderedIds }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["topics", courseId] }),
  });
}

// ---- Topic detail (constructor) ----

export function useTopicDetail(id: number) {
  return useQuery({
    queryKey: ["topic", id],
    queryFn: () => api<TopicDetail>(`/api/v1/topics/${id}`),
    // Poll while any material is still parsing.
    refetchInterval: (query) => {
      const data = query.state.data as TopicDetail | undefined;
      const parsing = data?.materials.some((m) => m.parseStatus === "pending" || m.parseStatus === "processing");
      return parsing ? 2000 : false;
    },
  });
}

// ---- Materials ----

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export function useUploadMaterial(topicId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_URL}/api/v1/topics/${topicId}/materials`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      if (!res.ok) throw new Error("upload_failed");
      return (await res.json()) as Material;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["topic", topicId] }),
  });
}

export function useRetryMaterial(topicId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<Material>(`/api/v1/materials/${id}/retry`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["topic", topicId] }),
  });
}

export function useDeleteMaterial(topicId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api(`/api/v1/materials/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["topic", topicId] }),
  });
}

export function fetchMaterialText(id: number) {
  return api<{ text: string }>(`/api/v1/materials/${id}/text`);
}

// ---- Digest (AI konspekt) ----

export function useGenerateDigest(topicId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<Digest>(`/api/v1/topics/${topicId}/digest/generate`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["topic", topicId] }),
  });
}

export function useUpdateDigest(topicId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (digestJson: DigestJson) =>
      api<Digest>(`/api/v1/topics/${topicId}/digest`, { method: "PUT", body: JSON.stringify(digestJson) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["topic", topicId] }),
  });
}

export function useApproveDigest(topicId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<Digest>(`/api/v1/topics/${topicId}/digest/approve`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["topic", topicId] }),
  });
}

// ---- Content generation & editing ----

export function useGenerateQuiz(topicId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { language: "uz" | "ru"; questionCount: number; difficulty: string }) =>
      api<ContentFull>(`/api/v1/topics/${topicId}/generate/quiz`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["topic", topicId] }),
  });
}

export function useGenerateCase(topicId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { language: "uz" | "ru"; format: "SHORT" | "EXTENDED" }) =>
      api<ContentFull>(`/api/v1/topics/${topicId}/generate/case`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["topic", topicId] }),
  });
}

export function useContent(id: number) {
  return useQuery({ queryKey: ["content", id], queryFn: () => api<ContentFull>(`/api/v1/content/${id}`) });
}

export function useUpdateContent(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api<ContentFull>(`/api/v1/content/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ["content", id] });
      qc.invalidateQueries({ queryKey: ["topic", c.topicId] });
    },
  });
}
