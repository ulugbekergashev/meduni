-- Sana-rejimi: kurs `scheduleUnlock` yoniq bo'lsa mavzular ketma-ketlik-tugatish
-- emas, DARS JADVALI bo'yicha (mavzuning oxirgi dars kunidan keyin) ochiladi.
ALTER TABLE "courses" ADD COLUMN     "scheduleUnlock" BOOLEAN NOT NULL DEFAULT false;
