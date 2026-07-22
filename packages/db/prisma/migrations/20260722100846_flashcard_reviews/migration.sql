-- CreateTable
CREATE TABLE "flashcard_reviews" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "topicId" INTEGER NOT NULL,
    "cardKey" TEXT NOT NULL,
    "known" BOOLEAN NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flashcard_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "flashcard_reviews_studentId_topicId_idx" ON "flashcard_reviews"("studentId", "topicId");

-- CreateIndex
CREATE UNIQUE INDEX "flashcard_reviews_studentId_topicId_cardKey_key" ON "flashcard_reviews"("studentId", "topicId", "cardKey");

-- AddForeignKey
ALTER TABLE "flashcard_reviews" ADD CONSTRAINT "flashcard_reviews_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flashcard_reviews" ADD CONSTRAINT "flashcard_reviews_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
