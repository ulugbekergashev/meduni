import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, API_URL } from "../../lib/api";

export { API_URL };

// ---------------- Departments (shared dropdown) ----------------
export interface Dept {
  id: number;
  facultyId: number;
  name: string;
  facultyName: string;
}
export function useDepartments() {
  return useQuery({ queryKey: ["departments"], queryFn: () => api<Dept[]>("/api/v1/departments") });
}


// ---------------- AI monitoring ----------------
export interface AiUsage {
  totals: { tokens: number; images: number; ttsChars: number; cost: number };
  byDay: { day: string; tokens: number; images: number; cost: number }[];
  byKind: { kind: string; tokens: number; images: number; ttsChars: number; cost: number }[];
  byModel: { model: string; tokens: number; cost: number }[];
  byDept: {
    departmentId: number; name: string;
    tokens: number; images: number; ttsChars: number; cost: number;
    quota: { token: number; image: number; cost: number } | null;
    tokenPct: number | null; imagePct: number | null; costPct: number | null;
  }[];
  byUser: { userId: number; name: string; tokens: number; cost: number }[];
}
export function useAiUsage(month?: string) {
  return useQuery({
    queryKey: ["ai-usage", month ?? "current"],
    queryFn: () => api<AiUsage>(`/api/v1/admin/ai-usage${month ? `?month=${month}` : ""}`),
  });
}
export interface Quota {
  departmentId: number;
  name: string;
  facultyName: string;
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
  subjectName: string;
  semester: number;
  academicYear: string;
  groups: string[];
  studentCount: number;
}
export interface StudentProfileCourse {
  id: number;
  subjectName: string;
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
  departmentName: string | null;
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

// ---------------- Tasks (department assignments) ----------------
export interface TeacherOption { id: number; fullName: string }
export function useTeacherOptions() {
  return useQuery({
    queryKey: ["teacher-options"],
    queryFn: async () => {
      const res = await api<{ items: TeacherOption[] }>("/api/v1/users?role=TEACHER&page=1");
      return res.items.map((t) => ({ id: t.id, fullName: t.fullName }));
    },
  });
}

export interface CreatedTaskGroup {
  key: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  createdAt: string;
  total: number;
  done: number;
  assignees: string[];
  taskIds: number[];
}
export function useCreatedTasks() {
  return useQuery({ queryKey: ["created-tasks"], queryFn: () => api<CreatedTaskGroup[]>("/api/v1/tasks/created") });
}

export interface CreateTaskBody {
  title: string;
  description?: string;
  dueDate?: string | null;
  teacherId?: number;
  departmentId?: number;
}
export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTaskBody) => api<{ count: number }>("/api/v1/tasks", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["created-tasks"] }),
  });
}
export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api(`/api/v1/tasks/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["created-tasks"] }),
  });
}
