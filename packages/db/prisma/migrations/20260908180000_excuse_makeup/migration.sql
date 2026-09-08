-- Davomat 2.0 · F3 — SPRAVKA va OTRABOTKA.
--
-- Nima uchun: "Sababli" ilgari o'qituvchi popoverda bosadigan status edi — na
-- sabab, na hujjat, na tasdiqlovchi, na iz; propusk esa talaba uchun boshi berk
-- ko'cha edi (ko'radi, lekin hech narsa qila olmaydi). Endi:
--   propusk → ariza (spravka) → dekanat tasdiqlaydi → SABABLI
--   propusk → otrabotka (mavzu+test yoki kafedrada) → o'qituvchi qabul qiladi
-- Additiv migratsiya.

-- CreateEnum
CREATE TYPE "ExcuseStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MakeupKind" AS ENUM ('DIGITAL', 'IN_PERSON', 'WRITTEN');

-- CreateEnum
CREATE TYPE "MakeupStatus" AS ENUM ('REQUIRED', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'WAIVED');

-- AlterTable
ALTER TABLE "attendance" ADD COLUMN     "excuseRequestId" INTEGER;

-- AlterTable
ALTER TABLE "learning_policies" ADD COLUMN     "makeupClearsAbsence" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "excuse_requests" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "fromDate" TIMESTAMP(3) NOT NULL,
    "toDate" TIMESTAMP(3) NOT NULL,
    "reason" "AbsenceReason" NOT NULL,
    "note" TEXT,
    "documentUrl" TEXT,
    "status" "ExcuseStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "reviewComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "excuse_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "makeups" (
    "id" SERIAL NOT NULL,
    "attendanceId" INTEGER NOT NULL,
    "kind" "MakeupKind" NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" "MakeupStatus" NOT NULL DEFAULT 'REQUIRED',
    "evidenceAttemptId" INTEGER,
    "submittedAt" TIMESTAMP(3),
    "acceptedById" INTEGER,
    "acceptedAt" TIMESTAMP(3),
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "makeups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "excuse_requests_studentId_status_idx" ON "excuse_requests"("studentId", "status");

-- CreateIndex
CREATE INDEX "excuse_requests_status_createdAt_idx" ON "excuse_requests"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "makeups_attendanceId_key" ON "makeups"("attendanceId");

-- CreateIndex
CREATE INDEX "makeups_status_dueAt_idx" ON "makeups"("status", "dueAt");

-- AddForeignKey
ALTER TABLE "excuse_requests" ADD CONSTRAINT "excuse_requests_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "excuse_requests" ADD CONSTRAINT "excuse_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "makeups" ADD CONSTRAINT "makeups_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "attendance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "makeups" ADD CONSTRAINT "makeups_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_excuseRequestId_fkey" FOREIGN KEY ("excuseRequestId") REFERENCES "excuse_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

