-- Sikl (blok) davri: kurs guruhga qaysi sanalar oralig'ida o'tiladi.
ALTER TABLE "course_groups" ADD COLUMN     "cycleEnd" TIMESTAMP(3),
ADD COLUMN     "cycleStart" TIMESTAMP(3);
