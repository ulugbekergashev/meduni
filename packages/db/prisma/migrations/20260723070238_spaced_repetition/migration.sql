-- AlterTable
ALTER TABLE "flashcard_reviews" ADD COLUMN     "dueAt" TIMESTAMP(3),
ADD COLUMN     "intervalDays" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "flashcard_reviews_studentId_dueAt_idx" ON "flashcard_reviews"("studentId", "dueAt");
