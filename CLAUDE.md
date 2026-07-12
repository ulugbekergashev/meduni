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

### Ranglar (tokenlar)
```
bg: #F7F8FA | surface: #FFFFFF | ink: #0F172A | ink-soft: #64748B | ink-faint: #94A3B8 | line: #E9EDF2
brand: #0F9E8E | brand-soft: #E6F5F3 | brand-deep: #0B7A6E
blue: #2563EB / #EAF1FE (test, ma'lumot)
violet: #7C3AED / #F1EBFE (video)
amber: #D97706 / #FCF2E2 (ogohlantirish, tekshiruv)
rose: #E11D48 / #FDE9EE (keys, xato)
emerald: #059669 / #E4F6EF (muvaffaqiyat, tugadi)
```

### O'lchamlar
- Karta radius 16px, tugma/input 10px, badge/pill 20px (dumaloq)
- Sarlavha h1: 25px/700, katta raqam: 34px/700 tabular-nums, bo'lim: 14.5px/700, matn: 13.5px, izoh: 12px/ink-faint
- Panel padding 20-22px, kartalar orasi 14-16px
- Shrift: Inter / system-ui

### Umumiy komponentlar (packages/ui da)
Button (primary/deep/ghost/soft/danger, sm/md/lg, ikonka, hoverда brand→brand-deep), StatusPill (draft/review/published), Card (hoverда ko'tariladi+soya), Icon (SVG, stroke 1.7 yoki lucide-react), Input/Textarea (focusда brand chegara), Modal (markazда, Escape+tashqi bosishда yopiladi), Toast (pastда, 2.6s, ok/warn), Spinner, EmptyState, Sidebar layout (248px, faol=brand-soft fon).

### Tamoyillar
- Har statistika o'z rangida (talaba=ko'k, o'qituvchi=violet, kurs=teal, ...)
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

- Faqat 3 rol: admin, teacher, student. **XP, badge, leaderboard, streak, QR, audio-podkast — YO'Q.**
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
  fon-job 429'ni ERROR bilan to'g'ri boshqaradi. ⚠️ **Real Nano Banana Pro rasmlari
  free-tier'da 429 (rasm kvotasi yo'q) — pulli kalit kelganda sifat tekshiriladi.**

- **Modul 9 — O'qituvchi: Video generatsiya (tayyor).** TTS: **edge-tts**
  (uz-UZ-Madina/Sardor, ru-RU-Svetlana/Dmitry — Azure ovozlari, bepul, kalitsiz;
  Aisha/Azure Speech kalitlari yo'q edi). Prisma: Video (scriptJson, audioUrl?,
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
  bo'lishi shart (prod eslatma). ⚠️ Modul 8 real rasmlari hali pulli kalit kutmoqda.

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

Keyingilar (men har biriga prompt beraman):
15. Yo'qlama
16. Talaba: davomat + profil
17. Admin: lug'at, shablon, AI monitoring, audit

---

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
- ⚠️ `GEMINI_API_KEY` (apps/api/.env'ga ko'chirilgan) ilgari chatga yozilgan —
  skomprometatsiya deb hisobla, pilot/prod'dan oldin aistudio.google.com'da yangila.
  Hozircha kodga ulanmagan (AI generatsiya — keyingi sessiya).
