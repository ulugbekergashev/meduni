# MedUni — universitet serveriga o'rnatish

Bitta mashina, hamma narsa Docker ichida: platforma, PostgreSQL, video montaji.
Alohida PostgreSQL, Node.js yoki ffmpeg o'rnatish **kerak emas**.

> Bulutga (Render + Vercel + Supabase) o'rnatish boshqa hujjatda:
> [README.deploy.md](README.deploy.md). Ikkalasini aralashtirmang.

---

## 1. Nima kerak

| | Minimal | Tavsiya |
|---|---|---|
| Protsessor | 2 yadro | 4 yadro |
| Operativ xotira | 4 GB | 8 GB |
| Disk | 60 GB | 250 GB |

Operatsion tizim — **Ubuntu Server 24.04 LTS** yoki 22.04 LTS (Debian 12 ham
bo'ladi). Grafik muhit kerak emas.

Bundan tashqari:

- **Subdomen** — masalan `meduni.tashmi.uz`
- **SSL sertifikat** — Let's Encrypt (bepul, avtomatik) yoki universitetning o'zi
- **Chiquvchi HTTPS** `generativelanguage.googleapis.com` ga ochiq bo'lsin

> ⚠️ Chiquvchi ulanish yopiq bo'lsa platforma ochiladi va login ishlaydi, lekin
> konspekt, test, slayd va video **yaratilmaydi**. Buni o'rnatishdan oldin
> tekshirgan ma'qul:
> ```
> curl -sS -o /dev/null -w '%{http_code}\n' https://generativelanguage.googleapis.com/
> ```
> Javob kelsa (404 ham bo'ladi) — yo'l ochiq. Osilib qolsa — yopiq.

**Disk qanday hisoblangan:** bitta to'liq mavzu (slayd rasmlari, video, podkast,
yuklangan hujjatlar) ≈ **21 MB**. 1000 mavzu ≈ 21 GB. Qolgani — tizim, baza va
zaxira nusxalar.

---

## 2. Docker o'rnatish

Docker'ning rasmiy o'rnatuvchisi — Ubuntu va Debian'da bir xil ishlaydi,
`docker compose` buyrug'ini ham birga qo'yadi:

```bash
sudo apt update && sudo apt install -y curl git
curl -fsSL https://get.docker.com | sudo sh
sudo systemctl enable --now docker
docker compose version     # versiya chiqsa — tayyor
```

> ⚠️ `apt install docker-compose-plugin` distributivning o'z repozitoriysida
> **yo'q** (u Docker'ning repozitoriysidan keladi). Debian'dagi `docker-compose`
> paketi esa eski v1 — undagi buyruq nomi boshqa.

O'zingizni docker guruhiga qo'shsangiz `sudo`siz ishlatasiz (keyin qayta kiring):

```bash
sudo usermod -aG docker $USER
```

---

## 3. Kodni olish

```bash
sudo mkdir -p /opt/meduni && sudo chown $USER /opt/meduni
git clone https://github.com/ulugbekergashev/meduni.git /opt/meduni
cd /opt/meduni
```

---

## 4. Sozlamalar

```bash
cp .env.server.example .env
nano .env
```

Kamida shu to'rttasi to'ldiriladi:

```bash
DB_PASSWORD=$(openssl rand -hex 24)
JWT_ACCESS_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
DOMAIN=meduni.tashmi.uz
```

