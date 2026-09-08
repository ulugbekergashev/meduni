-- Davomat 2.0 · F1 — MODEL: kalendar, akademik soat, mashg'ulot turi, SIKL.
--
-- Additiv: mavjud ustunlar o'zgarmaydi, ma'lumot yo'qolmaydi. Eski yo'l ishlashda
-- davom etadi (slot.cycleId = null + CourseGroup.cycleStart/End — legacy fallback).
--
-- Nima uchun (2026-09-08 auditi va buyurtmachi talabi):
--  1) Nizom davomatni SOATDA hisoblaydi (VM №824: fan auditoriya soatining 25 %i
--     sababsiz qoldirilsa — yakuniy nazoratga kiritilmaydi; №393: semestrda 74
--     soatdan ortiq — chetlashtirish). Bazada esa na soat, na mashg'ulot turi bor edi.
--  2) "Sikl" — `CourseGroup` dagi ikki sana edi, ustiga unique(kurs, guruh):
--     bir guruh bir kursni UMRIDA BIR MARTA o'tishi mumkin edi. Takroriy sikl va
--     boshqa fakultetdan kelgan MEHMON guruh — buyurtmachining asosiy stsenariysi —
--     strukturaviy imkonsiz edi.
--  3) Semestr sanalari yo'qligi uchun darslar bayram va sessiya haftasida ham
--     hosil bo'lardi, "joriy semestr" esa satrni saralab taxmin qilinardi.
-- CreateEnum
CREATE TYPE "LessonType" AS ENUM ('LECTURE', 'PRACTICE', 'SEMINAR', 'LAB', 'CLINICAL');

-- CreateEnum
CREATE TYPE "LessonStatus" AS ENUM ('HELD', 'CANCELLED', 'MOVED');

-- CreateEnum
CREATE TYPE "CourseFormat" AS ENUM ('SEMESTER', 'CYCLE');

