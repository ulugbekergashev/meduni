#!/bin/sh
# Yuklangan fayllar zaxirasi (materiallar, slayd rasmlari, video, podkast) — kunlik.
#
# ⚠️ NEGA KERAK (2026-10-17 tekshiruvi): /etc/cron.daily/meduni-backup faqat BAZANI
# (pg_dump) saqlaydi. Media esa `meduni_storage` volume'da (STORAGE_DRIVER=disk) va
# hech qayerga nusxalanmasdi — disk buzilsa baholar qolardi, o'qituvchilarning
# materiallari va AI yaratgan rasm/video esa yo'qolardi.
#
# Root huquqi SHART EMAS: foydalanuvchi docker guruhida bo'lsa yetarli.
# O'rnatish (bir marta, serverda yoki kompyuterdan ssh orqali):
#   (crontab -l 2>/dev/null | grep -v backup-storage; \
#    echo '30 6 * * * sh /opt/meduni/scripts/backup-storage.sh >> $HOME/meduni-backup.log 2>&1') | crontab -
set -eu

OUT="${MEDUNI_BACKUP_DIR:-$HOME/meduni-backups}"
VOLUME="${MEDUNI_STORAGE_VOLUME:-meduni_storage}"
KEEP_DAYS="${MEDUNI_BACKUP_KEEP_DAYS:-14}"

mkdir -p "$OUT"
STAMP=$(date +%F)
# Volume faqat O'QISH rejimida ulanadi — zaxira jarayoni fayllarni o'zgartira olmaydi.
docker run --rm -v "$VOLUME":/s:ro -v "$OUT":/b alpine tar czf "/b/storage-$STAMP.tgz" -C /s .
find "$OUT" -name 'storage-*.tgz' -mtime +"$KEEP_DAYS" -delete
echo "$(date '+%F %T') zaxira: $OUT/storage-$STAMP.tgz ($(du -h "$OUT/storage-$STAMP.tgz" | cut -f1))"
