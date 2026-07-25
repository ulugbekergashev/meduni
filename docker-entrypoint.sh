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
if [ "$DEMO_SEED" = "1" ]; then
  echo "==> Demo data (login akkauntlar)..."
  npx tsx apps/api/src/scripts/demoRestore.ts || echo "   (seed o'tkazib yuborildi)"
fi

echo "==> API ishga tushmoqda (:$PORT, web bilan)..."
cd /app/apps/api
exec npx tsx src/index.ts
