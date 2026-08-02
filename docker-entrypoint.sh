#!/bin/sh
# Konteyner boshlanishi: bazani sinxronla → (ixtiyoriy) demo seed → API.
set -e

echo "==> Bazani kutish + sinxronlash (prisma db push)..."
cd /app/packages/db
i=0
until npx prisma db push --skip-generate; do
  i=$((i+1))
  if [ "$i" -ge 10 ]; then
    # ⚠️ 2026-08-02 (jonli sayt ~3 soat o'lik turdi): bu yerda `exit 1` bor edi.
    # `db push` FAQAT baza uzilganda emas, SXEMA NOMUVOFIQLIGIDA ham yiqiladi —
    # masalan bazada kod hali bilmaydigan jadval bo'lsa, push uni O'CHIRMOQCHI
    # bo'ladi va Prisma rad etadi (--accept-data-loss yo'q). O'shanda konteyner
    # har uyg'onishda status 1 bilan o'lardi va BUTUN sayt ishlamasdi.
    #
    # Endi push muvaffaqiyatsiz bo'lsa ham API KO'TARILADI: sayt ochiladi,
    # login ishlaydi, faqat yangi jadvalga tegadigan joy xato beradi. Bu —
    # to'liq uzilishdan ko'ra ancha yaxshi. Sabab logda ko'rinib turadi.
    echo "!! prisma db push muvaffaqiyatsiz ($i urinish) — API baribir ko'tariladi"
    echo "!! (sabab yuqorida: baza uzilgan YOKI sxema mos emas — deploy'ni yangilang)"
    break
  fi
  echo "   baza hali tayyor emas / sxema mos emas, qayta urinish $i..."
  sleep 2
done

cd /app
# ⚠️ Seed FAQAT bo'sh bazada ishlaydi. Ilgari u HAR ishga tushishда qayta
# ishlardi: bepul tarifda konteyner uyqudan uyg'onganda ~30 soniya qo'shimcha
# kutish va bazaga keraksiz yuk (demo ma'lumoti allaqachon joyida).
if [ "$DEMO_SEED" = "1" ]; then
  echo "==> Birlamchi foydalanuvchilar (prisma seed)..."
  npx tsx packages/db/prisma/seed.ts || echo "   (birlamchi seed o'tkazib yuborildi)"
  if [ "$DEMO_RESTORE" = "1" ]; then
    echo "==> Demo data (demoRestore)..."
    npx tsx apps/api/src/scripts/demoRestore.ts || echo "   (demoRestore o'tkazib yuborildi)"
  else
    echo "==> demoRestore o'tkazib yuborildi (DEMO_RESTORE=1 bo'lsa ishlaydi)"
  fi
fi

echo "==> API ishga tushmoqda (:$PORT, web bilan)..."
cd /app/apps/api
exec npx tsx src/index.ts
