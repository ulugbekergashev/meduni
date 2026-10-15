#!/bin/sh
# BIR MARTALIK: avtomatik deployni yoqadi va hozirgi kodni darrov quradi.
# Serverga kirmasdan, kompyuterdan (PowerShell ham bo'ladi) bitta buyruq bilan:
#
#   ssh -i ~/.ssh/meduni_server -p 7773 ikp@<server> "cd /opt/meduni && git fetch -q origin main && git show origin/main:scripts/install-auto-deploy.sh | sh"
#
# Qurilish FONDA ketadi (nohup) — SSH ulanishi uzilsa ham to'xtamaydi.
# Keyin cron har 5 daqiqada `scripts/auto-deploy.sh` ni ishga tushiradi.
set -eu

DIR="${MEDUNI_DIR:-/opt/meduni}"
LOG="$HOME/meduni-deploy.log"
cd "$DIR"

git merge --ff-only -q origin/main

LINE="*/5 * * * * sh $DIR/scripts/auto-deploy.sh >> \$HOME/meduni-deploy.log 2>&1"
EXISTING=$(crontab -l 2>/dev/null | grep -v auto-deploy || true)
printf '%s\n%s\n' "$EXISTING" "$LINE" | sed '/^$/d' | crontab -
echo "Avtomatik yangilanish yoqildi:"
crontab -l | grep auto-deploy

echo "$(date '+%F %T') birinchi qurilish: $(git log -1 --format='%h %s')" >> "$LOG"
nohup docker compose -f docker-compose.deploy.yml up -d --build >> "$LOG" 2>&1 < /dev/null &
echo "Qurilish fonda boshlandi (~2-3 daqiqa). Jurnal: $LOG"
