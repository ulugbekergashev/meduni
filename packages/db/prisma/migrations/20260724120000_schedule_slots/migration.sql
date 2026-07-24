-- Haftalik takroriy jadval: kurs har hafta shu kun+vaqtda o'tiladi. O'qituvchi
-- bir marta sozlaydi — darslar avtomatik hosil bo'ladi (qo'lda yaratilmaydi).
CREATE TABLE "schedule_slots" (
    "id" SERIAL NOT NULL,
    "courseId" INTEGER NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "room" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "schedule_slots_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "schedule_slots_courseId_idx" ON "schedule_slots"("courseId");
-- AddForeignKey
ALTER TABLE "schedule_slots" ADD CONSTRAINT "schedule_slots_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
