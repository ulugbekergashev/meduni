-- Честность оценивания: очный режим, снимок варианта, привязка устройства, телеметрия
ALTER TABLE "quizzes" ADD COLUMN IF NOT EXISTS "requiresPresence" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "learning_policies" ADD COLUMN IF NOT EXISTS "requirePresence" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "quiz_attempts" ADD COLUMN IF NOT EXISTS "orderJson" JSONB;
ALTER TABLE "quiz_attempts" ADD COLUMN IF NOT EXISTS "deviceHash" TEXT;
ALTER TABLE "quiz_attempts" ADD COLUMN IF NOT EXISTS "integrityJson" JSONB;
