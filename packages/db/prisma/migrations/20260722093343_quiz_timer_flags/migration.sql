-- AlterTable
ALTER TABLE "quiz_attempts" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "flaggedJson" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "quizzes" ADD COLUMN     "timeLimitMin" INTEGER NOT NULL DEFAULT 0;
