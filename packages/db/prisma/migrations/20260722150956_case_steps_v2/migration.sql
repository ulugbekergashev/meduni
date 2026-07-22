-- AlterTable
ALTER TABLE "case_attempts" ADD COLUMN     "autoScore" INTEGER,
ADD COLUMN     "stepsJson" JSONB NOT NULL DEFAULT '{}';
