# CLAUDE.md — MedUni AI platform (doimiy qoidalar)

Bu fayl — Claude Code uchun DOIMIY ko'rsatma. Har modul, har sessiyada shu qoidalarga amal qil. Har yangi sG'ubha yoki sahifa yaratishdan oldin bu faylni o'qi.

---

## 0. Loyiha nima

Tibbiyot universiteti uchun AI o'quv platformasi. Uch rol: **admin** (universitetni quradi), **o'qituvchi** (AI bilan o'quv kontent yaratadi va tasdiqlaydi), **talaba** (ketma-ket o'qiydi). O'qituvchi material yuklaydi → AI konspekt, test, klinik keys, prezentatsiya, video yasaydi → o'qituvchi tekshirib tasdiqlaydi → talaba ko'radi.

---

## 1. SIFAT STANDARTI (eng muhim — buzilmaydi)

Bu proyekt **professional, murakkab platforma** bo'lishi kerak, primitiv admin-panel EMAS. Buyurtmachi (tibbiyot universiteti) ga topshiriladi.

### TAQIQLANADI:
- ❌ Bo'sh sahifada quruq 4-6 ta raqam turishi (statistika kartasi bo'lsa — ikonka, rang, izoh, kontekst bilan)
- ❌ Bir xil ko'rinishdagi, farqsiz elementlar (har element o'z ma'nosi va rangiga ega bo'lsin)
- ❌ Bir sahifaga bir necha turli modulni tiqish (bitta sahifa = bitta modul)
- ❌ Holатsiz UI (har jadval/ro'yxatda: yuklanmoqda, bo'sh, xato holati bo'lishi SHART)
- ❌ Inline rang yozish (faqat dizayn tokenlaridan foydalan)
- ❌ Yuzaki, "ishlaydi-da" darajasidagi ish

### TALAB QILINADI:
- ✅ Har sahifa to'liq: barcha tugma ishlaydi, barcha holat qamrab olingan
- ✅ Har element o'z rangi/ikonkasi bilan (semantik ranglar)
- ✅ Interaktivlik: hover, o'tishlar (transition), toast bildirishnomalar, tasdiq modallari
- ✅ Real ma'lumot oqimi (backend bilan ulangan, mock emas — agar backend tayyor bo'lsa)
- ✅ Mobil moslik (ayniqsa talaba sahifalari)
- ✅ Ikki til (uz-lotin / rus) har joyda
- ✅ Bo'sh holat ham chiroyli (EmptyState komponenti)

**Mezon:** har sahifani tugatgach o'zingga savol ber — "Buni tibbiyot universiteti rektoriga ko'rsatsam uyalmaymanmi? Bu NotebookLM darajasidami?" Agar yo'q bo'lsa — qayta ishla.

---

## 2. O'Z-O'ZINI TEKSHIRISH (har modul tugagach)

Har modulni tugatgach, MENGA aytishdan oldin O'ZINGNI tekshir. Faqat muammo bo'lsa yoki qaror kerak bo'lsa menga ayt. Tekshiruv ro'yxati:

