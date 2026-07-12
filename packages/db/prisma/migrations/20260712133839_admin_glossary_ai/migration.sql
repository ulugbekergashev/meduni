-- AlterTable
ALTER TABLE "ai_usage" ADD COLUMN     "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "departmentId" INTEGER,
ADD COLUMN     "images" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ttsChars" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "userId" INTEGER;

-- CreateTable
CREATE TABLE "glossary" (
    "id" SERIAL NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "termRu" TEXT NOT NULL,
    "termUz" TEXT NOT NULL,
    "termLat" TEXT,
    "approved" BOOLEAN NOT NULL DEFAULT true,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "glossary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presentation_templates" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "pptxMasterUrl" TEXT,
    "colorsJson" JSONB NOT NULL,
    "logoUrl" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "presentation_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_quotas" (
    "id" SERIAL NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "monthlyTokenLimit" INTEGER NOT NULL DEFAULT 0,
    "monthlyImageLimit" INTEGER NOT NULL DEFAULT 0,
    "monthlyCostLimit" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "ai_quotas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "glossary_departmentId_termRu_key" ON "glossary"("departmentId", "termRu");

-- CreateIndex
CREATE UNIQUE INDEX "ai_quotas_departmentId_key" ON "ai_quotas"("departmentId");

-- CreateIndex
CREATE INDEX "ai_usage_departmentId_createdAt_idx" ON "ai_usage"("departmentId", "createdAt");

-- AddForeignKey
ALTER TABLE "glossary" ADD CONSTRAINT "glossary_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "glossary" ADD CONSTRAINT "glossary_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_quotas" ADD CONSTRAINT "ai_quotas_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
