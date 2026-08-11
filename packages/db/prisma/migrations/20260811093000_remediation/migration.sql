-- Доказательство разбора ошибок (условие пересдачи)
CREATE TABLE IF NOT EXISTS "remediation_answers" (
  "id" SERIAL PRIMARY KEY,
  "studentId" INTEGER NOT NULL,
  "attemptId" INTEGER NOT NULL,
  "questionId" INTEGER NOT NULL,
  "selectedIndex" INTEGER NOT NULL,
  "correct" BOOLEAN NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "remediation_answers_studentId_attemptId_idx" ON "remediation_answers"("studentId", "attemptId");
ALTER TABLE "remediation_answers" DROP CONSTRAINT IF EXISTS "remediation_answers_studentId_fkey";
ALTER TABLE "remediation_answers" ADD CONSTRAINT "remediation_answers_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
