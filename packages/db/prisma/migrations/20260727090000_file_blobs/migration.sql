-- Doimiy fayl saqlash: Render Free'da disk vaqtinchalik (konteyner restartida
-- `/app/storage` bo'shaydi), shuning uchun prod'da fayllar bazada yashaydi.
-- `path` — eski disk yo'li bilan aynan bir xil, mavjud url qiymatlari ishlayveradi.
CREATE TABLE "file_blobs" (
    "path" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "mimeType" TEXT,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "file_blobs_pkey" PRIMARY KEY ("path")
);
