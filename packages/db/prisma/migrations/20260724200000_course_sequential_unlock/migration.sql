-- Ochilish sharti: ketma-ketlik (mustaqil flag; jadval bilan birga ishlaydi).
ALTER TABLE "courses" ADD COLUMN     "sequentialUnlock" BOOLEAN NOT NULL DEFAULT true;
