import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, API_URL } from "../../lib/api";

export { API_URL };

// ---------------- Departments (shared dropdown) ----------------
export interface Dept {
  id: number;
  facultyId: number;
  nameUz: string;
  nameRu: string;
  facultyNameUz: string;
  facultyNameRu: string;
}
export function useDepartments() {
  return useQuery({ queryKey: ["departments"], queryFn: () => api<Dept[]>("/api/v1/departments") });
}

// ---------------- Glossary ----------------
export interface Term {
  id: number;
  departmentId: number;
  termRu: string;
  termUz: string;
  termLat: string | null;
}
export function useGlossary(departmentId: number | undefined, search: string) {
  const p = new URLSearchParams();
  if (departmentId) p.set("departmentId", String(departmentId));
  if (search.trim()) p.set("search", search.trim());
  return useQuery({ queryKey: ["glossary", departmentId, search], queryFn: () => api<Term[]>(`/api/v1/glossary?${p}`), enabled: departmentId !== undefined });
}
export function useCreateTerm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { departmentId: number; termRu: string; termUz: string; termLat?: string }) => api("/api/v1/glossary", { method: "POST", body: JSON.stringify(b) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["glossary"] }),
  });
}
export function useDeleteTerm() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: number) => api(`/api/v1/glossary/${id}`, { method: "DELETE" }), onSuccess: () => qc.invalidateQueries({ queryKey: ["glossary"] }) });
}

// ---------------- Templates ----------------
export interface Template {
  id: number;
  name: string;
  colors: { primary: string; secondary: string };
  logoUrl: string | null;
  hasMaster: boolean;
  isDefault: boolean;
}
export function useTemplates() {
  return useQuery({ queryKey: ["templates"], queryFn: () => api<Template[]>("/api/v1/templates") });
}
export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { name: string; colors: { primary: string; secondary: string }; logoUrl?: string }) => api("/api/v1/templates", { method: "POST", body: JSON.stringify(b) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });
}
export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: number) => api(`/api/v1/templates/${id}`, { method: "DELETE" }), onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }) });
}
export function useSetDefaultTemplate() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: number) => api(`/api/v1/templates/${id}/set-default`, { method: "POST" }), onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }) });
}

// ---------------- AI monitoring ----------------
export interface AiUsage {
  totals: { tokens: number; images: number; ttsChars: number; cost: number };
  byDept: { departmentId: number; nameUz: string; nameRu: string; tokens: number; images: number; ttsChars: number; cost: number; quota: { token: number; image: number; cost: number } | null; tokenPct: number | null; costPct: number | null }[];
  byKind: { kind: string; tokens: number; images: number; ttsChars: number; cost: number }[];
}
export function useAiUsage() {
  return useQuery({ queryKey: ["ai-usage"], queryFn: () => api<AiUsage>("/api/v1/admin/ai-usage") });
}
export interface Quota {
  departmentId: number;
  nameUz: string;
  nameRu: string;
  facultyNameUz: string;
  facultyNameRu: string;
  quota: { monthlyTokenLimit: number; monthlyImageLimit: number; monthlyCostLimit: number };
  used: { tokens: number; images: number; cost: number };
}
export function useQuotas() {
  return useQuery({ queryKey: ["quotas"], queryFn: () => api<Quota[]>("/api/v1/admin/quotas") });
}
export function useSetQuota() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { departmentId: number; monthlyTokenLimit: number; monthlyImageLimit: number; monthlyCostLimit: number }) => api(`/api/v1/admin/quotas/${b.departmentId}`, { method: "PUT", body: JSON.stringify(b) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["quotas"] }); qc.invalidateQueries({ queryKey: ["ai-usage"] }); },
  });
}

// ---------------- Audit ----------------
export interface AuditItem {
  id: number;
  createdAt: string;
  actorName: string;
  actorRole: string;
  action: string;
  entity: string;
  entityId: number;
  details: unknown;
}
export interface AuditResult {
  items: AuditItem[];
  total: number;
  page: number;
  pages: number;
  actions: string[];
}
export function useAudit(q: { actor: string; action: string; from: string; to: string; page: number }) {
  const p = new URLSearchParams();
  if (q.actor.trim()) p.set("actor", q.actor.trim());
  if (q.action) p.set("action", q.action);
  if (q.from) p.set("from", q.from);
  if (q.to) p.set("to", q.to);
  p.set("page", String(q.page));
  return useQuery({ queryKey: ["audit", q], queryFn: () => api<AuditResult>(`/api/v1/admin/audit?${p}`) });
}

// ---------------- User profile (role-aware) ----------------
export interface TeacherProfileCourse {
  id: number;
  subjectNameUz: string;
  subjectNameRu: string;
  semester: number;
  academicYear: string;
  groups: string[];
  studentCount: number;
}
export interface StudentProfileCourse {
  id: number;
  subjectNameUz: string;
  subjectNameRu: string;
  semester: number;
  completed: number;
  total: number;
  progressPct: number;
}
export interface UserProfile {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  groupName: string | null;
  departmentNameUz: string | null;
  departmentNameRu: string | null;
  position: string | null;
  kind: "teacher" | "student" | "admin";
  stats?: { courses: number; students: number; publishedTopics: number };
  courses?: (TeacherProfileCourse | StudentProfileCourse)[];
  attendancePct?: number | null;
}
export function useUserProfile(id: number) {
  return useQuery({ queryKey: ["user-profile", id], queryFn: () => api<UserProfile>(`/api/v1/users/${id}/profile`), retry: false });
}

// ---------------- Dashboard stats ----------------
export interface AdminStats {
  counts: { students: number; teachers: number; courses: number; publishedTopics: number; publishedContent: number };
  attention: { casesToReview: number; contentToApprove: number; departmentsOverQuota: number };
  aiThisMonth: { tokens: number; images: number; cost: number };
  activity: { contentLast7Days: number; activeStudentsLast7Days: number };
}
export function useAdminStats() {
  return useQuery({ queryKey: ["admin-stats"], queryFn: () => api<AdminStats>("/api/v1/admin/stats") });
}
