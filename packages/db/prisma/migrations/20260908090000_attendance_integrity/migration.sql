-- Davomat 2.0 · F0 — yo'qlama yaxlitligi.
--
-- 1) Dars IDENTIFIKATSIYASI: (kurs, guruh, aniq sana+vaqt) noyob bo'ladi.
--    Ilgari `lesson_sessions` da na unique, na bitta indeks bor edi — parallel
--    yo'qlamada `ensureSession` ikkita sessiya yaratardi va yo'qlama ikkiga
--    bo'linardi. Cheklovni qo'yishdan OLDIN mavjud dublikatlar birlashtiriladi.
-- 2) O'ZGARISH JURNALI (`attendance_changes`): belgi nimadan nimaga o'zgargani.
--    Retro-tuzatish endi izsiz emas.
-- ⚠️ Additiv: mavjud ustunlar o'zgarmaydi, ma'lumot yo'qolmaydi (faqat aynan
--    takrorlangan sessiyalar birlashtiriladi).

-- ---------- 1. Dublikat sessiyalarni birlashtirish ----------
-- Har (kurs, guruh, sana) guruhida ENG KO'P yo'qlamasi bor sessiya "asosiy"
-- deb olinadi (teng bo'lsa — eng kichik id).
CREATE TEMP TABLE _sess_dedup AS
SELECT s.id AS dup_id,
       first_value(s.id) OVER (
         PARTITION BY s."courseId", s."groupId", s."date"
         ORDER BY (SELECT count(*) FROM "attendance" a WHERE a."sessionId" = s.id) DESC, s.id ASC
       ) AS keep_id
FROM "lesson_sessions" s;

DELETE FROM _sess_dedup WHERE dup_id = keep_id;

-- Yo'qlamani asosiy sessiyaga ko'chiramiz — talabaning belgisi u yerda hali yo'q bo'lsa.
UPDATE "attendance" a
SET "sessionId" = d.keep_id
FROM _sess_dedup d
WHERE a."sessionId" = d.dup_id
  AND NOT EXISTS (
    SELECT 1 FROM "attendance" k WHERE k."sessionId" = d.keep_id AND k."studentId" = a."studentId"
  );

-- Qolgani (talaba asosiy sessiyada allaqachon belgilangan) — takror yozuv.
DELETE FROM "attendance" a USING _sess_dedup d WHERE a."sessionId" = d.dup_id;

DELETE FROM "lesson_sessions" s USING _sess_dedup d WHERE s.id = d.dup_id;

DROP TABLE _sess_dedup;

-- ---------- 2. Cheklov va indekslar ----------
-- ⚠️ Postgres: unique ichida NULL lar o'zaro teng emas — legacy `groupId IS NULL`
-- qatorlar cheklovga tushmaydi (ular eskirgan yo'l, F1 da yo'qoladi).
CREATE UNIQUE INDEX "lesson_sessions_courseId_groupId_date_key"
  ON "lesson_sessions" ("courseId", "groupId", "date");
CREATE INDEX "lesson_sessions_courseId_date_idx" ON "lesson_sessions" ("courseId", "date");
CREATE INDEX "lesson_sessions_groupId_date_idx" ON "lesson_sessions" ("groupId", "date");
CREATE INDEX "attendance_studentId_idx" ON "attendance" ("studentId");

-- ---------- 3. O'zgarish jurnali ----------
CREATE TABLE "attendance_changes" (
  "id" SERIAL NOT NULL,
  "attendanceId" INTEGER NOT NULL,
  "prevStatus" "AttendanceStatus",
  "newStatus" "AttendanceStatus" NOT NULL,
  "byId" INTEGER NOT NULL,
  "reason" TEXT,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attendance_changes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "attendance_changes_attendanceId_idx" ON "attendance_changes" ("attendanceId");
CREATE INDEX "attendance_changes_at_idx" ON "attendance_changes" ("at");

ALTER TABLE "attendance_changes"
  ADD CONSTRAINT "attendance_changes_attendanceId_fkey"
  FOREIGN KEY ("attendanceId") REFERENCES "attendance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attendance_changes"
  ADD CONSTRAINT "attendance_changes_byId_fkey"
  FOREIGN KEY ("byId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
