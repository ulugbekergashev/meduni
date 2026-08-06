-- Virtual bemor: buyurilgan tekshiruvning "ko'rsatma bormi" hukmi va narxi
-- BUYURILGAN paytda yozib qo'yiladi (jonli ball shundan hisoblanadi).
-- Qo'shimcha (additive), nullable — eski yozuvlar buzilmaydi.
ALTER TABLE "patient_messages" ADD COLUMN IF NOT EXISTS "metaJson" JSONB;
