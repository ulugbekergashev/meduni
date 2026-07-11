-- CreateTable
CREATE TABLE "topic_digests" (
    "id" SERIAL NOT NULL,
    "topicId" INTEGER NOT NULL,
    "digestJson" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "approvedByTeacher" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "topic_digests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage" (
    "id" SERIAL NOT NULL,
    "kind" TEXT NOT NULL,
    "topicId" INTEGER,
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "topic_digests_topicId_key" ON "topic_digests"("topicId");

-- AddForeignKey
ALTER TABLE "topic_digests" ADD CONSTRAINT "topic_digests_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