1. **Ishlaydimi:** har tugma, har forma, har filtr, har modal ishlaydimi? Qo'lda bosib ko'r (yoki test yoz).
2. **Holatlar:** yuklanmoqda / bo'sh / xato / normal — to'rttasi ham bormi?
3. **Dizayn:** dizayn tokenlaridan foydalanilganmi? Inline rang yo'qmi? Har element o'z rangida-mi?
4. **Modullik:** bu sahifa faqat o'z modulini yuklaydimi? Boshqa modul ma'lumotini aralashtirmadimi?
5. **Til:** hamma matn uz/ru da bormi? Qattiq kodlangan matn (faqat bitta tilда) qolmadimi?
6. **Ruxsat:** rol tekshiruvi bormi? (o'qituvchi faqat o'z kursini, talaba faqat o'ziniki)
7. **Bog'lanish:** bu modul boshqa modullar bilan to'g'ri ulanganmi?
8. **Konsol:** brauzer konsolida xato yo'qmi? Backend log toza-mi?

Agar biror band bajarilmagan bo'lsa — MENGA aytmasдан o'zing tuzat. Faqat quyidagi hollarda menga ayt:
- Arxitektura qarori kerak (ikki yo'l bor, qaysi biri?)
- Talab noaniq (men promptда yozmagan holat chiqdi)
- Texnik to'siq (masalan API kaliti yo'q, kutubxona ishlamayapti)

---

## 3. STACK

- Frontend: React + TypeScript + Vite, TailwindCSS
- Backend: Node.js + Express + TypeScript
- Baza: PostgreSQL + Prisma ORM
- AI: Google Gemini (matn: gemini-2.x; rasm: Nano Banana Pro / gemini-3-pro-image; video: slaydlar+TTS+ffmpeg)
- Auth: JWT, argon2, RBAC
- i18n: uz-lotin / rus

---

## 4. DIZAYN TIZIMI (packages/ui — barcha sahifa shundan foydalanadi)

### Ranglar (tokenlar) — Indigo Pro (2026-07 redizayn, Faza 0)
```
bg: #F6F7F9 | surface: #FFFFFF | ink: #101828 | ink-soft: #5B6474 | ink-faint: #98A1B2 | line: #E7EAF0
brand: #4F46E5 | brand-soft: #EEF2FF | brand-deep: #3730A3   (indigo — asosiy)
blue: #0284C7 / #E0F2FE (sky — test, ma'lumot; indigo'dan uzoq turishi uchun sky tanlangan)
violet: #7C3AED / #F1EBFE (video — UI aksent, asosiy diagramma to'plamiga kirmaydi)
amber: #D97706 / #FEF3E2 (ogohlantirish, tekshiruv)
rose: #E11D48 / #FDE9EE (keys, xato)
emerald: #059669 / #E6F7F0 (muvaffaqiyat, tugadi)
Diagramma (kategorial) to'plami — CVD/kontrast validatordan o'tgan:
brand, emerald, amber, blue, rose (amber↔emerald yonma-yon faqat 2px oraliq/yorliq bilan).
```

### O'lchamlar
- Karta radius 16px, tugma/input 10px, badge/pill 20px (dumaloq)
- Sarlavha h1: 28px/700, katta raqam: 36px/700 tabular-nums, bo'lim: 16px/700, matn: 14px, izoh: 12.5px/ink-faint (2026-07 scale-up: hammasi kattalashtirildi)
- Soyalar tokenli: `--shadow-card` / `--shadow-card-hover` (ink-tinted, dark'da o'z varianti); Tailwind `shadow-card`/`shadow-card-hover`
- Sana formati: `lib/date.ts::formatDate(locale, date, "long|short|shortYear")` — uz oy nomlari qo'lda ("15-iyul, 2026-yil"; uz-UZ ICU "M07" buzuq), toLocaleDateString'ni oy-nomli formatda ISHLATMA
- Panel padding 20-22px, kartalar orasi 14-16px
- Shrift: Inter / system-ui

### Umumiy komponentlar (packages/ui da)
Button (primary/deep/ghost/soft/danger, sm/md/lg, ikonka, hoverда brand→brand-deep, active:scale-98), StatusPill (draft/review/published), Card (p-6, shadow-card, hoverда ko'tariladi), **StatCard (ikonka-chip + katta raqam + label/hint; tone=class string; selected=filtr holati; compact)**, Icon (SVG, stroke 1.7 yoki lucide-react), Input/Textarea (focusда brand chegara+ring), Modal (markazда, Escape+tashqi bosishда yopiladi), Toast (pastда, 2.6s, ok/warn), Spinner, EmptyState (text+hint+action, dashed karta), **Sidebar layout (272px, YORUG' — oq surface, border-r, faol=brand-soft chip + chap indigo indikator; `--side-*` tokenlar, dark'da o'z varianti)**, Charts (ProgressRing def 116/11, **Donut (segmentli, 2px oraliq, markazda qiymat) + LegendRow**, BarRow, MiniBars, StackedBar 2px-gap segmentlar). Kontent max-w 1280px. Tablar: segmented uslub (bordered surface track p-1, faol=brand-soft chip) — TabNav/GroupProfile/LessonPage bir xil.

### Tamoyillar
- Har statistika o'z rangida (talaba=ko'k, o'qituvchi=violet, kurs=brand/indigo, ...)
- Har karta interaktiv (hover jonlanadi)
- Gradient faqat urg'u uchun (brand-deep→brand)
- Bo'shliq ko'p, nafas oladi
- Mobil: talaba sahifalari mobil-birinchi

---

## 5. ARXITEKTURA QOIDALARI

- **Bitta sahifa = bitta modul.** Kurs sahifasi = yengil karkas (shapka + tab-bar), har tab o'z modulini o'zi yuklaydi. Karkas ma'lumot yuklamaydi.
- **Faqat ochiq tab yuklanadi** (dangasa yuklash — tez, token tejaydi).
- **URL har holatni aks ettiradi** (tab, sahifa — link ulashish, orqaga ishlaydi).
- **Modullar bir-birini bilmaydi** — izolyatsiya.

---

## 6. BIZNES QOIDALARI

- Rollar: **SUPERADMIN → FACULTY_ADMIN → DEPT_ADMIN → TEACHER → STUDENT** (Modul 20 Faza 2;
  ilgari faqat 3 rol edi, `ADMIN` enum'da deprecated qoldi, seed'da SUPERADMIN'ga ko'chiriladi).
  Admin-scope User.facultyId (fakultet-admin) / User.adminDepartmentId (kafedra-admin);
  teacher scope o'sha TeacherProfile.departmentId. **XP, badge, leaderboard, streak, QR — YO'Q.**
- **Hech narsa avtomatik publish bo'lmaydi.** Ikki qulf: (1) o'qituvchi konspektni tasdiqlaydi, keyingina generatsiya; (2) o'qituvchi kontentни tasdiqlaydi, keyingina talaba ko'radi.
- **AI faqat yuklangan materialdan** (RAG). O'zidan fakt/doza/protokol qo'shmaydi. Faktcheck bu buzilmaganini tekshiradi.
- Yo'qlama — sodda (o'qituvchi qo'lda belgilaydi: keldi/kelmadi/kechikdi/sababli). QR YO'Q.
- Mavzular ketma-ket ochiladi (keyingisi oldingisi tugagach).
- Test — bir marta ishlanadi, natija + izohli tahlil.
- Keys — talaba yozadi → etalon ko'radi → o'qituvchi baholaydi.

---

## 7. ISHLASH TARTIBI

- Har modul — alohida sessiya. Men (foydalanuvchi) har modul uchun batafsil prompt beraman.
- Har moduldan keyin: o'zingni tekshir (2-bo'lim), commit qil, CLAUDE.md ni yangila (nima qo'shildi).
- Prompt bermаган holat chiqsa — taxmin qilma, menga so'ra.
- Har commit oldidan: brauzer konsoli toza, backend log toza bo'lsin.

---

## 8. MODULLAR RO'YXATI (tartib)

Tayyor:
- Asos + auth + dizayn tizimi + bo'sh dashboardlar (sessiya 0).
- **Modul 1 — Admin: Tuzilma (tayyor).** Fakultet→kafedra→fan→guruh, 4 tab
  (`/admin/structure/*`, har tab alohida route+so'rov). Prisma: Faculty/
  Department/Subject/StudentGroup. Backend `apps/api/src/modules/org/`
  (`/api/v1/{faculties,departments,subjects,groups}`, `requireRoles("ADMIN")`):
  takroriy nom → 409 `DUPLICATE`, bog'liqlik bo'lsa o'chirish → 409
  `HAS_CHILDREN` (aniq son bilan). Frontend umumiy qismlar: `lib/crud.ts`,
  `components/{AsyncSection,ConfirmDialog,DataTable,TabNav,Field}.tsx`,
  `@meduni/ui`ga `Select` qo'shildi. To'rt holat + toast + tasdiq modali.
- **Modul 2 — Admin: Foydalanuvchilar (tayyor).** Prisma: `User.groupId?` +
  `TeacherProfile` (departmentId majburiy). Backend `apps/api/src/modules/users/`
  (`/api/v1/users`, `requireRoles("ADMIN")`): list (pagination+rol filtri+
  ism/email qidiruv), create (avto-parol argon2, rolga qarab groupId/departmentId
  majburiy, email band → 409 `DUPLICATE_EMAIL`), patch, `toggle-active`
  (o'chirish YO'Q — nofaol qilinadi), `reset-password`, XLSX import (multer +
  **exceljs** — xlsx high-severity vuln sababli almashtirildi), har qator
  validatsiya + hisobot. Frontend `/admin/users`: rol filtri, qidiruv (debounce),
  dinamik forma (rol→guruh/kafedra), parol ko'rsatish modali (nusxalash), jadval
  (Avatar + rol Badge + faol Toggle), pagination, Excel import modali.
  `@meduni/ui`ga `Badge`+`Toggle` qo'shildi. Guruhlar endi haqiqiy talaba sonini
  ko'rsatadi.
- **Modul 3 — Admin: Kurslar (tayyor).** Prisma: Course/CourseGroup/Enrollment
  (`EnrollmentStatus` ACTIVE|DROPPED). Backend `apps/api/src/modules/courses/`
  (`/api/v1/courses`, `requireRoles("ADMIN")`): create → **avtomatik enrollment**
  (guruh STUDENT'lari ACTIVE bilan yoziladi, idempotent upsert); patch → guruh
  qo'shsa yozadi, olib tashlasa DROPPED qiladi (o'chirmaydi, tarixi qoladi);
  teacherId faqat role=TEACHER (aks holda 400); `studentCount` faqat ACTIVE'ni
  sanaydi (filtered `_count`); `GET /:id` detali (talabalar+status) + `/:id/students`.
  Frontend `/admin/courses`: yaratish formasi (fan+kafedra, o'qituvchi, semestr,
  o'quv yili, guruhlar chip), jadval — qatorlar semestr/guruh bilan farqlanadi
  (skrinshot muammosi hal), Toast enrollment sonini ko'rsatadi; detal sahifa
  `/admin/courses/:id` (stat tiles + guruh boshqaruvi + yozilgan talabalar).
  `@meduni/ui`ga `ChipSelect` qo'shildi.
- **Modul 4 — O'qituvchi: Kurs sahifasi karkasi (tayyor).** Backend
  `apps/api/src/modules/courses/teachRouter.ts` (`/api/v1/teach/courses`,
  `requireRoles("TEACHER")`): `GET /courses` (faqat o'ziga biriktirilgan),
  `GET /courses/:id` — **faqat metama'lumot** (talabalar/mavzular YO'Q), egasi
  bo'lmasa 403 "Bu sizning kursingiz emas". ⚠️ **Mount tartibi:** org router
  `/api/v1` generic prefiksda + ADMIN guard, shuning uchun u index.ts'da ENG
  OXIRIDA turishi shart (aks holda `/api/v1/teach/*` ni ushlab teacher'ni 403
  qiladi). Frontend: `/teach` — o'z kurslari kartalar; `/teach/courses/:id` —
  yengil karkas (`TeacherCourseShell`): shapka faqat metama'lumot (tab almashsa
  qayta yuklanmaydi, query courseId bilan keyed), URL-driven tab-bar
  (`topics/sessions/progress/settings`), har tab ALOHIDA route/komponent
  (`course/*Tab.tsx`, hozircha placeholder — Modul 5/13/15/10 to'ldiradi), faqat
  ochiq tab mount bo'ladi. Modullik: karkas hech qanday biznes-ma'lumot yuklamaydi.
- **Modul 5 — O'qituvchi: Mavzular + Material (tayyor).** Prisma: Topic
  (DRAFT|PUBLISHED, orderIndex, unlockRuleJson?), SourceMaterial (ParseStatus
  PENDING|PROCESSING|DONE|ERROR, parseError kod). Backend (TEACHER, egalik):
  `/api/v1/topics` (list?courseId, create[orderIndex avto], patch, delete,
  `PATCH /reorder`, `GET /:id` detali+materiallar+`digestUnlocked`),
  `/api/v1/materials` (`GET /:id`, `/:id/text`, `POST /:id/retry`, delete),
  `POST /topics/:id/materials` (multipart). Fayl → local storage
  (`apps/api/storage/`, gitignore, traversal himoya `lib/storage.ts`), fon-parse
  (setImmediate, `officeparser` — pdf/docx/pptx/txt/md → `toText()`), matnsiz
  PDF → ERROR `SCANNED`. Mount: `/api/v1/topics` va `/materials` org-router'dan
  OLDIN. Frontend: Mavzular tabi (qo'shish, ↑↓ reorder, status pill, o'chirish,
  → konstruktor); mavzu konstruktori `/teach/topics/:id` (ALOHIDA sahifa, karkas
  ichida emas): 5-qadamli progress-trek + 1-bo'lim Materiallar to'liq ishlaydi
  (drag-drop dropzone, 2s polling status, ajratilgan matnni ko'rish modali,
  retry/delete) + qolgan bo'limlar qulfli placeholder. Material DONE bo'lsa
  Konspekt qadami ochilishga tayyor (`digestUnlocked`). Admin kurs detali endi
  haqiqiy mavzu sonini ko'rsatadi.

- **Modul 6 — O'qituvchi: Konspekt (AI, birinchi qulf) (tayyor).** Birinchi Gemini
  integratsiyasi. AI qatlami `apps/api/src/ai/`: `gemini.ts` (`generateStructured`
  — `@google/genai`, `gemini-2.5-flash`, `responseSchema` bilan strukturaланган
  JSON, **thinking OFF** [thinkingBudget:0 — ~5s, ~2.6x kam token], timeout+retry,
  token log → `AiUsage`), `prompts/digest.ts` (system: FAQAT materialdan, doza/fakt
  ixtiro qilmaydi, uz-lotin + ru+lat atamalar, JSON-only), `types.ts` (zod +
  responseSchema). Prisma: TopicDigest (topicId unique, digestJson, version,
  approvedByTeacher), AiUsage. Backend (topics router):
  `POST /topics/:id/digest/generate` (material DONE bo'lmasa 400), `GET/PUT
  /digest`, `POST /digest/approve`. **Birinchi qulf:** PUT (tahrir) →
  approvedByTeacher=false; approve → true; `generateUnlocked` = approved.
  Frontend: konstruktor 2-bo'lim `DigestSection` (generate/progress → tahrirlanadi:
  maqsad/tushuncha/atama-jadval/fakt/**doza-amber**/rasm — EditableList+TermsTable,
  Save[dirty] → un-approve, approve bloki ogohlantirish bilan); 3-bo'lim
  (Generatsiya) approve bo'lguncha qulfli. AI faqat materialdan (dozalar aynan
  manbadan — tekshirildi). GEMINI_API_KEY `apps/api/.env`da.

- **Modul 7 — O'qituvchi: Test + Klinik keys generatsiya (tayyor).** Konstruktor
  3-bo'lim (Generatsiya). Prisma: ContentItem (kind QUIZ|CASE|PRESENTATION|VIDEO,
  status DRAFT|REVIEW|APPROVED|PUBLISHED, `@@unique([topicId,kind])`, editedByTeacher,
  approvedBy), Quiz (passThreshold, maxAttempts), Question (options/explanation Json,
  correctIndex, difficulty RECALL|UNDERSTAND|APPLY, sourceFragment), ClinicalCase
  (caseJson, format SHORT|EXTENDED). AI: `ai/prompts/quiz.ts` + `case.ts`
  (+ responseSchema/zod `types.ts`) — FAQAT tasdiqlangan konspektdan. Backend
  content module (`apps/api/src/modules/content/`): generate routes topics router'ida
  (`POST /topics/:id/generate/{quiz,case}` — konspekt tasdiqlanmasa **403
  digest_not_approved**), `/api/v1/content/:id` (GET/PUT[editedByTeacher=true]/
  approve). Topic detail'da `content[]` xulosasi. Frontend: Generatsiya bo'limi
  4 karta (Test/Keys ishlaydi — savol soni/qiyinlik/til, format/til sozlamalari;
  Prezentatsiya/Video "tez orada"); Test tahrirlagichi `/teach/content/:id`
  (savol/variant/izoh, to'g'ri javob yashil, qiyinlik badge, o'z savoli, o'tish
  balli); Keys tahrirlagichi (bloklar + savol-etalon juftliklari). Real Gemini
  bilan tekshirildi (5 MCQ + klinik keys, o'zbekcha, tibbiy to'g'ri, manbadan).

- **Modul 8 — O'qituvchi: Prezentatsiya + Rasmlar (kod tayyor; real rasm pulli
  kalitni kutmoqda).** Prisma: Presentation (contentItemId unique, slidesJson,
  pptxUrl?, pdfUrl?, templateId?). AI: `ai/prompts/slides.ts` (konspektdan slayd
  strukturasi — layout TITLE/TWO_BLOCK/THREE_BLOCK/BODY_DIAGRAM/IMAGE_LEFT/BULLETS,
  NotebookLM uslubi), `ai/prompts/images/` (Nano Banana Pro prompt shablonlari,
  layout+til bo'yicha), `gemini.ts::generateImage` (gemini-3-pro-image-preview,
  responseModalities:["IMAGE"], usage log). Slaydda barqaror `id` (tahrirda rasm
  saqlanadi). Backend content module: `POST /topics/:id/generate/presentation`
  (konspekt approved shart), `/api/v1/presentations/:id/{generate-images,
  regenerate-image/:s/:slot,image/:s/:slot [media], pptx, pdf}`. Rasm generatsiyasi
  fon-job (setImmediate, slot status PENDING→PROCESSING→DONE/ERROR, 2s polling).
  Eksport: **pptxgenjs** (redaktlanadigan PPTX, brend shabloni) + **pdfkit**.
  Frontend: Prezentatsiya kartasi + tahrirlagich (`PresentationEditor`: slayd
  ro'yxati, sarlavha/tezis/izoh tahrir, rasm sloti preview+qayta-chizish, slayd
  o'chirish, PDF/PPTX yuklab olish). Slayd+PPTX+PDF **tekshirildi** (matn kaliti);
  fon-job 429'ni ERROR bilan to'g'ri boshqaradi. ✅ **Pulli kalit ulandi — real
  Nano Banana Pro rasmlari ishlaydi va tekshirildi** (uz-labelli, callout'li,
  textbook-atlas darajasi). `ai/prompts/images/index.ts` yangilandi: promptlar
  endi bezak emas — **tushuntiruvchi belgilangan tibbiy diagramma** (BASE_STYLE:
  flat-vector atlas, callout chiziqlar, rang-kodlash ko'k=kislorodsiz/qizil=kislorodli;
  slayd bullet'lari label sifatida promptga uzatiladi). `slides.ts` imagePrompt
  qoidasi batafsillashtirildi (NIMA chizilishini konkret yozadi). Sifat: yurak
  kesimi 12 raqamli callout bilan — NotebookLM darajasidan yuqori.

- **Modul 9 — O'qituvchi: Video generatsiya (tayyor).** TTS (dastlab **edge-tts**,
  hozir **Gemini native TTS** — pastdagi PREMIUM overhaul'ga qarang; edge-tts endi
  faqat fallback: uz-UZ-Madina/Sardor, ru-RU-Svetlana/Dmitry). Prisma: Video (scriptJson, audioUrl?,
  mp4Url?, srtUrl?, durationSec?, voiceId?, buildStatus PENDING|SCRIPT|TTS|RENDER|
  DONE|ERROR, errorStage?). AI: `ai/prompts/videoScript.ts` (slaydlardan so'zlashuv
  uslubidagi narration — slaydni o'qib bermaydi). Pipeline (`modules/content/
  video.ts`, fon-job setImmediate, bosqichma-bosqich, idempotent): SCRIPT (Gemini)
  → TTS (edge-tts per segment, `lib/exec.ts` python child_process, SRT'dan
  davomiylik) → RENDER (slayd→PNG `sharp`+SVG, ffmpeg concat + audio → MP4, SRT).
  Har bosqich alohida saqlanadi; rebuild SCRIPT'ni o'tkazib TTS+RENDER qayta
  ishlaydi. Backend: `POST /topics/:id/generate/video` (prezentatsiya yo'q →
  400), `/api/v1/videos/:id/{rebuild,mp4,srt}`, PUT content (skript tahriri).
  Frontend: Video kartasi (til/ovoz, bosqichli progress Skript→Ovoz→Montaj);
  Video tahrirlagich (`VideoEditor`: pleyer+VTT subtitr, skript textarea'lar,
  "qayta ovozlash va montaj", MP4/SRT yuklab olish). **To'liq tekshirildi**:
  real MP4 (H.264 1920x1080 + AAC) + SRT, narration tabiiy o'zbekcha va
  so'zlashuv uslubida. `lib/exec.ts` (FFMPEG_PATH). ffmpeg+edge-tts+sharp server'da
  bo'lishi shart (prod eslatma). ✅ **Video yaxshilandi (NotebookLM Video Overview
  uslubi):** leksiya kartalari endi sof matn emas — `points`/`term` segmentlari
  RENDER paytida **Nano Banana Pro tibbiy illyustratsiya** oladi (o'ngda diagramma,
  chapda tezislar). `imagePromptForVisual` (segment title+points'dan), rasm
  `visualImageUrl`da keshlanadi (rebuild qayta yaratmaydi, narration tahriri
  saqlaydi), video boshiga `MAX_VIDEO_IMAGES` cheklovi (xarajat), har rasm
  xatosi/429 → toza matn kartaga graceful fallback. `title`/`warning` — matn
  kartada qoladi.
  ✅✅ **PREMIUM overhaul (foydalanuvchi: ovoz "trash", rasm "yo'q", qisqa):**
  (1) **OVOZ** — edge-tts o'rniga **Gemini native TTS** (`gemini-2.5-flash-preview-tts`,
  Kore/Charon studiya ovozlari, `gemini.ts::generateSpeech` PCM→WAV, har segment
  24kHz mono, aac 192k; edge-tts faqat fallback). (2) **MATN** — `videoScript.ts`
  v3 promptи chuqurroq (4-7 jumla/segment, 12-16 segment) + `generateStructured`
  `thinking:true` → ~59 so'z/segment, ~4 daqiqa (ilgari ~2). (3) **RASM** — kichik
  yon rasm o'rniga **HERO layout** (`renderVisualPng`: sarlavha paneli + katta
  markazlashgan diagramma), `MAX_VIDEO_IMAGES=18`. (4) **KIRIL IMLO tuzatildi** —
  rasm modeli ko'p yorliqda Kirilni buzardi; `images/index.ts` endi KAM (4-5),
  QISQA (1-2 so'z), imlosi aniq yorliq so'raydi → to'g'ri ("Атипичные клетки",
  "Микрокальцинаты", "Базальная мембрана"). **Tekshirildi (topic 43, ru):**
  script→TTS→render→DONE, aac audio, HERO kadrlar, dozalar amber karta, imlo to'g'ri.

  **Modul 20 Faza 2 — 4-bosqichli rol ierarxiyasi:** Prisma `Role` enum += SUPERADMIN/
  FACULTY_ADMIN/DEPT_ADMIN (`ADMIN` deprecated qoldi — Postgres enum-drop kerak emas;
  migratsiya `role_hierarchy`, seed admin→SUPERADMIN). `User.facultyId?`+`adminDepartmentId?`
  (admin scope). RBAC: `middleware/adminScope.ts` (`ADMIN_ROLES`, `adminScope(req)` — user
  rowdан scope, JWTдан emas → demotion darrov; `assertFacultyScope`/`assertDeptScope`).
  Scope hamma admin route'da: **org** (faculty CUD=SUPER; dept=fakultet-admin o'z fakulteti;
  subject=kafedra-admin o'z kafedrasi; group=fakultet darajasi), **users** (`CREATABLE` map
  per tier + `assertUserInScope`; yuqori tierni boshqara olmaydi; import=SUPER only),
  **courses** (subject dept scope), **tasks** (kafedra-admin faqat o'z kafedra o'qituvchisi),
  **admin router** (stats/search/ai-usage/quotas fakultet/kafedra scoped; audit=SUPER only;
  quota-set fakultet-admin o'z fakulteti). Frontend: `lib/auth` 6 rol + `ADMIN_ROLES`,
  App guard barcha admin tier, AdminShell audit faqat SUPER, `UserFormModal` tier'ga qarab
  yaratsa bo'ladigan rollar (+fakultet picker), UsersPage filtr+badge, AccountSettings role
  yorliqlari. **e2e 12/12 (4 rol login):** fakultet-admin fakultet ocholmaydi(403)/o'z
  fakultetida kafedra ochadi(201)/audit(403); kafedra-admin kafedra ocholmaydi(403)/o'z
  kafedrasida o'qituvchi ochadi(201)/fakultet-admin ocholmaydi(403)/subjects=o'z kafedra;
  SUPER audit(200). tsc+build toza. **Faza 3 (kafedra-markazlashgan kontent) — keyingi.**

- **Modul 10 — Faktcheck + Chop etish (ikkinchi qulf) + Kurs sozlamalari (tayyor).
  O'qituvchi tomonining YAKUNI.** Prisma: ContentItem += factcheckFlagsJson,
  factcheckStatus (NONE|CHECKING|FLAGGED|CLEAN|RESOLVED), factcheckedAt;
  Course.defaultUnlockRuleJson; AuditLog. AI: `ai/prompts/factcheck.ts` — kontentni
  ASL manba bilan solishtiradi, manbada YO'Q da'volarni belgilaydi (dozalar=high).
  Backend (content router): `POST /content/:id/factcheck` (Gemini, contentToText
  per-kind + collectSource), `/factcheck/resolve {flagIndex, confirmed|fixed}`,
  `/publish`. **Ikkinchi qulf — backend TEKSHIRADI:** publish = digest approved +
  reviewOpenedAt (GET content'da o'rnatiladi) + factcheck CLEAN/RESOLVED, aks holda
  403 aniq kod. Publish → PUBLISHED + approvedBy/At + AuditLog (kim/qachon/flagCount).
  **Kontent tahrirlansa** → factcheck reset (NONE) va PUBLISHED/APPROVED → DRAFT
  (tibbiy xavfsizlik). Qisman chop etish (har ContentItem alohida). Settings:
  `PUT /teach/courses/:id/settings`, `PUT /topics/:id/unlock-rule` (null=default).
  Frontend: konstruktor 4-bo'lim Faktcheck (per-kontent run/flags/Tasdiqlayman/
  Tuzataman), 5-bo'lim Chop etish (checklist + "Tasdiqlash va chop etish" + tasdiq
  modal + "Tekshirdi: FISH, sana"); Sozlamalar tabi (`UnlockRuleForm`) + mavzu
  override (`TopicUnlockRule`). **To'liq tekshirildi**: soxta doza → high flag,
  publish gate to'g'ridan-to'g'ri API'da 403, edit approvalni bekor qiladi.
  Butun oqim: material→konspekt→⛔tasdiq→generatsiya→tahrir→faktcheck→⛔chop etish.

- **Modul 11 — Talaba: bosh sahifa + mavzu yo'li (tayyor). Talaba tomonining
  BOSHI.** Prisma: `Progress` (studentId, topicId, state LOCKED|AVAILABLE|
  IN_PROGRESS|COMPLETED, videoWatchedPct, completedAt; @@unique studentId+topicId).
  **Ketma-ket ochilish dvigateli** `modules/me/rules.ts` (sof funksiyalar):
  `evaluateRule(facts, rule)` — Topic.unlockRuleJson ?? Course.defaultUnlockRuleJson
  ?? DEFAULT (video%≥, quiz%≥, keys, sana, AND/OR), qisman progress `pct`
  (video 45/80 hisobga olinadi), `lockedReason` — o'z sanasi yoki OLDINGI mavzu
  birinchi bajarilmagan sharti (aniq: "Oldingi mavzu: videoni 80% koʻring").
  `service.ts::computeTopics` — mavzular tartibda, N ochiq faqat N-1 COMPLETED bo'lsa.
  **Talaba faqat PUBLISHED kontentli mavzuni ko'radi** (published content'siz mavzu
  umuman ko'rinmaydi — `loadCourse` filtri). Backend (`requireRoles STUDENT`):
  `GET /me/dashboard` (salom + resume + kurslar), `/me/courses`, `/me/courses/:id`
  (mavzular state/pct/reason/elements bilan; yozilmagan kurs → 403). Quiz/keys
  fakti hozircha yo'q (Modul 12 attempt'lar qo'shadi) → hozir #1 AVAILABLE,
  qolganlari LOCKED. Frontend (mobil-birinchi): `StudentDashboard` (salom, brend-
  gradient "Davom ettirish" bloki, kurs kartalari progress bilan), `CoursePath`
  (`/app/courses/:id` — timeline nuqta+chiziq, 3 holat: TUGALLANDI emerald /
  JORIY brand+soya+progress / YOPIQ kulrang+amber sabab, element chiplari
  video✓/test%/keys). `/app/topics/:id` — Modul 12 dars sahifasi uchun halol
  placeholder. **To'liq tekshirildi**: dvigatel (to'g'ridan-to'g'ri service +
  HTTP e2e real talaba login), ketma-ketlik, aniq sabablar, published-only,
  cross-student 403, tsc+build toza. Dev demo: student@meduni.uz / student123.

- **Modul 12 — Talaba: mavzu o'tish (tayyor). Talaba tomonining YURAGI.** Prisma:
  QuizAttempt (answersJson, scorePct, passed, attemptNo, finishedAt?), CaseAttempt
  (answersJson, submittedAt, teacherFeedback?, score?, reviewedBy?/At?; @@unique
  studentId+caseId), Progress += slidesViewed, videoPositionSec. **Modul 11
  dvigateliga real faktlar ulandi**: `studentFactsMap` endi eng yaxshi quiz balli,
  keys topshirilishi/tekshirilishi, slaydlar ko'rilishini o'qiydi (ilgari null edi)
  → mavzu haqiqatan COMPLETED bo'lib keyingisini ochadi. Backend `modules/me/lesson.ts`
  (STUDENT): `GET /me/topics/:id` (to'liq dars payload — 4 tab, faqat PUBLISHED,
  LOCKED bo'lsa **assertTopicOpen 403 topic_locked**), `POST /topics/:id/{video-
  progress[monoton watchedPct+pozitsiya], slides-viewed}`, quiz: `POST /quizzes/:id/
  attempts` (in-progress bo'lsa **o'shani qaytaradi=resume**, maxAttempts tugasa
  **403 quiz_max_attempts**), `PUT /attempts/:id/answers` (avtosave, yakunlangan→403),
  `POST /attempts/:id/finish` (avto-baho scorePct/passed), `GET /attempts/:id`
  (**izoh/to'g'ri javob faqat finishedApidan keyin**, jarayonda yashirin), keys:
  `POST /cases/:id/attempts` (topshirish, takror→409 case_already_submitted, etalon
  javob **faqat topshirgach ochiladi**), `GET /case-attempts/:id`; media: `GET /me/
  {videos/:id/mp4|srt, presentations/:id/{image,pdf}}` (published+enrolled+unlocked
  tekshiruvi, `buildPdf` presentation.ts'dan ajratildi). Har harakatdan keyin
  `persistAndReport` Progress.state/completedAt ni yangilaydi (Modul 13 heatmap uchun).
  Frontend `/app/topics/:id` (`lesson/LessonPage` + 4 tab, mobil-birinchi, ?tab= URL,
  default=birinchi bajarilmagan tab): VideoTab (pleyer, %kuzatuv 5s, pozitsiya-resume,
  SRT→VTT subtitr), SlidesTab (swipe, PDF, oxirgi slayd→ko'rildi), QuizTab (kirish
  ogohlantirish→jarayon avtosave→natija+**izohli tahlil**: to'g'ri yashil/xato rose/
  izoh blue), CaseTab (bloklar→javob→topshirish tasdiq→etalon+baho/tekshiruvda).
  Ranglar: video=violet, prezentatsiya=brand, test=blue, keys=rose. **To'liq
  tekshirildi**: 23/23 HTTP e2e (real talaba) — LOCKED→403, izoh yashirin/ochiq,
  avtosave+resume, baho 67%o'tdi, quiz-bir-marta→403, etalon topshirgach, cascade
  T1→T2 ochildi, cross-student→403; tsc+build toza. Dev demo: student@meduni.uz/
  student123 (T1 slides+test+keys to'liq ishlaydi). ⚠️ Demo'да real video/mp4 yo'q
  (Modul 8/9 generatsiyasi kerak) — video tab "mavjud emas" ko'rsatadi.

- **Modul 13 — O'qituvchi: progress heatmap + dashboard (tayyor).** Prisma: Progress
  += overriddenAt/overriddenById (qo'lda ochish override). **Override umumiy
  dvigatelga ulandi** (me/service): `FullFacts.forceComplete` → `computeTopics` uni
  COMPLETED deb hisoblaydi, ya'ni override **talabaning o'z ko'rinishida ham** keyingi
  mavzuni ochadi (tekshirildi). me/service'dan `loadCourse/computeTopics/FullFacts/
  CourseWithTopics` eksport qilindi (qayta ishlatish). Backend `modules/courses/
  progress.ts` (TEACHER, o'z kursi): `GET /teach/courses/:id/progress` — talaba×mavzu
  matritsasi bir necha **batch** so'rovда (progress+quiz+case attempts), har talaba
  uchun `computeTopics` bilan cells (state/pct/elements) + overallPct + lastActiveAt
  + avgQuizScore + **behind** (guruh o'rtachasidan 30%+ past YOKI 7+ kun harakatsiz);
  `POST /teach/courses/:id/unlock {studentId,topicId}` (override→COMPLETED + AuditLog
  MANUAL_UNLOCK); `GET /teach/courses/:id/progress/export?view=heatmap|list`
  (**exceljs** xlsx); `GET /teach/dashboard` (kurslar+avgProgress + tasks:
  casesToReview[reviewedAt=null], contentToApprove[DRAFT/REVIEW], studentsBehind).
  ⚠️ Yangi teach route'lar org-router'dan OLDIN (teachCoursesRouter'da). Frontend:
  `ProgressTab` (Modul 4 placeholder o'rnida) — 5 stat karta (filtr), qidiruv/saralash
  (orqadagilar tepada), **Heatmap** (chap ustun **sticky**, rangli kataklar
  emerald/amber/kulrang, guruh o'rtacha qatori, hover tooltip, katak→talaba modali) /
  **Ro'yxat** ko'rinishi, talaba modali (mavzu×element + **"Qo'lda ochish"**), Excel;
  `TeachDashboard` — salom+sana, **vazifalar bloki** (3 rangli karta yoki emerald
  "hammasi bajarilgan"), kurs kartalari avg-progress bilan. `/teach/review` — Modul 14
  uchun halol placeholder. **To'liq tekshirildi**: 16/16 HTTP e2e — matritsa/stats,
  behind aniqlash, override cascade (+student ko'rinishiga yetib boradi), AuditLog,
  dashboard tasks, ownership 403, xlsx eksport; tsc+build toza. Dev demo (boyitilgan):
  teacher.m11demo@meduni.uz/student123 — 6 talaba turli progressда, 1 keys tekshiruvда,
  1 draft, 1 orqada (harakatsiz).

- **Modul 14 — O'qituvchi: keys tekshiruv navbati (tayyor). O'quv zanjiri YOPILDI.**
  Schema o'zgarmadi (CaseAttempt Modul 12'dan; reviewedAt null/notNull = holat).
  me/service refaktor: `persistAndReport` → eksport `syncTopicProgress` (recompute+
  Progress persist) — lesson va review baholash ikkalasi ishlatadi; `getDashboard`ga
  **notifications** qo'shildi (oxirgi baholangan keyslar). Backend `modules/courses/
  review.ts` (TEACHER, o'z kursi): `GET /teach/cases/review` (BARCHA kurslardan keys
  javoblari — filtr: courseId/topicId/status[def PENDING]/search[insensitive]/
  sort[def **oldest=adolatli FIFO**]), `GET /teach/cases/filters` (dropdownlar uchun
  kurs/mavzu), `GET /teach/cases/:id` (keys sharti+javob+etalon+baho), `POST /teach/
  cases/:id/review {score[0-100],feedback}` — reviewedBy/At yozadi, **caseReviewedRequired
  bo'lsa `syncTopicProgress` mavzuni tugatadi va keyingisini ochadi**, qayta baholash
  ruxsat (AuditLog RE_REVIEW_CASE prev/new bilan). ⚠️ `/cases/review` va `/filters`
  route'lar `/cases/:id`dan OLDIN. Frontend `/teach/cases/review` (`CaseReviewQueue`,
  ikki panel): chapда filtr+navbat kartalari (talaba/kurs-mavzu/vaqt/holat pill),
  o'ngда tekshirish — **yig'iladigan keys sharti** + **javob||etalon yonma-yon** (sm:2
  ustun) + baho(0-100)+izoh+**tez shablon chiplari**(uz/ru)+**"Saqlash va keyingisi"**
  (avto keyingi PENDING'ga o'tadi)/"Saqlash"/"O'tkazib yuborish"; mobilда navbat→javob
  to'liq ekran; bo'sh navbat ijobiy emerald xabar. Talaba dashboard'да
  **bildirishnomalar** (keys bahosi keldi → keysga link). Dashboard "keys kutmoqda"
  → shu yerga. **To'liq tekshirildi**: 18/18 HTTP e2e — navbat/filtrlar/oldest,
  javob+etalon, ownership 403, baho→talaba ko'radi+notification, caseReviewedRequired
  cascade (T1 COMPLETED→T2 ochildi), qayta baholash audit, ball validatsiya; tsc+build
  toza. Demo: teacher.m11demo@meduni.uz/student123 — 3 keys tekshiruvда.
  **Zanjir yopildi**: talaba topshirdi→o'qituvchi baholadi→talaba ko'rdi→mavzu tugadi→
  keyingisi ochildi.

- **Modul 15 — O'qituvchi: Yo'qlama (tayyor).** Kurs karkasining "Darslar" tabi
  (Modul 4 placeholder o'rnida). SODDA, qo'lда belgilanadi — **QR YO'Q**. Prisma:
  `LessonSession` (courseId, topicId?, date, title?, room?, createdBy),
  `Attendance` (sessionId, studentId, status PRESENT|ABSENT|LATE|EXCUSED, markedBy,
  markedAt@updatedAt; @@unique sessionId+studentId), `AttendanceStatus` enum.
  Backend `modules/courses/attendance.ts` (TEACHER, o'z kursi): sessions CRUD
  (`GET/POST /teach/courses/:id/sessions` [from/to/search], `PATCH/DELETE
  /teach/sessions/:id` — o'chirish Attendance'ni ham o'chiradi), `GET /teach/
  sessions/:id/roster` (ACTIVE talabalar + joriy status + guruh nomi), `POST
  /teach/sessions/:id/attendance {marks[]}` (**bulk upsert** + AuditLog
  MARK_ATTENDANCE), `GET /teach/courses/:id/attendance-report` (talaba×dars
  matritsasi + jamlanma + **davomat% = (present+late)/marked**), `.xlsx` eksport
  (matrix|list, **exceljs**). session ro'yxatда markedCount/rosterSize/status
  (UNMARKED|PARTIAL|FULL). Teacher dashboard'ga **upcomingSessions** qo'shildi
  (Modul 13 va'dasi). ⚠️ `.xlsx` route `/attendance-report`dan OLDIN; `/sessions/:id/
  {roster,attendance}` `/sessions/:id`dan OLDIN. Frontend `SessionsTab` — ikki
  ички-tab (?sub=): **Darslar** (sana oralig'i[def joriy oy]+qidiruv+Excel+
  "Yangi dars"; jadval Sana|Mavzu|Xona|Belgilangan|Holat pill|amallar; session
  modali [sana majburiy, matn YOKI mavzudan, xona]; **yo'qlama modali** — "Hammasini
  Keldi" tez tugma + 4 rangli status tugma per talaba [Keldi=emerald/Kelmadi=rose/
  Kechikdi=amber/Sababli=blue] + qidiruv + "X/Y belgilandi"; o'chirish tasdig'i) +
  **Hisobot** (matrix[chap ustun **sticky**, K/KM/KCH/S rangli belgi, oxirgi ustun
  kelmadi]|list[per-status sanoq + davomat% **<75 rose**, saralash]). **To'liq
  tekshirildi**: 21/21 HTTP e2e — sessions CRUD, roster, bulk mark, re-mark+audit,
  report% (late=keldi), ownership 403, ikkala xlsx, delete cascade; tsc+build toza.
  Demo: teacher.m11demo@meduni.uz/student123 — 3 dars (1 topic-linked, 1 partial),
  6 talaba turli davomatда (Fayzullaev 0%, Bobojonov 33%).

- **Modul 16 — Talaba: davomat + profil (tayyor). Talaba tomoni TO'LIQ.** Schema
  o'zgarmadi. Backend `modules/me/profile.ts` (STUDENT, faqat o'ziniki): `GET /me/
  attendance?courseId=&from=&to=` (faqat **studentId=me** yozuvlari → cross-student
  imkonsiz; stats present/absent/late/excused + **pct=(present+late)/marked** — Modul
  15 hisoboti bilan bir xil formula; sessions ro'yxati sana/kurs/mavzu/status),
  `GET /me/profile` (FISH/email/telefon/guruh + xulosa: coursesCount/completedTopics/
  attendancePct), `PUT /me/locale {locale}` (uz|ru validatsiya), `POST /me/change-
  password {oldPassword,newPassword}` (eski argon2.verify → xato 400 wrong_old_password;
  yangi <6 → 400 password_too_short → argon2.hash). Frontend (mobil-birinchi):
  `AttendancePage` (`/app/attendance`) — katta % (‹75 **rose** + amber ogohlantirish
  "xabardor qiladi, qo'rqitmaydi"), 4 rangli breakdown karta, kurs+sana filtri, dars
  ro'yxati rangli status belgi bilan; `ProfilePage` (`/app/profile`) — shaxsiy karta
  (o'zgartirib bo'lmaydi + "admin o'zgartiradi" izohi), o'qish xulosasi (3 tile —
  **XP/badge/reyting YO'Q**), sozlamalar (til **segmented → i18n.changeLanguage darrov**,
  parol o'zgartirish: eski/yangi/tasdiq + validatsiya), Logout. StudentShell nav'ga
  Davomat+Profil qo'shildi. **To'liq tekshirildi**: 18/18 HTTP e2e — davomat stats/pct,
  **own-only** (har talaba faqat o'zini), sana filtri, profil xulosa, locale persist+
  validatsiya, uch parol validatsiyasi, role guard (o'qituvchi→403); tsc+build toza.
  Demo: student@meduni.uz/student123 — 2 dars (PRESENT+LATE=100%). **Talaba tomoni
  tugadi**: bosh sahifa → mavzu yo'li → mavzu o'tish → davomat → profil.

- **Modul 17 — Admin: Lug'at + Shablon + AI monitoring + Audit (tayyor). YAKUNIY.**
  Prisma: Glossary (departmentId, termRu/Uz/Lat?, approved, @@unique dept+termRu),
  PresentationTemplate (name, colorsJson, logoUrl?, isDefault), AiQuota (departmentId
  unique, monthly{Token,Image,Cost}Limit); **AiUsage refactor** (+ departmentId?/userId?/
  images/ttsChars/costUsd). **AI qatlam refaktori (MUHIM):** `ai/glossary.ts`
  (getGlossaryForDepartment + `glossaryBlock` — "Цирроз = Sirroz (Cirrhosis)" MAJBURIY
  bloki, departmentForTopic), `ai/usage.ts` (recordAiUsage — cost bilan), `ai/cost.ts`
  (gemini narx ~), `ai/quota.ts` (assertQuota — oylik limit oshsa **403 quota_exceeded**).
  **Har generatsiya** (digest/quiz/case/slides/video/factcheck/image) endi: dept aniqlaydi
  → assertQuota → glossaryni systemInstruction'ga qo'shadi → recordAiUsage(dept/user/cost).
  Backend `modules/admin/`: glossary CRUD+import[exceljs] (ADMIN+TEACHER — teacher o'z
  kafedrasiga pinned), templates CRUD+set-default (ADMIN), monitoring (ai-usage agregat
  byDept/byKind, quotas GET/PUT+audit), audit (filtr actor/action/entity/sana+pagination),
  stats (counts+attention+aiThisMonth+activity). Mount: `/glossary`,`/templates`,`/admin`
  org-router'dan OLDIN. Audit loglar qo'shildi: CREATE_USER/ACTIVATE/DEACTIVATE (users
  router), UPDATE_QUOTA. Frontend: **AdminDashboard** to'ldirildi (5 stat karta — ikonka+
  rang+izoh, bosiladi; "diqqat talab qiladi" bloki; AI gradient karta; 7-kun faollik —
  **quruq raqam EMAS**), `/admin/glossary` (kafedra+qidiruv+qo'shish+jadval+Excel import),
  `/admin/templates` (kartalar+rang tanlash+**preview namuna slayd**+set-default),
  `/admin/ai` (gradient jami+tur bo'yicha+kafedra jadvali kvota progress[80%amber/100%rose]+
  kvota modal), `/admin/audit` (filtr+jadval+rangli action pill+JSON detal modal+pagination).
  AdminShell nav + 4 sahifa. **To'liq tekshirildi**: 27/27 HTTP e2e — glossary CRUD+409,
  **glossaryBlock AI promptga MAJBURIY qo'shiladi**, teacher scoping, templates default flip,
  usage agregat+cost, **quota 403**, audit (CREATE_USER/UPDATE_QUOTA), stats, role guardlar;
  tsc+build toza. Demo: admin@meduni.uz/admin123 — 5 atama, 2 shablon, 7 usage yozuvi, kvota.

**PLATFORMA TUGADI.** Butun zanjir: admin quradi → o'qituvchi material→AI(konspekt/test/
keys/slayd/video, lug'at bilan)→tekshir→⛔tasdiq→⛔chop et → talaba ketma-ket o'qiydi→
test/keys topshiradi → o'qituvchi baholaydi/progress/yo'qlama → admin sarf/kvota nazorat.
Ikki qulf + faktcheck tibbiy xavfsizlik. ⚠️ Pilotdан oldin: GEMINI_API_KEY yangilash;
Modul 8 real Nano Banana Pro rasmlari pulli kalitni kutmoqda.

Barcha modullar tugadi (1-17).

- **Modul 18 — Mening vazifalarim (tayyor).** "Keys tekshirish" navi barcha rollar
  uchun vazifalar markaziga almashdi. Prisma: `Task` (TaskStatus OPEN|DONE|DISMISSED,
  TaskPriority, batchId — guruh/kafedra fan-out, createdBy/assignedTo). Backend
  `modules/tasks/`: `computeTeacherAutoTasks` (8 tur: keys tekshirish, material yo'q,
  konspekt tasdiqlash, kontent yaratish/chop etish, faktcheck, yo'qlama belgilanmagan,
  orqada qolganlar — mavjud loadCourse/buildMatrix/computeTopics'dan jonli hisoblanadi,
  saqlanmaydi), `computeStudentAutoTasks` (5 tur: davom ettirish, test, keys, baho keldi,
  past davomat<75%), qo'lда topshiriqlar CRUD (`createTask` yo'nalish validatsiyasi:
  ADMIN→o'qituvchi/kafedra, TEACHER→o'z talabasi/guruhi, aks holda 403; `setTaskDone`
  faqat assignee; `deleteTask` faqat creator+butun batch). Router `/api/v1/tasks`
  (mine=GET /teach/tasks + /me/tasks → {auto,assigned}, /tasks/created, POST/PATCH/
  DELETE). Frontend: `/teach/tasks` (kafedra topshiriqlari + avto kartalar deep-link
  bilan [wizard ?step=, review, progress] + "Yangi topshiriq" modal guruh/talaba +
  "Men bergan" k/N) · `/app/tasks` (o'qituvchi topshiriqlari + avto o'quv vazifalari) ·
  `/admin/tasks` (o'qituvchi/kafedraga tayinlash + k/N ro'yxat). Umumiy komponentlar:
  `TaskCard`, `AssignedTaskList`, `CreatedTaskList`. Nav badge = ochiq vazifalar.
  `/teach/cases/review` sahifasi qoladi (avto-kartadan ochiladi). **To'liq tekshirildi**
  (e2e real login): avto hisob (teacher 4 tur, student 3 tur), admin→o'qituvchi→
  bajarildi→1/1, o'qituvchi→guruh fan-out 6 talaba→1/6, begona guruh/vazifa→403,
  talaba yarata olmaydi→403; tsc+build toza.

- **Modul 19 — UX: lug'at o'chirildi · global qidiruv · diagrammalar · boy profillar
  (tayyor).** (A) **Lug'at BUTUNLAY olib tashlandi** (foydalanuvchi qarori): nav/route/
  sahifalar, glossaryRouter, `modules/admin/glossary.ts`, va **barcha 5 AI generatsiya
  joyidan** glossaryBlock injektsiyasi. `ai/glossary.ts`da faqat `departmentForTopic`
  qoldi (kvota/AiUsage). Prisma `Glossary` jadvali bazada qoladi (kod ishlatmaydi).
  (B) **Global qidiruv (tepada sticky, 3 rol):** `modules/search/service.ts` —
  `teacherSearch` (O'Z talaba/guruh/kursi — enrollment/courseGroup/teacherId scoping),
  `adminSearch` (butun universitet), `studentSearch` (o'z kurs+published mavzular);
  route'lar `/teach|/admin|/me` + `/search`. `packages/ui/SidebarLayout` ga `headerSlot`,
  `components/GlobalSearch.tsx` (Ctrl+K, 300ms debounce, kategoriyalangan dropdown,
  klik→profil). Wizard stepper `top-[57px]`ga tushdi. (C) **Bosh sahifa (o'qituvchi)
  redizayn:** yangi `packages/ui/Charts.tsx` (ProgressRing/ProgressBar/BarRow/StackedBar
  — sof SVG, token-rangli, dark-mode). TeachDashboard: 4 tez-o'tish kartasi + ANALITIKA
  (3 ring + kurs BarRow'lar + **bosiladigan** guruh chiplari). Backend `getTeacherDashboard`
  `stats.groupList {id,name}[]`. (D) **Guruh profili:** `getTeacherGroup` buildMatrix
  reuse → per-student overallPct/avgQuizScore/attendancePct/lastActiveAt/behind + guruh
  agregatlari; UI 4 metrik-karta + boy talaba qatorlari (bar/pill/badge, orqada qolganlar
  tepada). (E) **Talaba profili:** hero ProgressRing + davomat StackedBar + per-topic
  pct bar + baholanmagan keysга "Baholash→". **Tekshirildi (e2e):** 3 rol qidiruv +
  ownership/403, guruh payload matritsa bilan mos (avgProgress 17/behind 1); tsc+build toza.

- **Modul 20 — Admin overhaul (Faza 1: shablonlar o'chirildi + AI-audit boyitildi).**
  **Reja:** admin tomoni 4-bosqichli ierarxiyaga o'tadi (SuperAdmin→Fakultet-admin→Kafedra-
  admin→O'qituvchi; Faza 2) va kontent kafedra-markazlashadi (Topic→subjectId; Faza 3) —
  `.claude/plans/`da. (A) **PresentationTemplate BUTUNLAY olib tashlandi** (dekorativ edi —
  templateId hech qayerda ishlatilmasди, eksport ranglarni hardkod qiladi): nav/route/
  `pages/admin/templates/`, `modules/admin/templates.ts`+`templatesRouter`, `admin/api.ts`
  hooklari, `templates` i18n, `genPresSchema`/`generatePresentation`dan templateId. Prisma
  `PresentationTemplate`+`Presentation.templateId` bazада qoladi (kod ishlatmaydi). (B)
  **AI-audit (`/admin/ai`) boyitildi:** `monitoring.ts::getAiUsage` endi oyning barcha
  yozuvlarini olib JSда agregat qiladi → `byDay` (31-kun timeline), `byModel`, `byUser`
  (top-8 o'qituvchi), `byKind` (cost), `byDept` (3 kvota-% token/image/cost), totals+ttsChars.
  Yangi `packages/ui/Charts.tsx::MiniBars` (vertikal timeline). Sahifa: oy tanlagich +
  gradient hero (4 metrik) + kunlik MiniBars + cost-by-kind/model RankRow + top-o'qituvchilar
  + kafedra jadvali (3 kvota-bar) + kvota modal. **Tekshirildi (e2e admin):** `/templates`→404,
  ai-usage 6 agregat real ma'lumot bilan (image=$1.16/jami $1.44, byUser, 31-kun); tsc+build toza.

- **Foydalanuvchilar sahifasi overhaul (2026-07-16, foydalanuvchi: "primitiv").** Backend
  `users/`: `GET /users/stats` (rol bo'yicha son + nofaol, admin-scope bilan), list filtrlari
  `facultyId`/`departmentId`/`active` qo'shildi (groupId bor edi), PATCH endi YANGI guruh/kafedra
  qiymatini ham scope'da tekshiradi (ilgari fakultet-admin talabani begona fakultet guruhiga
  ko'chira olardi), `updateUser` DEPT_ADMIN kafedrasini va FACULTY_ADMIN fakultetini o'zgartiradi.
  Frontend `/admin/users`: 5 **bosiladigan stat-karta** (rol filtri vazifasida, nofaol=rose),
  kaskadli filtr (fakultet→kafedra/guruh), **rolga moslashuvchan ustunlar** (talaba→guruh/fakultet/
  tel; o'qituvchi→kafedra/lavozim; adminlar→qamrov; aralash→rol+tegishlilik), FISH ostида email,
  tier ranglari to'g'irlandi (super=slate, fakultet=brand, kafedra=amber — ilgari 3 tier bir xil
  amber edi), profil-ko'z amali, jami hisob. `UserFormModal` **edit-bug fix**: rol endi to'g'ri
  aniqlanadi (ilgari admin rollar STUDENT deb yuborilardi → forma buzuq), edit'da rol badge
  (o'zgarmas), fakultet kaskadi formaда ham. i18n: `pageOf` `{page}`→`{{page}}` fix (interpolatsiya
  ishlamasди). **Tekshirildi:** 10/10 HTTP e2e (stats, 4 filtr, dept/faculty-admin PATCH,
  scoped stats, begona guruhga ko'chirish→403); tsc+build ikkala tomonda toza.
  ⚠️ Eslatma: auth router `/auth` prefiksida (`/api/v1/auth` EMAS) — e2e yozganда adashma.

- **Dizayn overhaul Faza 0 — Indigo Pro yadro (2026-07-16).** Reja:
  `.claude/plans/design-overhaul-2026-07.md` (5 faza; foydalanuvchi: yorug' tema,
  data bir til, palitra A tanlandi — artifact "MedUni — Palitra takliflari").
  (1) **Tokenlar**: teal→indigo (#4F46E5/#EEF2FF/#3730A3), blue→sky #0284C7,
  neytrallar yangilandi (4-bo'limga qarang), soyalar yumshatildi; dark blok mos
  yangilandi. Hardcode YO'Q edi — token almashinuvi butun frontendga o'z-o'zidan
  tarqaldi. (2) **Sidebar YORUG'** (oq surface + border-r, faol=indigo soft chip;
  RoleShell token-asosli — o'zgarishsiz moslashdi). (3) **StatCard umumiy komponentga**
  (packages/ui) — AdminDashboard/UsersPage/ProgressTab'dagi 3 nusxa o'chirildi
  (ProgressTab: active→selected, compact). (4) **Donut + LegendRow** Charts.tsx'ga
  (segmentlar orasида 2px oraliq — validator sharti). (5) EmptyState (+hint, katta
  ikonka), DataTable (thead bg-bg). (6) **Kontent eksportlari ham rebrend**:
  presentation.ts BRAND=4F46E5, video.ts slayd/HERO ranglari, rasm-prompt accent
  indigo (eski keshdagi media teal qoladi — qayta generatsiyada yangilanadi).
  tsc+build ikkala tomonda toza. **Keyingi: Faza 1 (bir tilli nomlar + keraksizlar auditi).**

- **Dizayn overhaul Faza 1 — bir tilli nomlar (2026-07-16).** Foydalanuvchi qarori:
  "fanlar nomini ikkita tilda kiritish keraksiz". **Data bir til, UI i18n (uz/ru) qoladi.**
  Prisma: Faculty/Department/Subject `nameUz`+`nameRu` → `name`, Topic `titleUz`+`titleRu`
  → `title` (2 ta QO'LDA yozilgan RENAME migratsiya — Prisma diff DROP+ADD qilardi, data
  saqlanib qoldi: name=nameUz). Unique indekslar mos yangilandi. Backend: org router
  sxemalari bitta `name`, topics router bitta `title` (oyna-mirroring mantiqlari o'chirildi),
  barcha payload'lar `subjectName/departmentName/facultyName/courseName/title/nextTopic`
  (Uz/Ru juftliklar yo'q); account `context` bitta. Frontend: structure formalarida bitta
  "Nomi" input, TopicsTab/TopicConstructor bitta sarlavha, `pickName` endi entity nomlari
  uchun ishlatilmaydi (faqat lib'da qoldi), 20+ sahifada ortiqcha locale/pickName tozalandi.
  ⚠️ `messageUz/messageRu` (xato xabarlari) va `errorUz/errorRu` (material parse xatosi) —
  UI ikki tilliligi, ATAYLAB saqlangan. **Tekshirildi:** 14/14 HTTP e2e (org CRUD bitta nom +
  409, users departmentName, qidiruv, teacher mavzu title CRUD, student dashboard/kurs yo'li);
  tsc+build ikkala tomonda toza. Migratsiya nomi: `single_language_names` +
  `single_language_topic_title`.

- **Dizayn overhaul Faza 1B — struktura tozalash (2026-07-17, foydalanuvchi tasdiqladi).**
  (1) **O'lik jadvallar DROP**: `glossary`, `presentation_templates`, `Presentation.templateId`
  (kod Modul 19/20'dan beri ishlatmasdi). (2) **Excel import olib tashlandi**: `/users/import`
  route + `users/import.ts` + `ImportModal` + hook/i18n (multer endi faqat materiallar
  yuklashда). (3) **Eski ADMIN roli enum'dan o'chirildi** — Postgres'da DROP VALUE yo'q,
  migratsiya enum'ni almashtiradi (Role_old→yangi Role, qolgan ADMIN qatorlar SUPERADMIN'ga).
  Kod: ADMIN_ROLES (api+web), adminScope, requireRoles ro'yxatlari, RoleFilter/roleTone,
  App guard, i18n'dagi admin/ADMIN kalitlar tozalandi (`userProfile.kind.admin` QOLDI —
  backend kind:"admin" qaytaradi). Migratsiya: `drop_dead_tables_and_admin_role`.
  **Tekshirildi:** 14/14 smoke qayta o'tdi (barcha rol loginlari, org CRUD, teacher/student
  oqim), import route auth bilan → 404; tsc+build toza.

- **Dizayn overhaul Faza 2 — admin redizayn (2026-07-17).** (A) **AdminDashboard qayta
  qurildi:** 4 stat-karta (kontent kartasi hint="N mavzuda") + **Donut "Universitet tarkibi"**
  (talaba/o'qituvchi/admin, useUserStats'dan) + **MiniBars "Faollik — 14 kun"** (kuniga faol
  talabalar, tooltip'da sana+kontent; 7 kunlik jamlanma footer'da) + attention kartalar
  (AttentionCard: ikonka-chip+son+chevron, 0 bo'lsa xira) + AI gradient karta ("Batafsil →").
  Backend `admin/stats.ts` += `activitySeries` (14 kun, progress+publish JSда kunlab
  agregat; ⚠️ dayKey MAHALLIY vaqtda — toISOString UTC'ga surar edi). (B) **Doimo ochiq
  add-formalar modalga ko'chirildi** (foydalanuvchi: "keraksiz joyda"): Tuzilma 4 tabи
  (fakultet/kafedra/fan/guruh — toolbar: filtr + "Jami: N ta" + o'ngда qo'shish tugmasi,
  forma Modal'да autoFocus bilan) va Kurslar sahifasi (sarlavha yonида tugma, forma
  max-w-2xl modal). i18n: `structure.countLabel`, adminHome yangi kalitlar (composition/
  timeline14/publishedIn/aiDetails...). tsc+build toza, /admin/stats smoke tekshirildi.

- **Dizayn overhaul Faza 3 — o'qituvchi (2026-07-17).** TeachDashboard/heatmap/keys-navbat
  Modul 19'da allaqachon boy edi (tokenlar bilan avtomatik yangi qiyofaga o'tdi) — asosiy
  qo'shimcha: **TopicsTab pipeline chiplari.** `listTopics` endi `digestState`
  ("approved"|"draft"|null) va `contentKinds` ({kind,status}[]) qaytaradi (TopicDetail'dagi
  `digest`/`content` bilan to'qnashmasin deb shunday nomlangan). Har mavzu qatorида 6 chip:
  Material N / Konspekt / Test / Keys / Slaydlar / Video — emerald=tayyor(published),
  amber=jarayonda, konturli=yo'q. Sarlavha bosilsa konstruktor ochiladi. i18n `topics.chip*`.
  Smoke: real teacher bilan tekshirildi. tsc+build toza.

- **Dizayn overhaul Faza 4 — talaba (2026-07-17). OVERHAUL YAKUNLANDI.** Talaba tomoni
  Modul 11-16'da mobil-birinchi qurilgan (tokenlar bilan avtomatik yangilandi) — qo'shimcha:
  **StudentDashboard umumiy holat paneli** (salom ostida): ProgressRing (kurslar bo'yicha
  o'rtacha %) + 3 tile — tugallangan mavzular (jami k/N), davomat % (<75 rose, useMyProfile'dan),
  kurslar soni. i18n `student.overall/summary*`. tsc+build toza, /me/profile smoke.
  **Barcha fazalar (0/1/1B/2/3/4) bajarildi** — reja `.claude/plans/design-overhaul-2026-07.md`.

- **Tuzilma → bitta DARAXT sahifa (2026-07-17, foydalanuvchi: "4 tab yoqmayapti").**
  Ierarxik ma'lumot yassi jadvallarda edi — endi Google Workspace org-unit uslubidagi daraxt.
  Backend: `GET /api/v1/structure/tree` (org router, scoped: SUPER=hamma, FACULTY=o'z
  fakulteti, DEPT=o'z kafedrasi) — fakultet→kafedra(→fan+courseCount, teacherCount)+
  guruhlar(studentCount) bir so'rovda. Frontend `StructurePage`: ochilib-yopiladigan daraxt
  (fakultet Card → kafedra qatorlari → fan qatorlari + "Guruhlar (N)" tuguni), har darajada
  son-chiplar, joyida qo'shish/tahrirlash/o'chirish (bitta generik modal + ConfirmDialog,
  409 HAS_CHILDREN xatosi dialogда ko'rinadi), rol-gating (fakultet CUD=super; kafedra/
  guruh=super+fakultet-admin; fan=uchchala tier). Yozuvlar tree + eski ro'yxat query'larni
  invalidate qiladi. Eski 4 tab + StructureLayout O'CHIRILDI, `/admin/structure/*` →
  redirect; `structure.*` i18n bo'limi yangidan yozildi (add/edit/confirmDelete nested).
  Smoke: 3 admin tier daraxtni oladi; tsc+build toza.
  ⚠️ KEYIN QAYTA ISHLANDI (o'sha kun): foydalanuvchi daraxtni "tiqilib qolgan" dedi —
  DRILL-DOWN'ga o'tildi: hub (fakultet kartalari, jami sonlar) → /admin/structure/f/:id
  (FacultyPage: Kafedralar ro'yxat-karta [bosilsa kafedra sahifasi] + Guruhlar ro'yxati,
  2 ustun) → /admin/structure/d/:id (DepartmentPage: Fanlar). Umumiy qismlar
  `structure/shared.tsx` (useStructureTree, useStructureMutation, EntityFormModal,
  EntityDeleteDialog — 4 kind uchun bitta generik modal/dialog). Hammasi bitta
  ["structure-tree"] query'dan slice oladi. Har sahifa keng, breadcrumb bilan;
  o'chirish detal sahifadан — muvaffaqiyatda yuqoriga navigate.

## 9. Loyiha holati va ishga tushirish (operatsion — sessiya 0)

**Monorepo (npm workspaces):**
```
apps/api/       # Express + TS (port 8000): auth (JWT access+refresh httpOnly cookie,
                #   argon2), requireRoles() RBAC, xato — {error:{code,message_uz,message_ru}}
apps/web/       # React + Vite + TS (port 3000): react-router-dom, react-i18next (uz/ru),
                #   TanStack Query. /login + bo'sh dashboardlar /admin /teach /app
packages/db/    # Prisma schema (User) + client + seed
packages/ui/    # Dizayn tokenlari (src/tokens.css) + 10 komponent. Web unga
                #   Vite alias orqali ulanadi (@meduni/ui → packages/ui/src)
```

**Ishga tushirish (dev, Windows):**
```powershell
# Postgres: bu mashinada Docker YO'Q — mahalliy PostgreSQL 17 ishlatiladi (service:
#   postgresql-x64-17). Baza+rol: meduni/meduni, DB meduni. DATABASE_URL —
#   apps/api/.env va packages/db/.env da (postgresql://meduni:meduni@localhost:5432/meduni).
#   docker-compose.yml (faqat Postgres) — server uchun qoldirilgan.
npm install                                    # ildizdan (workspaces)
npm run db:migrate                             # Prisma migratsiya
npm run db:seed                                # admin@meduni.uz / admin123
npm run dev:api                                # Express, port 8000
cd apps/web; npm run dev                       # Vite, port 3000
```

**Muhim:**
- Eski stack (FastAPI + Next.js, M1–M8 + R1) — `pre-rewrite-fastapi-nextjs` branchida
  saqlangan. Kerak bo'lsa eski logika/UX'ni o'sha yerdan ko'r.
- ⚠️ `GEMINI_API_KEY` (pulli kalit) `apps/api/.env`da (gitignore — commit
  QILINMAYDI, tracked fayllarda yo'q). Matn+rasm generatsiyaga to'liq ulangan va
  ishlaydi. Kalit chatga yozilgan — **skomprometatsiya deb hisobla**, pilot/prod'dan
  oldin aistudio.google.com'da yangila.
