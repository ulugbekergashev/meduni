-- Topic title: single language (design overhaul Faza 1).
ALTER TABLE "topics" RENAME COLUMN "titleUz" TO "title";
ALTER TABLE "topics" DROP COLUMN "titleRu";
