// Kurs guruh chati (Modul 25) — kurs o'qituvchisi + shu kursga yozilgan
// talabalar real vaqtda (polling) muloqot qiladi. Dars ichidagi AI-tutor
// chatdan butunlay alohida: bu odamlar orasidagi muloqot.
//
// Kirish qoidasi:
//   · talaba  — kursga ACTIVE enrollment bo'lsa;
//   · o'qituvchi — kursning biriktirilgan o'qituvchisi bo'lsa (course.teacherId).
import { prisma } from "../../lib/prisma";
import { ApiError, badRequest, notFound } from "../../lib/errors";

const MAX_LEN = 2000;
/** Bitta so'rovda qaytariladigan oxirgi xabarlar chegarasi (polling arzon bo'lsin). */
const PAGE = 200;

export interface ChatMessageOut {
  id: number;
  text: string;
  authorId: number;
  authorName: string;
  role: "teacher" | "student";
  mine: boolean;
  createdAt: Date;
}

async function assertStudentEnrolled(studentId: number, courseId: number) {
  const en = await prisma.enrollment.findFirst({
    where: { studentId, courseId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!en) throw new ApiError(403, "not_enrolled", "Bu kursga yozilmagansiz", "Вы не записаны на этот курс");
}

async function assertTeacherOwns(teacherId: number, courseId: number) {
  const c = await prisma.course.findFirst({ where: { id: courseId, teacherId }, select: { id: true } });
  if (!c) throw new ApiError(403, "not_your_course", "Bu sizning kursingiz emas", "Это не ваш курс");
}

/** Xabarlar (oxirgi PAGE tasi, eskidan yangiga). `after` — faqat yangi xabarlar
 *  (inkremental polling). */
async function listMessages(courseId: number, meId: number, after?: number): Promise<ChatMessageOut[]> {
  const rows = await prisma.courseChatMessage.findMany({
    where: { courseId, ...(after ? { id: { gt: after } } : {}) },
    orderBy: { id: after ? "asc" : "desc" },
    take: PAGE,
    include: { author: { select: { id: true, fullName: true, role: true } } },
  });
  // `after` bo'lmasa desc olib, ekranga to'g'ri tartibda (asc) qaytaramiz.
  const ordered = after ? rows : rows.reverse();
  return ordered.map((m) => ({
    id: m.id,
    text: m.text,
    authorId: m.authorId,
    authorName: m.author.fullName,
    role: m.author.role === "TEACHER" ? "teacher" : "student",
    mine: m.authorId === meId,
    createdAt: m.createdAt,
  }));
}

async function createMessage(courseId: number, authorId: number, text: string): Promise<ChatMessageOut> {
  const clean = (text ?? "").trim();
  if (!clean) throw badRequest("Xabar bo'sh", "Сообщение пустое");
  if (clean.length > MAX_LEN) throw badRequest("Xabar juda uzun", "Сообщение слишком длинное");
  const m = await prisma.courseChatMessage.create({
    data: { courseId, authorId, text: clean },
    include: { author: { select: { id: true, fullName: true, role: true } } },
  });
  return {
    id: m.id,
    text: m.text,
    authorId: m.authorId,
    authorName: m.author.fullName,
    role: m.author.role === "TEACHER" ? "teacher" : "student",
    mine: true,
    createdAt: m.createdAt,
  };
}

// ---------- Talaba ----------
export async function getStudentChat(studentId: number, courseId: number, after?: number) {
  await assertStudentEnrolled(studentId, courseId);
  return { messages: await listMessages(courseId, studentId, after) };
}
export async function postStudentChat(studentId: number, courseId: number, text: string) {
  await assertStudentEnrolled(studentId, courseId);
  return createMessage(courseId, studentId, text);
}

// ---------- O'qituvchi ----------
export async function getTeacherChat(teacherId: number, courseId: number, after?: number) {
  await assertTeacherOwns(teacherId, courseId);
  return { messages: await listMessages(courseId, teacherId, after) };
}
export async function postTeacherChat(teacherId: number, courseId: number, text: string) {
  await assertTeacherOwns(teacherId, courseId);
  return createMessage(courseId, teacherId, text);
}

/** Kurs meta (chat shapkasi uchun — nom, ishtirokchilar soni). */
export async function chatCourseMeta(courseId: number) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      subject: { select: { name: true } },
      teacher: { select: { fullName: true } },
      _count: { select: { enrollments: { where: { status: "ACTIVE" } } } },
    },
  });
  if (!course) throw notFound("Kurs");
  return {
    courseId,
    name: course.subject.name,
    teacherName: course.teacher.fullName,
    memberCount: course._count.enrollments + 1, // + o'qituvchi
  };
}
