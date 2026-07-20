-- Modul 20 Faza 3: kafedra-markazlashgan kontent.
-- Topic endi kursga emas, FANGA tegishli. Data saqlanadi:
--   subjectId = eski kursning subjectId'si; bir fanga bir necha kursdan
--   mavzu kelsa (courseId, orderIndex) tartibida birlashtirilib qayta indekslanadi.

ALTER TABLE "topics" ADD COLUMN "subjectId" INTEGER;

UPDATE "topics" t
SET "subjectId" = c."subjectId"
FROM "courses" c
WHERE t."courseId" = c."id";

-- Merge: har fan ichida ketma-ket 0..N-1 qayta indekslash (kurslar tartibida).
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY "subjectId"
    ORDER BY "courseId" ASC, "orderIndex" ASC, id ASC
  ) - 1 AS rn
  FROM "topics"
)
UPDATE "topics" t
SET "orderIndex" = r.rn
FROM ranked r
WHERE t.id = r.id;

ALTER TABLE "topics" ALTER COLUMN "subjectId" SET NOT NULL;

ALTER TABLE "topics" DROP CONSTRAINT "topics_courseId_fkey";
ALTER TABLE "topics" DROP COLUMN "courseId";

ALTER TABLE "topics" ADD CONSTRAINT "topics_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "topics_subjectId_idx" ON "topics"("subjectId");