**Sun'iy intellekt kaliti serverga yozilmaydi.** Har kafedra o'z Gemini kalitini
platformada o'zi kiritadi: *Xodimlar → kafedra sahifasi → "Gemini AI kaliti"*
([aistudio.google.com/apikey](https://aistudio.google.com/apikey) dan olinadi).
Kalit bazada shifrlangan holda saqlanadi.

Kalitlar shifrlanadigan sir **majburiy** (kamida 32 belgi; yo'q bo'lsa kafedralar
kalit saqlay olmaydi). Uni bir marta qo'ying va **keyin o'zgartirmang** (o'zgarsa
saqlangan kalitlar o'qilmay qoladi, kafedralar qayta kiritadi):

```bash
AI_KEY_SECRET=$(openssl rand -hex 32)
```

`GEMINI_API_KEY` (umumiy kalit) ixtiyoriy: berilsa, o'z kalitini kiritmagan
kafedralar shuni ishlatadi; berilmasa har kafedra faqat o'z kalitida ishlaydi.

Serverning xotirasiga qarab `NODE_HEAP_MB` ni qo'ying — **8 GB → 2048**,
16 GB → 4096. Sukut qiymat past (bulutdagi bepul tarif uchun edi) va video
montajiga yetmaydi.

---

## 5. Ishga tushirish

**Variant A — sertifikatni o'zi olsin** (domen internetdan ko'rinadi, 80/443 ochiq):

```bash
docker compose -f docker-compose.deploy.yml --profile tls up -d --build
```

**Variant B — serverda nginx allaqachon bor** (80/443 band bo'lsa shu variant;
Caddy bu holda portni ololmay yiqiladi):

```bash
docker compose -f docker-compose.deploy.yml up -d --build
```

Platforma `127.0.0.1:8080` da turadi. nginx'ni unga yo'naltiring:

```bash
sudo tee /etc/nginx/sites-available/meduni >/dev/null <<'EOF'
server {
    listen 80;
    server_name meduni.example.uz;          # ← o'z domeningiz

    client_max_body_size 200m;              # material va video yuklash

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;            # uzoq generatsiya so'rovlari
    }
}
EOF
sudo ln -sf /etc/nginx/sites-available/meduni /etc/nginx/sites-enabled/meduni
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Sertifikat (Let's Encrypt, avtomatik yangilanadi):

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d meduni.example.uz
```

> ⚠️ certbot faqat domen DNS'da **shu serverning IP'siga** qaragandan keyin
> ishlaydi. Tekshirish: `getent hosts meduni.example.uz` — IP chiqishi kerak.

> ⚠️ `X-Forwarded-For` sarlavhasini olib tashlamang. Busiz platforma barcha
> talabalarni proxy'ning bitta manzili (`127.0.0.1`) deb ko'radi: so'rovlar
> chegarasi hammaga bitta bo'lib qoladi, test halolligi hisobotidagi
> "turli IP'dan kirdi" signali esa ma'nosini yo'qotadi.

Proxy boshqa mashinada bo'lsa `.env` da `APP_BIND=0.0.0.0`.

Birinchi qurilish 5–15 daqiqa oladi. Keyin:

```bash
docker compose -f docker-compose.deploy.yml ps
docker compose -f docker-compose.deploy.yml logs -f app
```

Loglarda `API ishga tushmoqda` chiqsa — tayyor.

---

## 6. Tekshirish

```bash
curl -sS https://meduni.tashmi.uz/health
```

Brauzerda saytni oching. `DEMO_SEED=1` bo'lsa demo akkauntlar yaratilgan bo'ladi
(loglarda ko'rinadi) — kirib, uchala rolni tekshiring.

> ⚠️ Haqiqiy foydalanuvchilar kiritilgach `.env` da `DEMO_SEED=0` qiling va
> qayta ishga tushiring, keyin demo akkauntlarni o'chiring.

---

## 7. Zaxira nusxa

Bu tizimda talabalarning **baholari, test natijalari va davomati** saqlanadi —
tiklab bo'lmaydigan ma'lumot. Zaxirasiz ishlatmang.

```bash
sudo tee /etc/cron.daily/meduni-backup >/dev/null <<'EOF'
#!/bin/sh
set -e
cd /opt/meduni
OUT=/var/backups/meduni
mkdir -p "$OUT"
STAMP=$(date +%F)
docker compose -f docker-compose.deploy.yml exec -T db \
  pg_dump -U meduni meduni | gzip > "$OUT/db-$STAMP.sql.gz"
find "$OUT" -name 'db-*.sql.gz' -mtime +30 -delete
EOF
sudo chmod +x /etc/cron.daily/meduni-backup
```

Media fayllar (materiallar, slayd rasmlari, video, podkast) `meduni_storage`
volume'ida — yuqoridagi skript ularni **saqlamaydi**. Ular uchun `scripts/backup-storage.sh`
(har kuni, 14 kun saqlanadi, `~/meduni-backups/`). Root kerak emas — docker guruhidagi
foydalanuvchining o'z crontab'i yetadi:

```bash
(crontab -l 2>/dev/null | grep -v backup-storage; \
 echo '30 6 * * * sh /opt/meduni/scripts/backup-storage.sh >> $HOME/meduni-backup.log 2>&1') | crontab -
```

> ⚠️ Nusxalar **shu serverdan tashqarida** ham turishi kerak — aks holda
> mashina ishdan chiqsa ma'nosi qolmaydi.

---

## 8. Yangilash

**Avtomatik (tavsiya etiladi).** Bir marta o'rnatiladi: server har 5 daqiqada
GitHub `main` ni tekshiradi va yangi commit bo'lsa o'zi tortib, qayta quradi
(`scripts/auto-deploy.sh`). Serverga har safar kirish kerak bo'lmaydi.

```bash
(crontab -l 2>/dev/null | grep -v auto-deploy; \
 echo '*/5 * * * * sh /opt/meduni/scripts/auto-deploy.sh >> $HOME/meduni-deploy.log 2>&1') | crontab -
```

Jurnal: `tail -n 30 ~/meduni-deploy.log`. O'chirish: `crontab -e` va qatorni olib tashlang.
Build yiqilsa sayt eski versiyada ishlab turaveradi (sababi jurnalda).

**Qo'lda:**

```bash
cd /opt/meduni
git pull
docker compose -f docker-compose.deploy.yml up -d --build
```

Baza sxemasi ishga tushishda o'zi moslashadi. Yangilashdan oldin zaxira oling.

---

## 9. Tez-tez uchraydigan nosozliklar

**Sayt ochiladi, lekin login "o'tadi" va darrov qaytadi.**
Sertifikat yo'q yoki sayt HTTP orqali ochilyapti. Brauzer himoyalanmagan
ulanishda sessiya cookie'sini saqlamaydi. HTTPS qo'ying.

**Konspekt/test/video yaratilmayapti, qolgani ishlaydi.**
Shu kafedra o'z Gemini kalitini kiritmagan (kafedra sahifasida "Gemini AI kaliti"),
kalit eskirgan/bekor qilingan, yoki chiquvchi ulanish yopiq (1-bo'limdagi
`curl` bilan tekshiring).

**Video montaji yiqilyapti.**
`.env` da `NODE_HEAP_MB` past. Serverning xotirasiga qarab ko'taring va qayta
ishga tushiring.

**Let's Encrypt sertifikat olmayapti.**
Domen internetdan ko'rinmayapti yoki 80/443 yopiq. Ichki tarmoqda ishlatsangiz
universitetning o'z sertifikatini qo'ying — [Caddyfile](Caddyfile) ichida
namunasi bor.

**Disk to'ldi.**
```bash
docker system prune -af
```
Bu eski image'larni tozalaydi. Ma'lumotga (volume'larga) tegmaydi.
