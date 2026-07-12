-- AlterTable
ALTER TABLE "progress" ADD COLUMN     "overriddenAt" TIMESTAMP(3),
ADD COLUMN     "overriddenById" INTEGER;

-- AddForeignKey
ALTER TABLE "progress" ADD CONSTRAINT "progress_overriddenById_fkey" FOREIGN KEY ("overriddenById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
