# MedUni — Oracle Cloud (Always Free) ga deploy qo'llanma

Natija: **online, kompyuterga bog'liq bo'lmagan, doimiy havola** (24/7).
To'plam: `Dockerfile` + `docker-compose.deploy.yml` (API+web+Postgres bitta buyruqda).

⚠️ Akkaunt ochish, VM yaratish, karta — bularni SIZ qilasiz (menda kirish yo'q).
Quyida har qadam yozilgan. VM tayyor bo'lgach deploy — 3-4 buyruq.

---

## 1. Oracle Cloud akkaunt (yangi, dentacrm bilan aloqasiz)

1. https://www.oracle.com/cloud/free/ → **Start for free**.
2. Email (yangi/istalgan), mamlakat: Uzbekistan, telefon tasdiqlash.
3. **Visa/Mastercard** (tasdiqlash uchun; Always Free'da pul yechilmaydi, ~$1 hold qaytadi).
   ⚠️ Humo/UzCard ko'pincha o'tmaydi — dollarli Visa/MC kerak.
4. Region tanlashda: bandroq regionlarda ARM "out of capacity" chiqadi.
   Yaqinroq/kamroq band: **Jeddah, Dubai, Frankfurt, Mumbai** — birini sinang.

## 2. ARM VM yaratish

1. Console → **Compute → Instances → Create instance**.
2. **Image**: Canonical **Ubuntu 22.04**.
3. **Shape**: **Ampere (ARM) → VM.Standard.A1.Flex**, `2 OCPU / 12 GB` (Always Free
   4 OCPU/24GB ichida). ⚠️ "Out of host capacity" chiqsa — boshqa region yoki
   biroz kutib qayta urinib ko'ring (bu bepul ARM'ning ma'lum muammosi).
4. **SSH key**: "Generate a key pair" → **private key'ni yuklab oling** (SSH uchun).
5. **Create**. Bir necha daqiqada tayyor → **Public IP** ni yozib oling.

## 3. Port 80'ni ochish (ingress)

Instance → **Virtual Cloud Network → Security List → Add Ingress Rule**:
- Source `0.0.0.0/0`, IP Protocol **TCP**, Destination Port **80** → Add.
(80 — web/API kiradigan port.)

## 4. VM'ga SSH

Windows PowerShell'da (yuklagan private key bilan):
```powershell
ssh -i "C:\yo'l\private-key.key" ubuntu@VM_PUBLIC_IP
```

## 5. Docker o'rnatish (VM ichida, bir marta)
```bash
sudo apt update && sudo apt install -y docker.io docker-compose-plugin git
sudo usermod -aG docker $USER && newgrp docker
```

## 6. Kodni VM'ga olib kelish

**Variant A — GitHub (tavsiya):** loyihani yangi **private** GitHub repo'ga push qiling,
keyin VM'da:
```bash
git clone https://github.com/SIZNING_USERINGIZ/meduni.git && cd meduni
```

**Variant B — to'g'ridan yuklash:** kompyuterdan (PowerShell), `node_modules`siz zip'lab
`scp` bilan yuboring (yoki WinSCP bilan).

## 7. Env sozlash (VM ichида, loyiha papkasида)
```bash
cp .env.deploy.example .env
# JWT sekretlari:
echo "JWT_ACCESS_SECRET=$(openssl rand -hex 32)" >> .env
echo "JWT_REFRESH_SECRET=$(openssl rand -hex 32)" >> .env
nano .env      # GEMINI_API_KEY ni to'ldiring, namunа qatorlarni o'chiring
```

## 8. Ishga tushirish (bitta buyruq!)
```bash
docker compose -f docker-compose.deploy.yml up -d --build
```
Birinchi build ~5-10 daqiqa (ARM'da image + npm install). Loglar:
```bash
docker compose -f docker-compose.deploy.yml logs -f app
```
`API ishga tushmoqda (:8080...` ko'rinsa — tayyor.

## 9. Ochish
Brauzerда: **`http://VM_PUBLIC_IP`**
- Admin: `admin@meduni.uz` / `admin123`
- O'qituvchi: `teacher.m11demo@meduni.uz` / `student123`
- Talaba: `student@meduni.uz` / `student123`

## 10. (Ixtiyoriy) Chiroyli domen + HTTPS

VM ishlaganда ustiga Cloudflare (dentacrm EMAS, yangi/istalgan domen) yoki Caddy
bilan TLS qo'yish mumkin. Bu bosqichда yordam beraman.

---

## Yangilash (kod o'zgarganда)
```bash
git pull   # yoki yangi kodni yuklang
docker compose -f docker-compose.deploy.yml up -d --build
```

## To'xtatish
```bash
docker compose -f docker-compose.deploy.yml down          # saqlanadi
docker compose -f docker-compose.deploy.yml down -v        # + ma'lumot o'chadi
```

⚠️ Birinchi deploy'da xato chiqishi mumkin (ARM, sharp, prisma) — logni menga
yuboring, birga tuzatamiz.
