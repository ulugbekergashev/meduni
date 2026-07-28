#!/bin/sh
# Konteyner boshlanishi: bazani sinxronla → (ixtiyoriy) demo seed → API.
set -e

echo "==> Bazani kutish + sinxronlash (prisma db push)..."
cd /app/packages/db
i=0
until npx prisma db push --skip-generate; do
  i=$((i+1))
  if [ "$i" -ge 30 ]; then echo "!! baza ulanmadi (30 urinish)"; exit 1; fi
  echo "   baza hali tayyor emas, qayta urinish $i..."
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
