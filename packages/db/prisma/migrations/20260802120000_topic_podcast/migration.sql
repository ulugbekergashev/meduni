-- Audio-podkast (~20 daqiqa) — mavzuni to'liq ochadigan ikki ovozli suhbat.
-- Additive: mavjud ma'lumotga tegmaydi.
CREATE TABLE "topic_podcasts" (
    "id" SERIAL NOT NULL,
    "topicId" INTEGER NOT NULL,
    "digestVersion" INTEGER NOT NULL DEFAULT 1,
    "language" "Locale" NOT NULL DEFAULT 'uz',
    "scriptJson" JSONB NOT NULL,
    "audioUrl" TEXT,
    "durationSec" INTEGER,
    "buildStatus" "VideoBuildStatus" NOT NULL DEFAULT 'PENDING',
    "errorStage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "topic_podcasts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "topic_podcasts_topicId_key" ON "topic_podcasts"("topicId");

ALTER TABLE "topic_podcasts" ADD CONSTRAINT "topic_podcasts_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
