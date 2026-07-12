-- CreateEnum
CREATE TYPE "ProgressState" AS ENUM ('LOCKED', 'AVAILABLE', 'IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "progress" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "topicId" INTEGER NOT NULL,
    "state" "ProgressState" NOT NULL DEFAULT 'LOCKED',
    "videoWatchedPct" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "progress_studentId_topicId_key" ON "progress"("studentId", "topicId");

-- AddForeignKey
ALTER TABLE "progress" ADD CONSTRAINT "progress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress" ADD CONSTRAINT "progress_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
