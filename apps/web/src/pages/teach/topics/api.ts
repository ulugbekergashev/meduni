import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API_URL, api, apiUpload } from "../../../lib/api";

export type TopicStatus = "draft" | "published";
export type ParseStatus = "pending" | "processing" | "done" | "error";

export interface TopicRow {
  id: number;
  /** Fan/kurs birlashdi — mavzu bevosita kursga tegishli. */
  courseId: number;
  title: string;
  orderIndex: number;
  status: TopicStatus;
  materialCount: number;
  /** Pipeline summary for list rows: konspekt holati + mavjud kontent turlari. */
  digestState: "approved" | "draft" | null;
  contentKinds: { kind: "quiz" | "case" | "presentation" | "video"; status: string }[];
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

/** Faza 1: bo'lim oxiri active-recall savoli (o'qituvchi tahrirlaydi/tasdiqlaydi). */
export interface DigestCheckpoint {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

/** Bo'limli konspekt (v2). Editor faqat `checkpoint`ni tahrirlaydi; qolgan
 *  maydonlar runtime'da round-trip bilan saqlanadi (blocks tahrir qilinmaydi). */
export interface DigestSection {
  id?: string;
  title: string;
  minutes: number;
  sourceRef: string;
  blocks: unknown[];
  checkpoint?: DigestCheckpoint | null;
}

export interface DigestJson {
  sections?: DigestSection[];
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
  /** Joriy versiyaga audio-podkast yaratilganmi. */
  hasAudio?: boolean;
}

export type ContentKind = "quiz" | "case" | "presentation" | "video";
export type ContentStatus = "draft" | "review" | "approved" | "published";
export type Difficulty = "RECALL" | "UNDERSTAND" | "APPLY";


export interface ContentSummary {
  id: number;
  kind: ContentKind;
  status: ContentStatus;
  editedByTeacher: boolean;
  reviewOpened: boolean;
  approvedByName: string | null;
  approvedAt: string | null;
}

export interface UnlockRule {
  videoWatchedPct: number;
  quizPassedPct: number;
  quizMaxAttempts: number;
  caseRequired: boolean;
  caseReviewedRequired: boolean;
  notBeforeDate: string | null;
  logic: "AND" | "OR";
}

export interface TopicDetail extends TopicRow {
  materials: Material[];
  digestUnlocked: boolean;
  digest: Digest | null;
  generateUnlocked: boolean;
  unlockRule: UnlockRule | null;
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

/** v2 — qadam varianti (o'qituvchi to'g'ri javob va izohni ko'radi/tahrirlaydi). */
export interface CaseStepOption {
  text: string;
  correct: boolean;
  feedback: string;
}

export interface CaseStepJson {
  title: string;
  prompt: string;
  options: CaseStepOption[];
}

export interface CaseJson {
  complaints: string;
  anamnesis: string;
  objectiveStatus: string;
  labData: string;
  /** v2 — bemor kartasi. Eski keyslarda bo'lmasligi mumkin. */
  patientName?: string;
  patientInfo?: string;
  vitals?: { bp?: string; pulse?: string; spo2?: string; temp?: string };
  /** v2 — bosqichma-bosqich qarorlar. Eski keyslarda bo'sh/yo'q. */
  steps?: CaseStepJson[];
  questions: string[];
  referenceAnswer: string[];
  /** Modul 28 — virtual bemor xulqi (o'qituvchi ssenariysi). */
  patientBehavior?: string;
}

export type SlideLayout = "TITLE" | "TWO_BLOCK" | "THREE_BLOCK" | "BODY_DIAGRAM" | "IMAGE_LEFT" | "BULLETS";
export type SlotStatus = "PENDING" | "PROCESSING" | "DONE" | "ERROR";

export interface ImageSlot {
  prompt: string;
  status: SlotStatus;
  url: string | null;
}

export interface Slide {
  id: string;
  layout: SlideLayout;
  title: string;
  bullets: string[];
  speakerNotes: string;
  imageSlots: ImageSlot[];
}

export interface PresentationContent {
  id: number;
  slides: Slide[];
}

export type VideoBuildStatus = "pending" | "script" | "tts" | "render" | "done" | "error";

export interface VideoVisual {
  kind: "title" | "points" | "term" | "warning";
  title: string;
  points: string[];
}
export interface ScriptSegment {
  slideIndex?: number;
  narration: string;
  durationSec: number;
  visual?: VideoVisual;
}

export interface VideoContent {
  id: number;
  buildStatus: VideoBuildStatus;
  errorStage: string | null;
  voiceId: string | null;
  durationSec: number | null;
  script: ScriptSegment[];
  /** Ovozlangan segmentlar hisobi — spinner o'rniga haqiqiy jarayon. */
  progress: { done: number; total: number };
  hasMp4: boolean;
  /** Ovoz tayyor — talaba slayd-pleyerda ko'radi (mp4 shart emas). */
  hasAudio?: boolean;
  hasSrt: boolean;
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
  presentation: PresentationContent | null;
  video: VideoContent | null;
}

// ---- Topics ----
// Fan/kurs birlashdi — mavzular bevosita kursga tegishli.

export type TopicScope = { courseId: number };

const scopeKey = (s: TopicScope) => ["topics", "course", s.courseId] as const;
const scopeQs = (s: TopicScope) => `courseId=${s.courseId}`;

export function useTopics(scope: TopicScope) {
  return useQuery({
    queryKey: scopeKey(scope),
    queryFn: () => api<TopicRow[]>(`/api/v1/topics?${scopeQs(scope)}`),
  });
}

/** Bir fan mavzulari bir necha qamrovda keshlanadi — hammasini yangilaymiz. */
function useInvalidateTopics() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["topics"] });
}

