#!/bin/sh
# Avtomatik deploy (universitet serveri): GitHub `main` da yangi commit bo'lsa —
# tortadi va qayta quradi. Cron har 5 daqiqada ishga tushiradi:
#
#   */5 * * * * sh /opt/meduni/scripts/auto-deploy.sh >> $HOME/meduni-deploy.log 2>&1
#
# Nega "pull" (server o'zi so'raydi), "push" emas: serverga tashqaridan SSH yopiq,
# GitHub Actions unga yeta olmaydi. Server esa GitHub'ga chiqa oladi.
#
# Xavfsizlik to'siqlari:
#  - flock: oldingi qurilish tugamagan bo'lsa ikkinchisi boshlanmaydi.
#  - --ff-only: serverda qo'lda o'zgartirilgan fayl bo'lsa birlashtirmaydi, to'xtaydi
#    (logda ko'rinadi) — hech narsani ustidan yozmaydi. `.env` git'da yo'q, tegilmaydi.
#  - Build yiqilsa `docker compose up` eski konteynerni almashtirmaydi — sayt eski
#    versiyada ishlab turaveradi.
set -eu

REPO_DIR="${MEDUNI_DIR:-/opt/meduni}"
COMPOSE_FILE="docker-compose.deploy.yml"
LOCK_FILE="/tmp/meduni-deploy.lock"

cd "$REPO_DIR"

exec 9>"$LOCK_FILE"
flock -n 9 || exit 0

git fetch -q origin main
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)
[ "$LOCAL" = "$REMOTE" ] && exit 0

echo "$(date '+%F %T') deploy boshlandi: $(git rev-parse --short HEAD) -> $(git rev-parse --short origin/main)"
git merge --ff-only -q origin/main
docker compose -f "$COMPOSE_FILE" up -d --build
# Har qurilishdan keyin eski (nomsiz) image'lar qoladi — disk to'lmasin.
docker image prune -f >/dev/null 2>&1 || true
echo "$(date '+%F %T') deploy tugadi: $(git log -1 --format='%h %s')"
