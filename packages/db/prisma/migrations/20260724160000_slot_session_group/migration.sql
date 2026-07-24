-- Slot/sessiya guruh bo'yicha: bir kurs bir necha guruhga har xil jadvalda.
ALTER TABLE "schedule_slots" ADD COLUMN     "groupId" INTEGER;
ALTER TABLE "lesson_sessions" ADD COLUMN     "groupId" INTEGER;