export function useCreateTopic(scope: TopicScope) {
  const invalidate = useInvalidateTopics();
  return useMutation({
    mutationFn: (body: { title?: string }) =>
      api<TopicRow>("/api/v1/topics", { method: "POST", body: JSON.stringify({ ...scope, ...body }) }),
    onSuccess: invalidate,
  });
}

export function useDeleteTopic() {
  const invalidate = useInvalidateTopics();
  return useMutation({
    mutationFn: (id: number) => api(`/api/v1/topics/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

export function useReorderTopics() {
  const invalidate = useInvalidateTopics();
  return useMutation({
    mutationFn: (orderedIds: number[]) =>
      api("/api/v1/topics/reorder", { method: "PATCH", body: JSON.stringify({ orderedIds }) }),
    onSuccess: invalidate,
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

export function useUploadMaterial(topicId: number) {
  const qc = useQueryClient();
  return useMutation({
    // Xato chaqiruv joyida ko'rsatiladi - global toast takrorlamasin.
    meta: { silent: true },
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return apiUpload<Material>(`/api/v1/topics/${topicId}/materials`, form);
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
    // Xato chaqiruv joyida ko'rsatiladi - global toast takrorlamasin.
    meta: { silent: true },
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

/** 1C: konspektni ovozga aylantiradi (joriy versiya). */
export function useGenerateDigestAudio(topicId: number) {
  return useMutation({
    mutationFn: () => api<{ ok: boolean; version: number }>(`/api/v1/topics/${topicId}/digest/audio`, { method: "POST" }),
  });
}

// ---- Audio-podkast (~20 daqiqa, ikki ovozli suhbat) ----

export interface PodcastChapter {
  title: string;
  startSec: number;
  sectionId: string | null;
}

export interface PodcastState {
  id: number;
  status: "pending" | "script" | "tts" | "render" | "done" | "error";
  errorStage: string | null;
  language: "uz" | "ru";
  durationSec: number | null;
  hasAudio: boolean;
  progress: { voiced: number; total: number };
  chapters: PodcastChapter[];
  /** Konspekt tahrirlangan — podkast eskirgan (qayta yaratish kerak). */
  stale: boolean;
}

/** Qurilish jarayonida — jonli hisob uchun tez-tez so'raladi (fonda ham:
 *  §12 saboqi — tab fonga o'tganda holat "qotib" qolardi). */
export function usePodcast(topicId: number) {
  return useQuery({
    queryKey: ["podcast", topicId],
    queryFn: () => api<PodcastState | null>(`/api/v1/topics/${topicId}/podcast`),
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s && s !== "done" && s !== "error" ? 5000 : false;
    },
    refetchIntervalInBackground: true,
  });
}

export function useGeneratePodcast(topicId: number) {
  const qc = useQueryClient();
  return useMutation({
    meta: { silent: true }, // xato kartaning o'zida ko'rsatiladi
    mutationFn: (body?: { rebuild?: boolean }) =>
      api<PodcastState>(`/api/v1/topics/${topicId}/podcast/generate`, { method: "POST", body: JSON.stringify(body ?? {}) }),
    onSuccess: (data) => qc.setQueryData(["podcast", topicId], data),
  });
}

// ---- Content generation & editing ----

export function useGenerateQuiz(topicId: number) {
  const qc = useQueryClient();
  return useMutation({
    // Xato chaqiruv joyida ko'rsatiladi - global toast takrorlamasin.
    meta: { silent: true },
    mutationFn: (body: { language: "uz" | "ru"; questionCount: number; difficulty: string }) =>
      api<ContentFull>(`/api/v1/topics/${topicId}/generate/quiz`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["topic", topicId] }),
  });
}

export function useGenerateCase(topicId: number) {
  const qc = useQueryClient();
  return useMutation({
    // Xato chaqiruv joyida ko'rsatiladi - global toast takrorlamasin.
    meta: { silent: true },
    mutationFn: (body: { language: "uz" | "ru"; format: "SHORT" | "EXTENDED" }) =>
      api<ContentFull>(`/api/v1/topics/${topicId}/generate/case`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["topic", topicId] }),
  });
}

export function useContent(id: number) {
  return useQuery({
    queryKey: ["content", id],
    queryFn: () => api<ContentFull>(`/api/v1/content/${id}`),
    // Poll while presentation images or a video build are still in progress.
    refetchInterval: (query) => {
      const data = query.state.data as ContentFull | undefined;
      const imgBusy = data?.presentation?.slides.some((s) =>
        s.imageSlots.some((slot) => slot.status === "PENDING" || slot.status === "PROCESSING")
      );
      const vidBusy =
        data?.video && ["pending", "script", "tts", "render"].includes(data.video.buildStatus);
      return imgBusy || vidBusy ? 2000 : false;
    },
    // ⚠️ Montaj 10–20 daqiqa davom etadi — o'qituvchi tabni fonda qoldiradi.
    // Sukut bo'yicha react-query fon tabda so'rovni TO'XTATADI, shuning uchun
    // holat qotib qolardi (jarayon o'lganda ham "Ovoz yaratilmoqda…" turardi).
    refetchIntervalInBackground: true,
  });
}

/** ⚠️ 2026-07-29: bu yerda ilgari `import.meta.env.VITE_API_URL` TO'G'RIDAN
 *  ishlatilardi — ya'ni Vercel'da so'rovlar `*.onrender.com` ga TO'G'RIDAN
 *  ketardi va `lib/api.ts::resolveApiUrl()` dagi same-origin rewrite'ni CHETLAB
 *  o'tardi. Natijada login cookie'si (vercel.app domeni uchun) yuborilmasdi va
 *  o'qituvchining fayl yuklashi/media so'rovlari **401** bilan jimgina yiqilardi.
 *  Endi butun ilova bitta bazaviy manzildan foydalanadi. */
export const API_BASE = API_URL;

export function useGeneratePresentation(topicId: number) {
  const qc = useQueryClient();
  return useMutation({
    // Xato chaqiruv joyida ko'rsatiladi - global toast takrorlamasin.
    meta: { silent: true },
    mutationFn: (body: { language: "uz" | "ru" }) =>
      api<ContentFull>(`/api/v1/topics/${topicId}/generate/presentation`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["topic", topicId] }),
  });
}

export function useGenerateImages(presentationId: number) {
  const qc = useQueryClient();
  return useMutation({
    // 3A: slideIds bo'lsa faqat tanlanganlarga; bo'sh/berilmasa hammasi.
    mutationFn: (slideIds?: string[]) =>
      api(`/api/v1/presentations/${presentationId}/generate-images`, {
        method: "POST",
        body: JSON.stringify({ slideIds: slideIds ?? [] }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["content"] }),
  });
}

export function useRegenerateImage(presentationId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slideIndex, slotIndex }: { slideIndex: number; slotIndex: number }) =>
      api(`/api/v1/presentations/${presentationId}/regenerate-image/${slideIndex}/${slotIndex}`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["content"] }),
  });
}

// ---- "Hammasini yarat" (bitta bosish → server ketma-ket yaratadi) ----

export type BatchKind = "quiz" | "case" | "presentation" | "audio" | "video";
export interface BatchStatus {
  running: boolean;
  /** `background` — qadam faqat boshlandi (video montaji fonda davom etadi). */
  steps: { kind: BatchKind; state: "queued" | "running" | "done" | "error"; error?: string; background?: boolean }[];
}

export function useGenerateAll(topicId: number) {
  const qc = useQueryClient();
  return useMutation({
    // Xato shu kartada ko'rsatiladi — global toast takrorlamasin.
    meta: { silent: true },
    mutationFn: (body: { language: "uz" | "ru"; kinds: BatchKind[]; questionCount?: number }) =>
      api<BatchStatus>(`/api/v1/topics/${topicId}/generate/all`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (s) => qc.setQueryData(["batch", topicId], s),
  });
}

/** Jonli progress. Generatsiya ketayotganда 2s da so'raladi — fon tabда ham
 *  (o'qituvchi boshqa ishga o'tsa ham holat qotib qolmasin). */
export function useBatchStatus(topicId: number, enabled: boolean) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ["batch", topicId],
    queryFn: async () => {
      const s = await api<BatchStatus>(`/api/v1/topics/${topicId}/generate/status`);
      // Tur tugaganда mavzu tafsiloti yangilansin (kartalar "Tayyor" bo'lsin).
      qc.invalidateQueries({ queryKey: ["topic", topicId] });
      return s;
    },
    enabled,
    refetchInterval: (q) => ((q.state.data as BatchStatus | undefined)?.running ? 2000 : false),
    refetchIntervalInBackground: true,
  });
}

export function useGenerateVideo(topicId: number) {
  const qc = useQueryClient();
  return useMutation({
    // Xato chaqiruv joyida ko'rsatiladi - global toast takrorlamasin.
    meta: { silent: true },
    mutationFn: (body: { language: "uz" | "ru"; voice: "male" | "female" }) =>
      api<ContentFull>(`/api/v1/topics/${topicId}/generate/video`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["topic", topicId] }),
  });
}

export function useRebuildVideo(videoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api(`/api/v1/videos/${videoId}/rebuild`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["content"] }),
  });
}

/** Uzilib qolgan montajni davom ettirish — ovozlangan segmentlar qayta
 *  ishlatiladi (noldan boshlamaydi, qayta to'lov yo'q). */
export function useResumeVideo(videoId: number) {
  const qc = useQueryClient();
  return useMutation({
    meta: { silent: true },
    mutationFn: () => api(`/api/v1/videos/${videoId}/resume`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["content"] }),
  });
}

// ---- Publish (per content) ----

export function usePublishContent(topicId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (contentId: number) => api(`/api/v1/content/${contentId}/publish`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["topic", topicId] }),
  });
}

// ---- Unlock rule (topic override) ----

export function useSetTopicUnlockRule(topicId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (unlockRuleJson: UnlockRule | null) =>
      api(`/api/v1/topics/${topicId}/unlock-rule`, { method: "PUT", body: JSON.stringify({ unlockRuleJson }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["topic", topicId] }),
  });
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
