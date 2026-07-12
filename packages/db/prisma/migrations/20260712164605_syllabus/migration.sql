-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "syllabusJson" JSONB;

-- AlterTable
ALTER TABLE "topics" ADD COLUMN     "hours" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "syllabusNote" TEXT;
