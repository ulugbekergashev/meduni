-- Cleanup (design overhaul Faza 1B): dead tables + deprecated ADMIN enum value.

-- 1. Dead tables — code stopped using them in Modul 19 (glossary) / Modul 20 (templates).
DROP TABLE IF EXISTS "glossary";
DROP TABLE IF EXISTS "presentation_templates";
ALTER TABLE "presentations" DROP COLUMN IF EXISTS "templateId";

-- 2. Remove deprecated ADMIN from the Role enum (Postgres has no DROP VALUE —
--    swap the type). Any leftover ADMIN rows become SUPERADMIN first.
UPDATE "users" SET "role" = 'SUPERADMIN' WHERE "role" = 'ADMIN';
ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('SUPERADMIN', 'FACULTY_ADMIN', 'DEPT_ADMIN', 'TEACHER', 'STUDENT');
ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role" USING ("role"::text::"Role");
DROP TYPE "Role_old";
