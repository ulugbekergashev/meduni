-- CreateEnum
CREATE TYPE "ContentKind" AS ENUM ('QUIZ', 'CASE', 'PRESENTATION', 'VIDEO');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('RECALL', 'UNDERSTAND', 'APPLY');

-- CreateEnum
CREATE TYPE "CaseFormat" AS ENUM ('SHORT', 'EXTENDED');

-- CreateTable
CREATE TABLE "content_items" (
    "id" SERIAL NOT NULL,
    "topicId" INTEGER NOT NULL,
    "kind" "ContentKind" NOT NULL,
    "language" "Locale" NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedById" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "reviewOpenedAt" TIMESTAMP(3),
    "editedByTeacher" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quizzes" (
    "id" SERIAL NOT NULL,
    "contentItemId" INTEGER NOT NULL,
    "passThreshold" INTEGER NOT NULL DEFAULT 70,
    "maxAttempts" INTEGER NOT NULL DEFAULT 1,
    "settingsJson" JSONB,

    CONSTRAINT "quizzes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" SERIAL NOT NULL,
    "quizId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "optionsJson" JSONB NOT NULL,
    "correctIndex" INTEGER NOT NULL,
    "explanationJson" JSONB NOT NULL,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'RECALL',
    "sourceFragment" TEXT,
    "orderIndex" INTEGER NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_cases" (
    "id" SERIAL NOT NULL,
    "contentItemId" INTEGER NOT NULL,
    "caseJson" JSONB NOT NULL,
    "format" "CaseFormat" NOT NULL DEFAULT 'SHORT',

    CONSTRAINT "clinical_cases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "content_items_topicId_kind_key" ON "content_items"("topicId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "quizzes_contentItemId_key" ON "quizzes"("contentItemId");

-- CreateIndex
CREATE UNIQUE INDEX "clinical_cases_contentItemId_key" ON "clinical_cases"("contentItemId");

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "content_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "quizzes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_cases" ADD CONSTRAINT "clinical_cases_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "content_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
