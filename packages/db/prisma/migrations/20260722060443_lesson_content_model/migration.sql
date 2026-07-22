-- DropIndex
DROP INDEX "topics_subjectId_idx";

-- AlterTable
ALTER TABLE "source_materials" ADD COLUMN     "pageCount" INTEGER,
ADD COLUMN     "sizeBytes" INTEGER;

-- CreateTable
CREATE TABLE "topic_links" (
    "id" SERIAL NOT NULL,
    "topicId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "note" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "topic_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "section_reads" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "topicId" INTEGER NOT NULL,
    "sectionIndex" INTEGER NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "section_reads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "topic_links_topicId_idx" ON "topic_links"("topicId");

-- CreateIndex
CREATE INDEX "section_reads_studentId_topicId_idx" ON "section_reads"("studentId", "topicId");

-- CreateIndex
CREATE UNIQUE INDEX "section_reads_studentId_topicId_sectionIndex_key" ON "section_reads"("studentId", "topicId", "sectionIndex");

-- AddForeignKey
ALTER TABLE "topic_links" ADD CONSTRAINT "topic_links_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_reads" ADD CONSTRAINT "section_reads_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_reads" ADD CONSTRAINT "section_reads_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
