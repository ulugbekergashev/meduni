-- Fan/kurs birlashuvi: alohida `Subject` modeli olib tashlandi, uning o'rnini
-- `Course` egalladi (kurs endi nom + kafedra + o'qituvchi + guruh + semestr +
-- mavzularni birga saqlaydi). Topic endi bevosita kursga tegishli.
--
-- ⚠️ Bu migratsiya MA'LUMOTNI SAQLAMAYDI (DROP+ADD). Pilotdan oldin, prod
-- ma'lumot yo'q paytida bajarilgan — bo'sh bazada xavfsiz. Agar ma'lumotli
-- bazaga qo'llansa, avval subject→course ko'chirish qo'lda yozilishi kerak.

-- DropForeignKey
ALTER TABLE "subjects" DROP CONSTRAINT "subjects_departmentId_fkey";

-- DropForeignKey
ALTER TABLE "courses" DROP CONSTRAINT "courses_subjectId_fkey";

-- DropForeignKey
ALTER TABLE "topics" DROP CONSTRAINT "topics_subjectId_fkey";

-- AlterTable
ALTER TABLE "courses" DROP COLUMN "subjectId",
ADD COLUMN     "departmentId" INTEGER NOT NULL,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "name" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "topics" DROP COLUMN "subjectId",
ADD COLUMN     "courseId" INTEGER NOT NULL;

-- DropTable
DROP TABLE "subjects";

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