-- CreateEnum
CREATE TYPE "CycleStatus" AS ENUM ('PLANNED', 'ACTIVE', 'FINISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AbsenceReason" AS ENUM ('ILLNESS', 'FAMILY', 'OFFICIAL', 'COMPETITION', 'OTHER');

-- CreateEnum
CREATE TYPE "CalendarExceptionKind" AS ENUM ('HOLIDAY', 'NON_TEACHING', 'EXAM_WEEK');

-- CreateEnum
CREATE TYPE "MakeupScope" AS ENUM ('NONE', 'PRACTICE', 'ALL');

-- CreateEnum
CREATE TYPE "ExcuseApprover" AS ENUM ('TEACHER', 'DEANERY', 'BOTH');

-- AlterTable
ALTER TABLE "attendance" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "documentUrl" TEXT,
ADD COLUMN     "excusedAt" TIMESTAMP(3),
ADD COLUMN     "excusedById" INTEGER,
ADD COLUMN     "lateMinutes" INTEGER,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "reason" "AbsenceReason";

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "format" "CourseFormat" NOT NULL DEFAULT 'SEMESTER',
ADD COLUMN     "plannedHours" INTEGER;

-- AlterTable
ALTER TABLE "learning_policies" ADD COLUMN     "cycleMaxMissedDays" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "excuseApprover" "ExcuseApprover" NOT NULL DEFAULT 'DEANERY',
ADD COLUMN     "excuseDocDeadlineDays" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "lateCountsAsAbsentAfterMin" INTEGER NOT NULL DEFAULT 45,
ADD COLUMN     "lateThresholdMin" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "makeupDeadlineDays" INTEGER NOT NULL DEFAULT 14,
ADD COLUMN     "makeupRequiredFor" "MakeupScope" NOT NULL DEFAULT 'PRACTICE',
ADD COLUMN     "maxMissedHoursPerTerm" INTEGER NOT NULL DEFAULT 74,
ADD COLUMN     "maxUnexcusedPct" INTEGER NOT NULL DEFAULT 25,
ADD COLUMN     "warnUnexcusedPct" INTEGER NOT NULL DEFAULT 15;

-- AlterTable
ALTER TABLE "lesson_sessions" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cycleId" INTEGER,
ADD COLUMN     "hours" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "lessonType" "LessonType" NOT NULL DEFAULT 'PRACTICE',
ADD COLUMN     "slotId" INTEGER,
ADD COLUMN     "status" "LessonStatus" NOT NULL DEFAULT 'HELD',
ADD COLUMN     "teacherId" INTEGER;

-- AlterTable
ALTER TABLE "schedule_slots" ADD COLUMN     "cycleId" INTEGER,
ADD COLUMN     "endTime" TEXT,
ADD COLUMN     "hours" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "lessonType" "LessonType" NOT NULL DEFAULT 'PRACTICE';

-- CreateTable
CREATE TABLE "course_cycles" (
    "id" SERIAL NOT NULL,
    "courseId" INTEGER NOT NULL,
    "groupId" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "examDate" TIMESTAMP(3),
    "status" "CycleStatus" NOT NULL DEFAULT 'ACTIVE',
    "isGuest" BOOLEAN NOT NULL DEFAULT false,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic_terms" (
    "id" SERIAL NOT NULL,
    "academicYear" TEXT NOT NULL,
    "semester" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "academic_terms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_exceptions" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "kind" "CalendarExceptionKind" NOT NULL DEFAULT 'HOLIDAY',
    "facultyId" INTEGER,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "course_cycles_courseId_groupId_startDate_idx" ON "course_cycles"("courseId", "groupId", "startDate");

-- CreateIndex
CREATE INDEX "course_cycles_groupId_startDate_idx" ON "course_cycles"("groupId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "academic_terms_academicYear_semester_key" ON "academic_terms"("academicYear", "semester");

-- CreateIndex
CREATE INDEX "calendar_exceptions_date_idx" ON "calendar_exceptions"("date");

-- CreateIndex
CREATE INDEX "schedule_slots_cycleId_idx" ON "schedule_slots"("cycleId");

-- AddForeignKey
ALTER TABLE "course_cycles" ADD CONSTRAINT "course_cycles_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_cycles" ADD CONSTRAINT "course_cycles_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "student_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_cycles" ADD CONSTRAINT "course_cycles_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_exceptions" ADD CONSTRAINT "calendar_exceptions_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "faculties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_slots" ADD CONSTRAINT "schedule_slots_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "course_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_sessions" ADD CONSTRAINT "lesson_sessions_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "student_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_sessions" ADD CONSTRAINT "lesson_sessions_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_sessions" ADD CONSTRAINT "lesson_sessions_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "course_cycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_excusedById_fkey" FOREIGN KEY ("excusedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------- MA'LUMOTNI KO'CHIRISH (backfill) ----------

-- 1. Mavjud sikl oynalari (CourseGroup.cycleStart/End) → CourseCycle qatorlari.
--    Mehmonlik: guruh fakulteti kurs kafedrasi fakultetidan farq qilsa.
INSERT INTO "course_cycles" ("courseId", "groupId", "startDate", "endDate", "status", "isGuest", "createdAt")
SELECT cg."courseId",
       cg."groupId",
       cg."cycleStart",
       cg."cycleEnd",
       CASE WHEN cg."cycleEnd" < CURRENT_DATE THEN 'FINISHED'::"CycleStatus" ELSE 'ACTIVE'::"CycleStatus" END,
       (g."facultyId" IS DISTINCT FROM d."facultyId"),
       CURRENT_TIMESTAMP
FROM "course_groups" cg
JOIN "student_groups" g ON g.id = cg."groupId"
JOIN "courses" c ON c.id = cg."courseId"
JOIN "departments" d ON d.id = c."departmentId"
WHERE cg."cycleStart" IS NOT NULL AND cg."cycleEnd" IS NOT NULL;

-- 2. Sikl oynasi bor kurslar — CYCLE formatiga (mehmon guruh qabul qila oladi).
UPDATE "courses" SET "format" = 'CYCLE'
WHERE id IN (SELECT DISTINCT "courseId" FROM "course_cycles");

-- 3. Slotlarni o'z sikliga bog'laymiz (kurs+guruh bo'yicha eng so'nggi sikl).
UPDATE "schedule_slots" s
SET "cycleId" = (
  SELECT c2.id FROM "course_cycles" c2
  WHERE c2."courseId" = s."courseId" AND c2."groupId" = s."groupId"
  ORDER BY c2."startDate" DESC LIMIT 1
)
WHERE s."cycleId" IS NULL AND s."groupId" IS NOT NULL;

-- 4. Mavjud darslarni siklga bog'laymiz (sana oynasiga tushsa).
UPDATE "lesson_sessions" ls
SET "cycleId" = cc.id
FROM "course_cycles" cc
WHERE ls."cycleId" IS NULL
  AND ls."groupId" = cc."groupId"
  AND ls."courseId" = cc."courseId"
  AND ls."date" >= cc."startDate"
  AND ls."date" < cc."endDate" + INTERVAL '1 day';

-- ⚠️ Soat va tur: default 2 soat / PRACTICE. Haqiqiy qiymatlarni o'qituvchi jadval
-- sozlashda kiritadi (F2); `courses.plannedHours` (25 % maxraji) — o'quv rejasidan,
-- kiritilmasa hosil qilingan darslar soatlari yig'indisi ishlatiladi.
