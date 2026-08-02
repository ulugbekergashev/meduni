# MedUni — deploy: GitHub + Vercel + Render + Supabase

Natija: **doimiy, kompyuterga bog'liq bo'lmagan havola** (24/7), karta talab qilinmaydi.

| Qism | Qayerda | Tarif |
| :--- | :--- | :--- |
| Web (React/Vite) | **Vercel** | bepul (Hobby) |
| API (Express + ffmpeg/video) | **Render** | bepul (Free) |
| Postgres baza | **Supabase** | bepul (Free) |
| Kod | **GitHub** (private) | bepul |

> Nega API Vercel'da emas? Vercel serverless — u yerда **ffmpeg yo'q** va fon-jobi
> javobdan keyin o'ladi. Video generatsiya (Modul 9), material parse va rasm
> generatsiyasi shu sababли doimiy ishlaydigan serverni talab qiladi → Render.

---

## 0. Manzillar (joriy holat)

| | Nom | Manzil | Holat |
| :--- | :--- | :--- | :--- |
| Vercel loyihasi (web) | `meduni-api` | https://meduni-api.vercel.app | ✅ ishlayapti |
| Render servisi (API) | `meduni-api` | `https://meduni-api.onrender.com` | ⏳ yaratilmagan |

> ⚠️ **Render servisining nomi AYNAN `meduni-api` bo'lishi shart.** Web bundle'iga
> `https://meduni-api.onrender.com` manzili build paytida yozib qo'yilgan — nom
> boshqacha bo'lsa frontend API'ni topa olmaydi (yoki `VITE_API_URL` ni
> o'zgartirib Vercel'ni qayta deploy qilish kerak bo'ladi).
>
> Vercel loyihasi `meduni-api` deb nomlangan (import paytida shunday tanlangan),
> Render ham shu nomda — to'qnashuv yo'q, domenlar har xil (`.vercel.app` va
> `.onrender.com`).

---

## 1. GitHub — kodni yuklash

Loyihani **private** repozitoriyga qo'ying:

```powershell
git add .
git commit -m "Deploy: Vercel + Render + Supabase"
git branch -M main
git remote add origin https://github.com/SIZNING_USERINGIZ/meduni.git
git push -u origin main
```

> `.env` fayllar `.gitignore`da — GEMINI_API_KEY commit bo'lmaydi. Kalitlarni
> faqat Render/Vercel panelidan kiritasiz.

---

## 2. Supabase — baza

1. [supabase.com](https://supabase.com) → GitHub bilan kiring → **New Project**.
   * Name: `meduni`, Region: **Frankfurt** (Render region'i bilan bir xil bo'lsin).
   * **Database Password** — eslab qoling.
2. Loyiha tayyor bo'lgach: yuqoridagi **Connect** tugmasi → **ORM** yorlig'i (yoki
   Project Settings → Database → Connection string).
3. **Session pooler** ni tanlang (port **5432**, `...pooler.supabase.com`):

   ```
   postgresql://postgres.ABCDEF:PAROL@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
   ```

   ⚠️ **Direct connection (`db.xxx.supabase.co`) ni OLMANG** — u faqat IPv6, Render
   esa IPv6 bilan chiqa olmaydi (`P1001: Can't reach database server` xatosi).
   **Session pooler** IPv4 va Prisma'ning `db push`i bilan ham ishlaydi.
4. `PAROL` qismini haqiqiy parolga almashtiring. Bu — `DATABASE_URL`.

⚠️⚠️ **REGION — eng katta tezlik omili (2026-07-27 da o'lchandi).** Supabase
loyihasi va Render servisi **BIR REGIONDA** bo'lishi SHART (ikkalasi ham
Frankfurt / `eu-central-1`). Ilgari baza Singapurda (`ap-southeast-1`), server
Frankfurtda edi — har SQL so'rovi ~150-300ms bo'lib, sahifalar **5-10 soniya**
ochilardi. Bir regionga keltirilgach o'sha sahifalar **0.35-0.5 soniya**.
Region keyinchalik O'ZGARTIRILMAYDI — noto'g'ri tanlansa loyiha qayta yaratiladi;
`apps/api/src/scripts/bootstrapLive.ts` yangi bazani bitta buyruq bilan to'ldiradi
(`cd apps/api && STORAGE_DRIVER=db npx tsx src/scripts/bootstrapLive.ts`).

⚠️ **Ulanish limiti:** Session pooler butun loyihaga ~15 mijoz beradi; Prisma esa
sukut bo'yicha `CPU*2+1` ochadi. Kod URL'ga `connection_limit=5` qo'shadi
(`packages/db/src/index.ts`, `DB_CONNECTION_LIMIT` bilan o'zgartiriladi). Dev
mashinasi ham shu bazaga ulansa shu limit yodda bo'lsin.

---

## 3. Render — API

**Variant A (tez): Blueprint.** Repo'da `render.yaml` bor.
Render → **New → Blueprint** → repo'ni tanlang → Render qolgan qiymatlarni so'raydi.

**Variant B: qo'lda.** Render → **New → Web Service** → repo → sozlash:
* Name: `meduni-api` · Region: **Frankfurt** · Runtime: **Docker** · Instance: **Free**

Ikkala variantда ham **Environment Variables**:

| Key | Value |
| :--- | :--- |
| `DATABASE_URL` | *2-qadamdagi Session pooler URI (paroli bilan)* |
| `GEMINI_API_KEY` | *Gemini kaliti* ⚠️ eskisi skomprometatsiya — yangisini oling |
| `JWT_ACCESS_SECRET` | *tasodifiy hex* (Render "Generate" tugmasi bor) |
| `JWT_REFRESH_SECRET` | *boshqa tasodifiy hex* |
| `WEB_ORIGIN` | `https://meduni-api.vercel.app` |
| `VERCEL_PROJECT` | `meduni-api` *(preview deploy'lar ham ishlashi uchun)* |
| `CROSS_SITE_COOKIES` | `1` ⚠️ **shusiz login ishlamaydi** |
| `NODE_ENV` | `production` |
| `DEMO_SEED` | `1` *(birinchi ishga tushishda demo akkauntlar)* |
| `WEBAUTHN_RP_ID` | `meduni-api.vercel.app` *(sxemasiz!)* |
| `WEBAUTHN_ORIGIN` | `https://meduni-api.vercel.app` |

**Create** → birinchi build ~8-12 daqiqa (ffmpeg + npm install).
Log'да quyidagini kutasiz:

```
==> Bazani kutish + sinxronlash (prisma db push)...
API ready on http://localhost:8080
  web origins : https://meduni-api.vercel.app
  cookies     : SameSite=None; Secure (cross-site)
```

Tekshirish: `https://meduni-api.onrender.com/health` → `{"ok":true}`

---

## 4. Vercel — web ✅ (bajarilgan)

1. [vercel.com](https://vercel.com) → GitHub bilan kiring → **Add New → Project** →
   `meduni` repo'sini **Import**.
2. **Project Name**: `meduni-api`.
3. Framework Preset: **Other** — build sozlamalariga **tegmang**, ular
   repo'dagi `vercel.json` dan olinadi.

   > ⚠️ **Import paytidagi asosiy tuzoq (biz shunga uch marta yiqildik):**
   > Vercel monorepo'ni skanerlab `apps/api` dagi Express'ni "framework" deb
   > topadi va **Root Directory ni `apps/api` qilib qo'yadi**. Natijada `npm
   > install` API papkasida ishlaydi (`added 373 packages`), `react` umuman
   > o'rnatilmaydi va build 300+ "Cannot find module" xatosi bilan yiqiladi.
   > **Root Directory bo'sh (repo ildizi) bo'lishi shart**, Framework Preset —
   > **Other**. Settings → Build & Deployment dan tekshiring.

   > `vercel.json` da install `--ignore-scripts` bilan: web uchun keraksiz
   > native build'lar (argon2, sharp, prisma — ular faqat API'da ishlaydi)
   > o'tkazib yuboriladi, keyin `npm rebuild esbuild` faqat Vite'ning
   > kompilyatorini tiklaydi. Shu sababли build ~2 barobar tez va argon2
   > kompilyatsiyasi Vercel'da sinsa ham web deploy'i to'xtamaydi.
4. **Environment Variables** — bitta o'zgaruvchi:

   | Key | Value |
   | :--- | :--- |
   | `VITE_API_URL` | `https://meduni-api.onrender.com` |

   ⚠️ Oxirida `/` bo'lmasin.
5. **Deploy** → ~2 daqiqa.

> ⚠️ `VITE_API_URL` **build paytida** bundle ichiga yoziladi. Keyinchalik uni
> o'zgartirsangiz — Vercel'da **Redeploy** qilish shart, aks holda eski manzil
> qoladi.

---

## 5. Ochish va tekshirish

`https://meduni-api.vercel.app`

| Rol | Login | Parol |
| :--- | :--- | :--- |
| Admin | `admin@meduni.uz` | `admin123` |
| O'qituvchi | `teacher.m11demo@meduni.uz` | `student123` |
| Talaba | `student@meduni.uz` | `student123` |

⚠️ Birinchi kirishда Render "uxlagan" bo'lsa ~50 soniya kutasiz (bepul tarif).

---

## Nosozliklarni bartaraf qilish

| Alomat | Sabab / yechim |
| :--- | :--- |
| Vercel build: 300+ `Cannot find module 'react'` | **Root Directory** `apps/api` yoki `apps/web` ga qo'yilgan — **bo'sh** (repo ildizi) bo'lishi kerak. Log'da `added 373 packages` ko'rinsa aynan shu |
| Vercel build: `JSX.IntrinsicElements mavjud emas` | devDependencies o'rnatilmagan — `vercel.json` da `--include=dev` bo'lishi shart (`--production=false` npm 9+ da **eskirgan**, ishlamaydi) |
| Login "muvaffaqiyatli", lekin sahifa qayta login so'raydi | `CROSS_SITE_COOKIES=1` qo'yilmagan (cookie SameSite=None bo'lmasa brauzer uni tashlab yuboradi) |
| Konsolда `CORS ... has been blocked` | Render'да `WEB_ORIGIN` noto'g'ri (`https://` bilan, oxirida `/` **siz**) |
| Tarmoqda so'rovlar `localhost:8000` ga ketyapti | Vercel'да `VITE_API_URL` yo'q yoki qo'yilgandan keyin **Redeploy** qilinmagan |
| Render log: `P1001: Can't reach database server` | Supabase **Direct connection** (IPv6) ishlatilgan — **Session pooler** (5432) ga almashtiring |
| Preview deploy'да login ishlamaydi | `VERCEL_PROJECT` o'zgaruvchisi qo'yilmagan |
| Passkey/check-in ishlamaydi | `WEBAUTHN_RP_ID` sxemasiz domen bo'lishi shart (`meduni-api.vercel.app`) |

---

## Bepul tarif cheklovlari (bilib turing)

1. **Render Free 15 daqiqada uxlaydi.** Keyingi kirgan odam ~50 soniya kutadi.
   Taqdimotdan 1 daqiqa oldin saytni ochib "uyg'otib" qo'ying.
2. ~~Yuklangan fayllar doimiy emas~~ — **HAL QILINDI (2026-07-27).** Fayllar endi
   bazada saqlanadi (`file_blobs` jadvali, `lib/storage.ts` ning `db` drayveri),
   Render diski o'chsa ham qoladi. ⚠️ Mahalliy skript bilan material yozganda
   `STORAGE_DRIVER=db` ber — aks holda fayl mahalliy diskka tushadi va serverда
   ko'rinmaydi.
3. **Supabase Free 1 hafta faolliksizdan keyin loyihani pauza qiladi** — panelдан
   bir bosishda tiklanadi.

---

## Yangilash

`git push` — Vercel ham, Render ham avtomat qayta deploy qiladi.

## Zaxira rejim (Vercel ishlamay qolsa)

Dockerfile hali ham web'ni o'zi tarqata oladi (bitta origin):
`BUILD_WEB=1` build-arg + `SERVE_WEB=1` env → API `/` da web'ni ham beradi.
Mahalliy/VM uchun: `docker compose -f docker-compose.deploy.yml up -d --build`.

---

## Matn AI: bepul provayderlar zanjiri (2026-08-03)

**Nega:** Gemini krediti tugaganda konspekt/test/keys generatsiyasi butunlay
to'xtardi. Endi matn ZANJIR bo'yicha yaratiladi — bepul modellar ketma-ket
sinaladi, Gemini esa faqat **rasm va TTS** uchun (va matnda oxirgi chora).

### Env (Render → Environment)

```
AI_TEXT_CHAIN = free1,free2,gemini

FREE1_BASE_URL = https://api.groq.com/openai/v1
FREE1_API_KEY  = gsk_...
FREE1_MODEL    = llama-3.3-70b-versatile

FREE2_BASE_URL = https://openrouter.ai/api/v1
FREE2_API_KEY  = sk-or-...
FREE2_MODEL    = deepseek/deepseek-chat-v3-0324:free
```

- Slot nomlari ERKIN (`free1`, `mygroq`, …) — `AI_TEXT_CHAIN` dagi nom
  `<NOM>_BASE_URL / _API_KEY / _MODEL` env'lariga mos kelsa yetadi.
- `<NOM>_MODEL_LITE` — ixtiyoriy (arzon/tez model: virtual bemor, AI-tutor).
- Krediti to'liq bo'lmagan slot jimgina O'TKAZIB YUBORILADI.
- `AI_TEXT_CHAIN` berilmasa — eski xatti-harakat (hammasi Gemini).
- Server ishga tushganda faol zanjir logda ko'rinadi: `matn AI : free1 → free2 → gemini`.

### Bepul kalitlar qayerdan

| Provayder | Endpoint | Izoh |
|---|---|---|
| Groq | `https://api.groq.com/openai/v1` | console.groq.com — bepul tarif, juda tez |
| OpenRouter | `https://openrouter.ai/api/v1` | openrouter.ai — `:free` qo'shimchali modellar |
| Cerebras | `https://api.cerebras.ai/v1` | cloud.cerebras.ai — bepul tarif |

⚠️ Model nomlari vaqt bilan o'zgaradi — provayder saytidagi joriy ro'yxatdan
tanlang. O'zbek tilidagi tibbiy matn uchun kuchliroq modelni BIRINCHI qo'ying
(DeepSeek V3 / Qwen kabi), Gemini esa oxirida zaxira bo'lib turadi.

### Rasm va ovoz

- `AI_IMAGE_PROVIDER = gemini | pollinations` — `pollinations` kalitsiz BEPUL
  (sifat pastroq, lekin bo'sh slayddan yaxshiroq).
- `AI_TTS_PROVIDER = gemini | edge` — `edge` bepul (edge-tts, python moduli).
