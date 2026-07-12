-- CreateEnum
CREATE TYPE "FactcheckStatus" AS ENUM ('NONE', 'CHECKING', 'FLAGGED', 'CLEAN', 'RESOLVED');

-- AlterTable
ALTER TABLE "content_items" ADD COLUMN     "factcheckFlagsJson" JSONB,
ADD COLUMN     "factcheckStatus" "FactcheckStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "factcheckedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "defaultUnlockRuleJson" JSONB;

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "actorId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" INTEGER NOT NULL,
    "detailsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
