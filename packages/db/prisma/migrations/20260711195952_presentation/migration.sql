-- CreateTable
CREATE TABLE "presentations" (
    "id" SERIAL NOT NULL,
    "contentItemId" INTEGER NOT NULL,
    "slidesJson" JSONB NOT NULL,
    "pptxUrl" TEXT,
    "pdfUrl" TEXT,
    "templateId" INTEGER,

    CONSTRAINT "presentations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "presentations_contentItemId_key" ON "presentations"("contentItemId");

-- AddForeignKey
ALTER TABLE "presentations" ADD CONSTRAINT "presentations_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "content_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
