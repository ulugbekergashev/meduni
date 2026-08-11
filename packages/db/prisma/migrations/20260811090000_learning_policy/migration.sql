-- КОРИДОР ПОЛИТИКИ + доказуемость оценок (2026-08-11).
-- Всё аддитивно: существующие данные не трогаются.

CREATE TYPE "PolicyLevel" AS ENUM ('UNIVERSITY', 'FACULTY', 'DEPARTMENT');

CREATE TABLE "learning_policies" (
  "id" SERIAL PRIMARY KEY,
  "level" "PolicyLevel" NOT NULL,
  "scopeId" INTEGER,
  "minQuizPassedPct" INTEGER NOT NULL DEFAULT 70,
  "minVideoWatchedPct" INTEGER NOT NULL DEFAULT 80,
  "requireAssessment" BOOLEAN NOT NULL DEFAULT true,
  "requireSequential" BOOLEAN NOT NULL DEFAULT true,
  "requireCase" BOOLEAN NOT NULL DEFAULT true,
  "requireCaseReviewed" BOOLEAN NOT NULL DEFAULT false,
  "minQuizAttempts" INTEGER NOT NULL DEFAULT 3,
  "maxQuizAttempts" INTEGER NOT NULL DEFAULT 5,
  "minAttemptGapHours" INTEGER NOT NULL DEFAULT 24,
  "requireRemediation" BOOLEAN NOT NULL DEFAULT true,
  "minMinutesPerQuestion" INTEGER NOT NULL DEFAULT 1,
  "allowManualUnlock" BOOLEAN NOT NULL DEFAULT true,
  "updatedById" INTEGER,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "learning_policies_level_scopeId_key" ON "learning_policies"("level", "scopeId");
ALTER TABLE "learning_policies" ADD CONSTRAINT "learning_policies_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Пауза между попытками теста
ALTER TABLE "quizzes" ADD COLUMN IF NOT EXISTS "attemptGapHours" INTEGER NOT NULL DEFAULT 0;

-- Вопрос выводится из оборота, а не удаляется (история оценок сохраняется)
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "retiredAt" TIMESTAMP(3);

-- Мотив ручного допуска
ALTER TABLE "progress" ADD COLUMN IF NOT EXISTS "overrideReason" TEXT;
ALTER TABLE "progress" ADD COLUMN IF NOT EXISTS "overrideNote" TEXT;

-- Университетская политика по умолчанию (её же правит ректорат)
INSERT INTO "learning_policies" ("level", "scopeId") VALUES ('UNIVERSITY', NULL)
ON CONFLICT DO NOTHING;
