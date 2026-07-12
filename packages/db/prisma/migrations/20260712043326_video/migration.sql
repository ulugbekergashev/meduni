-- CreateEnum
CREATE TYPE "VideoBuildStatus" AS ENUM ('PENDING', 'SCRIPT', 'TTS', 'RENDER', 'DONE', 'ERROR');

-- CreateTable
CREATE TABLE "videos" (
    "id" SERIAL NOT NULL,
    "contentItemId" INTEGER NOT NULL,
    "scriptJson" JSONB NOT NULL,
    "audioUrl" TEXT,
    "mp4Url" TEXT,
    "srtUrl" TEXT,
    "durationSec" INTEGER,
    "voiceId" TEXT,
    "language" "Locale" NOT NULL,
    "buildStatus" "VideoBuildStatus" NOT NULL DEFAULT 'PENDING',
    "errorStage" TEXT,

    CONSTRAINT "videos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "videos_contentItemId_key" ON "videos"("contentItemId");

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "content_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
