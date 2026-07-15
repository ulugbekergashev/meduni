-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'SUPERADMIN';
ALTER TYPE "Role" ADD VALUE 'FACULTY_ADMIN';
ALTER TYPE "Role" ADD VALUE 'DEPT_ADMIN';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "adminDepartmentId" INTEGER,
ADD COLUMN     "facultyId" INTEGER;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "faculties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_adminDepartmentId_fkey" FOREIGN KEY ("adminDepartmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
