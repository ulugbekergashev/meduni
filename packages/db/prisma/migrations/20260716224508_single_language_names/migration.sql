-- Single-language entity names (design overhaul Faza 1).
-- Hand-written RENAME instead of Prisma's DROP+ADD so existing data survives:
-- name takes the old nameUz value; nameRu is dropped.

-- Faculty
DROP INDEX "faculties_nameUz_key";
DROP INDEX "faculties_nameRu_key";
ALTER TABLE "faculties" RENAME COLUMN "nameUz" TO "name";
ALTER TABLE "faculties" DROP COLUMN "nameRu";
CREATE UNIQUE INDEX "faculties_name_key" ON "faculties"("name");

-- Department
DROP INDEX "departments_facultyId_nameUz_key";
DROP INDEX "departments_facultyId_nameRu_key";
ALTER TABLE "departments" RENAME COLUMN "nameUz" TO "name";
ALTER TABLE "departments" DROP COLUMN "nameRu";
CREATE UNIQUE INDEX "departments_facultyId_name_key" ON "departments"("facultyId", "name");

-- Subject
DROP INDEX "subjects_departmentId_nameUz_key";
DROP INDEX "subjects_departmentId_nameRu_key";
ALTER TABLE "subjects" RENAME COLUMN "nameUz" TO "name";
ALTER TABLE "subjects" DROP COLUMN "nameRu";
CREATE UNIQUE INDEX "subjects_departmentId_name_key" ON "subjects"("departmentId", "name");
