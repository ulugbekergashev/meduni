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
- AI: Google Gemini (matn: `gemini-flash-latest` → `gemini-flash-lite-latest` fallback;
  rasm: Nano Banana Pro / gemini-3-pro-image; video: slaydlar+TTS+ffmpeg)
  ⚠️ **`thinkingBudget: 0` ENDI QO'LLANMAYDI** — model 400 INVALID_ARGUMENT qaytaradi va bu
  BARCHA generatsiyani jimgina buzadi (konspekt/test/keys/slayd/faktcheck). Minimal qiymat
  **128** ishlatiladi (`ai/gemini.ts::MIN_THINKING_BUDGET`) — o'lchandi (2026-07-22): 0 bergan
  natijani aynan qaytaradi (~1.3s, 0 fikrlash tokeni), configni butunlay olib tashlash esa
  ~3.6s va ~470 ortiqcha token turadi.
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
- **Shrift shkalasi — `packages/ui/tailwind.config.ts` tokenlari** (2026-07-23 v3,
  buyurtmachi 3-marta "kichkina" dedi → KATTA sakrash): `h1` 30 · `stat` 42 ·
  `section` 20 · `body` 17 · `note` 15 · `micro` 13 · `read` 19/1.8.
  **`micro` (13px) — MUTLAQ MINIMUM.** `text-[N]` arbitrary qiymatlar TAQIQ —
  token ishlat (talaba sahifalari + packages/ui komponentlari hammasi token'ga
  o'tkazilgan). O'qish ustunida sarlavha/marker o'lchamlari **em** da (A−/A+).
- **Statistika kartalari — DentaCRM uslubi** (`components/HeroStats.tsx`
  `HeroCard`/`HeroTile`; `packages/ui/StatCard`): ALOHIDA keng karta, ikonka-chip
  (rounded-control 48px) → UPPERCASE `note` yorliq → `stat` (42px) raqam → hint,
  `p-6` havo. Siqilgan "strip" TAQIQ. `HeroTile accent` = gradient urg'u karta.
- **Talaba tomoni DEFAULT YORUG'** (dark headerdagi tugma bilan OPTSIYA). **Dark
  tokenlar (2026-07-23 v3) boyroq/kontrastroq**: kartalar fondan aniq AJRALADI
  (bg #0b1018, surface #19212f, raised #232d3f, line #2c3648, ink #f5f7fc) —
  void-qora (#06080d) yoki flat-grey EMAS.
- Soyalar tokenli: `--shadow-card` / `--shadow-card-hover` (ink-tinted, dark'da o'z varianti); Tailwind `shadow-card`/`shadow-card-hover`
- Sana formati: `lib/date.ts::formatDate(locale, date, "long|short|shortYear")` — uz oy nomlari qo'lda ("15-iyul, 2026-yil"; uz-UZ ICU "M07" buzuq), toLocaleDateString'ni oy-nomli formatda ISHLATMA
- Panel padding 12-16px (`p-3`/`p-4`), kartalar orasi **8-12px** (`gap-2`/`gap-3`) — ZICHLIK QOIDASIga qarang
- Shrift: **Manrope** (`@fontsource-variable/manrope`) → Inter → system-ui

### Umumiy komponentlar (packages/ui da)
Button (primary/deep/ghost/soft/danger, sm/md/lg, ikonka, hoverда brand→brand-deep, active:scale-98), StatusPill (draft/review/published), Card (p-6, shadow-card, hoverда ko'tariladi), **StatCard (ikonka-chip + katta raqam + label/hint; tone=class string; selected=filtr holati; compact)**, Icon (SVG, stroke 1.7 yoki lucide-react), Input/Textarea (focusда brand chegara+ring), Modal (markazда, Escape+tashqi bosishда yopiladi), Toast (pastда, 2.6s, ok/warn), Spinner, EmptyState (text+hint+action, dashed karta), **Sidebar layout (272px, YORUG' — oq surface, border-r, faol=brand-soft chip + chap indigo indikator; `--side-*` tokenlar, dark'da o'z varianti)**, Charts (ProgressRing def 116/11, **Donut (segmentli, 2px oraliq, markazda qiymat) + LegendRow**, BarRow, MiniBars, StackedBar 2px-gap segmentlar). Kontent max-w 1280px. Tablar: segmented uslub (bordered surface track p-1, faol=brand-soft chip) — TabNav/GroupProfile/LessonPage bir xil.

### ⛔ ZICHLIK QOIDASI (2026-07-21 — BUZILMAYDI, eng ko'p buzilgan qoida)

Foydalanuvchi talabi: **"katta spacelar qolib ketmasin, faqatgina paddingga ruxsat"**.
Namuna — **NotebookLM**: chap manbalar / o'rta ish maydoni / o'ng studio; uchalasi
to'liq ekran balandligida, oralari ingichka, har biri O'Z ICHIDA skroll qiladi,
bo'sh ekran qolmaydi.

- **Bo'shliqni `gap`/`space-y`/`margin` bilan YASAMA — `padding` bilan yasa.**
  Bo'shliq element ICHIDA bo'ladi, elementlar ORASIDA emas.
- **Panellar/kartalar orasi: `gap-2`/`gap-3` (8–12px).** `gap-6`, `gap-8`,
  `space-y-6`, `space-y-8`, `mt-8` — **TAQIQ** (ular ekranni parchalab tashlaydi).
- **Ishchi sahifalar (dars paneli kabi) viewport balandligini TO'LDIRADI:**
  `h-full` + `min-h-0` + har panel `overflow-y-auto`. Sahifa emas — PANEL skroll
  qiladi. Bunday sahifalar `fullBleed` rejimida (shell max-w/padding qo'ymaydi).
- **Markazda tor ustun + yon tomonlarda bo'sh ekran — TAQIQ.** Kontent mavjud
  kenglikni egallaydi.
- Panel ichi padding: `p-3`/`p-4` (ixcham), panel shapkasi `px-3 py-2`.
- Har yangi sahifadan keyin savol: *"ekranda ma'nosiz bo'sh joy bormi?"* — bo'lsa
  qayta ishla.

### ⛔ OVOZ IERARXIYASI QOIDASI (2026-07-23 — "samolyot boshqaruvi" muammosi)

Buyurtmachi shikoyati: *"joylashuvlar norm, lekin huddi samolyot boshqaruviga
o'xshaydi, qiyinligidan"*. Sabab **layout emas** edi — uchala ustun bir xil
"baland ovozda" turardi va bitta holat 4-5 joyda takrorlanardi.

1. **Bir ekranda faqat BITTA yoritilgan yuza.** Asosiy (o'qiladigan) panel —
   `bg-surface` + `border` + `rounded-card`. Xizmatchi ustunlar (rail, chat)
   kartaga O'RALMAYDI: sahifa fonida, chegarasiz turadi.
   `lesson/Panel.tsx::tone` — `"content"` va `"chrome"`. Yangi ish sahifasi
   qursang shu naqshni takrorla.
2. **Bitta fakt — bitta joy.** "O'qildi 5/5" tipidagi holat ekranda BIR marta
   ko'rinadi. Yangi indikator qo'shishdan oldin: *"bu ma'lumot allaqachon
   qayerdadir bormi?"* Agar bor bo'lsa — qo'shma yoki eskisini olib tashla.
3. **"Tugadi" holati yorqin rang EMAS.** To'ldirilgan emerald chip faqat
   yakuniy bosqich markerida. Ro'yxatlarda tugagan element = kontur belgi
   (`text-emerald` + check), fon yo'q. Ekranda 10 ta yashil doira — shovqin.
4. **UPPERCASE dietasi.** `uppercase tracking-wider` faqat: bo'lim eyebrow'i,
   guruh ajratgichi, callout yorlig'i (MUHIM/OGOHLANTIRISH). Panel sarlavhasi
   oddiy registrda.
5. **font-extrabold (800) — faqat sarlavhalarga.** Ro'yxat qatorlari, chiplar,
   yon panel matni `font-semibold`/`font-bold`.

### Motion qoidasi (2026-07-23)
- Kutubxona: **motion.dev** — loyihada `framer-motion` 12 paketi sifatida
  (API aynan bir xil; yangi kod `motion/react` import yo'liga o'tishi mumkin).
- **anime.js v4** — faqat imperativ TIMELINE kerak bo'lganda (bir nechta turli
  nishonni ketma-ket boshqarish). Namuna: `ResultPanel::useResultIntro`
  (`createScope({root})` + `createTimeline()`, unmount'da `scope.revert()`).
  U ~18kB — shuning uchun ishlatgan komponent **`React.lazy` bilan alohida
  chunkka** chiqariladi.
- Faol holat indikatorlari `layoutId` bilan "suzadi" (stepper, rail, TOC).
- **Har animatsiya `useReducedMotion()` bilan o'chadi.** Loop/pulse/glow YO'Q.
- Barcha bosiladigan elementda `focus-visible:ring-2 focus-visible:ring-brand`.
- kokonut ui / bklit ui — shadcn *registry* (copy-paste), loyihaga o'rnatilmaydi:
  naqsh olinadi, style qatlami o'z tokenlarimizda qayta yoziladi.

### Tamoyillar
- Har statistika o'z rangida (talaba=ko'k, o'qituvchi=violet, kurs=brand/indigo, ...)
- Har karta interaktiv (hover jonlanadi)
- Gradient faqat urg'u uchun (brand-deep→brand)
- Zich, ma'lumotga to'la (yuqoridagi ZICHLIK QOIDASI)
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
  teacher scope o'sha TeacherProfile.departmentId. **XP, badge, QR — YO'Q.**
  **Streak — BOR (Modul 23, 2026-07-21 buyurtmachi qarori):** uzluksiz o'qish
  kunlari (dashboard hero), timestamp'lardan hisoblanadi, jadval yo'q.
  **Reyting — endi OCHIQ (Modul 23, eski qoida BEKOR):** `/me/rank` guruh top-10
  ni ismlar bilan qaytaradi (`top[{rank,fullName,completed,isMe}]`) + o'z o'rni;
  talaba GradesPage'da guruh reytingini ko'radi. (Ilgari faqat o'z o'rni edi —
  buyurtmachi ochiq leaderboard so'radi.)
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

- **Tuzilma: birlik bilan birga admin hisobi + AI limit (2026-07-17).** Fakultet
  yaratishда ixtiyoriy **dekan** (FACULTY_ADMIN hisobi: FISH/email/telefon/parol),
  kafedra yaratishда ixtiyoriy **mudir** (DEPT_ADMIN) + **AI limitlar** (token/rasm/$,
  0=cheksiz → AiQuota). Backend `createFaculty/createDepartment` — bitta
  **$transaction** (email band → 409 DUPLICATE_EMAIL va birlik ham yaratilmaydi —
  tekshirildi), parol bo'sh bo'lsa generatePassword → javobda `admin.generatedPassword`
  (foydalanuvchi o'zi parol berganда null — reveal qilinmaydi), CREATE_USER/UPDATE_QUOTA
  audit. `structureTree` endi `admins {fullName, phone}` ni fakultet+kafedra darajasida
  qaytaradi → Faculty/DepartmentPage sarlavhasida "Dekan/Mudir: FISH · tel".
  EntityFormModal'да admin (2 ustun) va kvota (3 ustun) bo'limlari, PasswordModal reuse.
  PATCH sxemalari ajratildi (facultyUpdate — admin maydonisiz). Smoke: dekan avto-parol,
  mudir o'z paroli bilan login 200, tree'da ikkalasi, rollback. tsc+build toza.

- **Admin qayta tuzildi: TALABALAR va XODIMLAR modullari (2026-07-18, foydalanuvchi:
  "hammasi bir xil, studentlarni ajrat, qolganini staff qil").** "Foydalanuvchilar"
  moduli YO'Q QILINDI (UsersPage+UserFormModal o'chirildi; profil `/admin/users/:id`
  QOLADI, `/admin/users` → `/admin/students` redirect).
  (A) **Talabalar `/admin/students`** — kontingent moduli: backend
  `modules/admin/students.ts` (`GET /admin/students` + `/stats`, admin router;
  scope: SUPER=hamma, FACULTY=o'z fakulteti, DEPT=**403** — nav'да ham yashirin).
  Har qator o'quv ko'rsatkichlari bilan: progressPct (COMPLETED topics/published,
  batch groupBy), attendancePct, coursesCount. Sahifa: 3-4 stat karta (nofaol=filtr),
  fakultetlar bo'yicha Donut (>1 bo'lsa), fakultet→guruh kaskad filtr, jadvalда
  ProgressBar + davomat% (<75 rose), StudentFormModal (faqat talaba, kaskadli guruh).
  (B) **Xodimlar `/admin/staff`** (eski structure route'lari → redirect) — tuzilma+xodimlar
  birlashdi: Hub'да **Rahbariyat** (superadminlar) + fakultet kartasida dekan ismi;
  FacultyPage'да **AdminCard** (dekan: FISH/email/tel + parol tiklash + profil; bo'lmasa
  "+Tayinlash" → AppointModal), kafedra qatorида mudir ismi; DepartmentPage'да mudir
  AdminCard + **O'qituvchilar bo'limi** (ro'yxat: lavozim/email, faol Toggle, parol
  tiklash, profil; "+O'qituvchi" AppointModal — o'qituvchi endi o'z kafedrasida
  yaratiladi) + fanlar. `structureTree.admins` += id/email. shared.tsx: AppointModal
  (rol-fiks POST /users), AdminCard, useDeptTeachers. i18n: `students.*`, `staff.*`,
  nav.students/staff. ⚠️ Demo fix: teacher.m11demo'да TeacherProfile yo'q edi —
  qo'shildi (dept 18). **Smoke:** students metrikalar/stats/scope (FACULTY o'z, DEPT 403),
  kafedra o'qituvchilari ro'yxati, tree admins email bilan; tsc+build toza.

- **Header/topbar overhaul + yig'iladigan sidebar (2026-07-18).** SidebarLayout:
  top-bar endi DOIMIY va balandligi qat'iy **57px** (wizard `top-[57px]` sticky
  offsetlari shunga bog'liq — o'zgartirsang ikkalasini birga o'zgartir); chapда
  **sidebar collapse tugmasi** (PanelLeft, holat localStorage `meduni.sidebar`,
  width 272→0 transition), o'rtada headerSlot (qidiruv), o'ngда yangi `rightSlot`.
  RoleShell rightSlot'ni to'ldiradi: **sana (xl+) · LocaleSwitcher (uz/ru) ·
  ThemeButton (bitta tugma, light↔dark) · user FISH/email · Logout** — user blok
  sidebar pastидан headerga ko'chdi (userBlock prop qoldi, ishlatilmaydi).
  Uchala rol shell'i (admin/teach/app) avtomatik oladi. tsc+build toza.

- **Shrift shkalasi +1 pog'ona (2026-07-18, foydalanuvchi: "kichkina").** Tailwind
  tokenlar: h1 30px, stat 38, section 17, body 15, note 13.5. QO'SHIMCHA: butun
  apps/web+packages/ui bo'ylab arbitrary `text-[Npx]` qiymatlar perl bilan bir
  pog'ona ko'tarildi (10→11 ... 15.5→16.5; ≥16 tegilmadi). Yangi kod yozganда
  YANGI shkala ishlatilsin (asosiy matn 15px, izoh 13.5px).

- **Admin profil sahifasi v2 (2026-07-18, foydalanuvchi: "primitiv").**
  `getUserProfile` student += `attendance {present/absent/late/excused/marked}`,
  `avgQuizScore` (finished o'rtacha), `lastActiveAt` (max Progress.updatedAt).
  UserProfilePage qayta yozildi: identity-karta (avatar+rol/lavozim badge+kontaktlar
  + **amallar: Faol toggle, Parolni tiklash**→PasswordModal); talaba: ProgressRing
  (kurslar o'rtachasi) + mavzular k/N + oxirgi faollik, **davomat StackedBar+legend**
  (<75 rose), o'rtacha test, kurslar ro'yxati ProgressBar bilan; o'qituvchi:
  MetricTile'lar + kurs kartalari (lavozim badge'да). Smoke: breakdown/avgQuiz real
  ma'lumot bilan. ⚠️ **DISK TO'LA (C: 0GB)** — npm keshi tozalanди (~350MB bo'shadi),
  foydalanuvchi joy bo'shatishi kerak; ffmpeg video generatsiya to'la diskда ishlamaydi.

- **Modul 20 Faza 3 — kafedra-markazlashgan kontent (2026-07-20). Topic endi FANGA
  tegishli.** Prisma: `Topic.courseId` → `Topic.subjectId` (qo'lda migratsiya
  `topic_to_subject`: data saqlanadi, bir fanga bir necha kursdan kelgan mavzular
  (courseId, orderIndex) tartibida MERGE + qayta indekslanadi; index topics_subjectId).
  **Egalik modeli:** `topics/service.ts::assertSubjectTeacher` — o'qituvchi fan
  kafedrasining a'zosi (TeacherProfile.departmentId) YOKI shu fandan kurs olib boradi;
  topics/content/presentation/video barcha ownership shu orqali (eski
  `topic.course.teacherId` YO'Q). `toTopicOut` frontendga `courseId`ni kontekstдан
  qaytaradi (list=so'ralgan kurs, detail=o'qituvchining fandagi birinchi kursi,
  bo'lmasa null → konstruktor back-nav /teach'ga). **me/service:** courseInclude
  endi `subject.topics`; `loadCourse` fan mavzularini `course.topics`ga normalizatsiya
  qiladi (downstream — progress matritsa/tasks/lesson — o'zgarishsiz ishlaydi);
  `enrolledCourseIdForTopic` — mavzu fanidан talabaning ACTIVE kursini topadi
  (assertTopicOpen/recomputeTopic/lesson default-rule shu kurs orqali).
  **review.ts:** javobning "kursi" endi `resolveAttemptCourses` — talabaning
  o'qituvchi kursidagi enrollment'idan (attemptId→courseId xarita); xaritada yo'q
  attempt = begona talaba → ko'rinmaydi/403. tasks/stats/users-profil/admin-students/
  search/courses.service/attendance topic-filtrlari `subject:{courses:{some:...}}` /
  `subjectId` ko'rinishiga o'tdi (admin stats'да `subjectScope`). Frontend: TopicRow
  += subjectId, courseId nullable; TopicsTab'да "mavzular fanga tegishli" izohi
  (i18n topics.subjectShared). **Tekshirildi:** 20/20 HTTP smoke (teacher mavzular/
  progress/keys-navbat, student yo'l/dars/LOCKED-403, admin stats/students/topicCount)
  + negativ: begona kafedra o'qituvchisi list/detail/create → 403; tsc+build ikkala
  tomonда toza. **Natija:** bitta fan kontenti bir marta yaratiladi — fandagi barcha
  kurslar (guruhlar) bir xil mavzularni ko'radi; parallel kurslarning eski mavzulari
  bitta ro'yxatga birlashgan (dev bazада T1 dublikatlar ko'rinishi mumkin — demo data).

- **Modul 21 — Professional UX overhaul (2026-07-20, foydalanuvchi: "primitiv, tugmalar
  bosiladi lekin ma'lumot qolib ketayapti").** Reja: `.claude/plans/ethereal-tinkering-river.md`.
  **(A) Backend** (yangi Prisma migratsiya YO'Q — hammasi mavjud jadvallardan):
  `modules/courses/subjects.ts` — `GET /teach/subjects[/:id]` (`subjectTeacherFilter` reuse:
  kafedra a'zosi YOKI fandan kurs olib boruvchi; har fan uchun published/inProgress/empty +
  `attention{materialMissing,digestPending,publishPending,factcheckFlagged}` + `myCourseId`);
  `GET /api/v1/topics?subjectId=` + `POST /topics {subjectId}` (`listTopicsBySubject`);
  `me/profile.ts` += `getMySchedule` (7 kunlik LessonSession), `getMyActivity` (progress+
  quiz+case hodisalari JS'da birlashtirilib sanaga saralanadi; ⚠️ **haqiqiy harakat**
  [videoWatchedPct>0 yoki slidesViewed] AVAILABLE holatda ham lentaga tushadi),
  `getMyRank` (guruhdagi o'rin — **boshqa talabalar ismi qaytmaydi**);
  `getTeacherGroup` students += `rank`; `getTeacherDashboard` += `ranking{top,behind}`
  (buildMatrix natijasidan, qo'shimcha so'rovsiz); review detail += `studentId`.
  **(B) O'qituvchi:** yangi **`/teach/subjects`** ("Fanlarim" nav) — fan kartalari
  StackedBar + "diqqat kerak" chiplari; **`/teach/subjects/:id`** — fan shapkasi +
  mavzular. `TopicsTab`dagi ro'yxat umumiy **`TopicListSection`**ga ajratildi (scope =
  `{courseId}` yoki `{subjectId}`; topic hooklari `TopicScope` qabul qiladi, invalidatsiya
  `["topics"]` prefiksi bo'yicha). **`components/QuickTaskModal.tsx`** (eski TeachTasksPage
  AssignModal'dan) — prefill bilan **4 joyda**: keys baholash paneli ("Vazifa berish" +
  "Mavzuni takrorlang: X" prefill), StudentDetailPage, GroupProfile (har talaba + guruhga),
  ProgressTab talaba modali. Reyting: GroupProfile qatorlarida tartib raqami (top-3 brand),
  TeachDashboard'da "Eng yaxshi 3 / Orqada qolgan 3" kartalari.
  **(C) Talaba:** StudentDashboard'da **"Bugun" harakat markazi** — davom ettirish kartasi +
  o'qituvchi topshiriqlari (bir bosishda "Bajardim") + avto vazifalar (to'g'ridan `?tab=`
  deep-link) + kelgusi darslar (sana/xona) bitta ro'yxatda; **ProfilePage v2** (skrinshot
  strukturasi, to'lovsiz): identity-karta (avatar+badge+"Guruhda N/M-o'rin") + 4 stat-karta +
  **tablar** Umumiy(faollik lentasi)/Kurslar/Davomat; davomat `AttendanceSection`ga ajratildi —
  profil tabida HAM, `/app/attendance` sahifasida HAM; CoursePath element chiplari endi
  **bosiladi** (video/test/keys → `?tab=`). `AsyncSection` += `emptyHint`, `StackedBar` += `total`.
  **Tekshirildi:** 17/17 HTTP smoke (fan pipeline, subjectId mavzular, dashboard+guruh rank
  tartibi, keys studentId, vazifa o'qituvchi→talaba yetib bordi, jadval/faollik/rank,
  rank javobida ism yo'qligi); tsc+build ikkala tomonda toza. Demo: talaba 3 kelgusi dars.

- **Modul 21B — kurslar ko'lami: davrlar bo'yicha guruhlash (2026-07-20, foydalanuvchi:
  "bir semestrda 2-3-4 kurs boʻladi, semestrlar ham koʻp").** Ro'yxatlar 1-2 kursga
  mo'ljallangan yassi grid edi — o'nlab kurs bo'lganda devorga aylanardi. **Backend:**
  `courseOrder` (academicYear ↓, semester ↓, id ↑) — `listCourses` va `listTeacherCourses`
  ikkalasida (yangi davr doim tepada); `listCoursePeriods` + `GET /api/v1/courses/periods`
  (filtr dropdownlari, scope ichida); admin `GET /courses` filtrlari: `academicYear`,
  `semester`, `subjectId`, `teacherId`, `search` (fan/o'qituvchi/guruh nomi, insensitive);
  `listTeacherSubjects` har fanga `courseCount` + `latest{academicYear,semester}`,
  `getTeacherSubject` += `courses[]` (davr/o'qituvchi/talaba soni/isMine).
  **Frontend:** umumiy `components/PeriodGroups.tsx` — `groupByPeriod` (yil→semestr),
  `PeriodSection` (yig'iladigan yil bo'limi, faqat eng yangisi ochiq, boshqalari "arxiv"),
  `PeriodFilter` (yil+semestr select), `usePeriodOptions`. `/teach/courses` — qidiruv
  (fan/guruh) + davr filtri + "Jami: N" + yil bo'limlari ichida semestr sarlavhalari;
  `/admin/courses` — server-filtrli qidiruv (300ms debounce) + yil/semestr/fan select +
  jadval ichida davr ajratuvchi qatorlar (`Fragment key`); `/teach/subjects` — qidiruv +
  kafedra bo'limlari (>1 bo'lsa) + kartada "oxirgi davr · N kurs"; fan sahifasida
  **"Qaysi kurslarda o'qitiladi"** ro'yxati (davr, o'qituvchi, talaba soni, "Mening kursim").
  i18n: yangi `period.*` bo'limi + `subjects/courses/teach` kalitlari.
  **Tekshirildi:** demo 20 kurs / 5 davr / 4 fan bilan — tartib to'g'ri (2026/2027 s2 birinchi),
  guruhlash 8+8+4, admin filtr (2025/2026 s8 → 4 kurs) va qidiruv ("nefro" → 5) ishlaydi;
  tsc+build toza.

- **Modul 21C — talaba tomoni ko'lami (2026-07-20, foydalanuvchi: "studentga ko'rinadigan
  qismini ham professional qil").** **Backend:** `courseSummary`/`getMyCourse` +=
  `semester`+`academicYear`; `enrolledCourseIds` endi davr bo'yicha desc (dashboard
  "davom ettirish" eng avval joriy semestrdan tanlanadi); `getTopicLesson` qayta qurildi —
  assertTopicOpen o'rniga bitta computeTopics o'tishi (enrolled+published+locked tekshiruvi
  saqlangan) va javobga `subjectName` + `nextTopic{id,title,state}` qo'shildi.
  **Frontend:** StudentDashboard kurslari `PeriodGroups` bilan yil→semestr guruhlangan
  (joriy yil ochiq, eskilari "arxiv" yig'ilgan); CoursePath shapkasida davr badge'lari
  (yil/semestr/guruh) + "Davom ettirish" tugmasi (birinchi ochiq mavzuga); LessonPage
  breadcrumb endi fan nomi, tugallanganda **"Keyingi mavzu →"** tugmasi (LOCKED bo'lsa
  yo'lga qaytadi). i18n `lesson.nextTopicBtn`. **Tekshirildi:** 8/8 smoke — demo talaba
  6 kurs / 3 davr (s2,s2,s2,s1,s8,s7 tartib), resume kontentli kursdan, lesson subjectName+
  nextTopic; tsc+build toza. Demo: student@meduni.uz 5 yangi davr-kursga yozildi.

- **Modul 22 — Talaba tomoni PRO (2026-07-20, foydalanuvchi: "bunaqa primitivlikni bozor
  kechirmaydi").** Reja: `.claude/plans/ethereal-tinkering-river.md`. Shikoyat: Vazifalar
  sahifasida mavhum kartalar ("1 Ishlanmagan testlar" — QAYSI?), Davomat sahifasi deyarli
  bo'sh, "Kurslarim" alohida modul emas edi.
  **(A) Nav 6 modul:** Bosh sahifa · **Kurslarim** (`/app/courses`) · Vazifalar ·
  **Baholarim** (`/app/grades`) · Davomat · Profil.
  **(B) Kurslarim** (`StudentCoursesPage`): qidiruv (fan/o'qituvchi) + `PeriodFilter` +
  "Jami: N" + yil→semestr guruhlash (`PeriodGroups` reuse); kartada davr/guruh chiplari,
  progress, keyingi mavzu + "Davom ettirish". Dashboard yengillashdi — faqat **joriy davr**
  kurslari (maks 4) + "Barchasi →".
  **(C) Vazifalar** — `computeStudentAutoTasks` endi `items[]` qaytaradi
  ({topicId,topicTitle,courseName,link,value}) → UI'da mavhum karta o'rniga **konkret
  qatorlar** ("Yurak anatomiyasi · Kardiologiya →"), o'qituvchi topshiriqlarida
  muhimlik/muddat/"Ochish" + `listAssigned(includeDone)` bilan **"Bajarilganlar" tarixi**
  (yig'iladigan).
  **(D) Davomat PRO** — `getMyAttendance` += `byCourse[]` (eng past birinchi) va
  `byMonth[]` (6 oy); UI: hero (katta % + StackedBar + LegendRow) + **MiniBars oylik trend**
  + **kurslar kesimi BarRow** (<75 rose) + **kelgusi darslar** + sessiyalar **oy sarlavhalari**
  bilan (uz oy nomlari qo'lda — ICU buzuq).
  **(E) Baholarim — yangi modul:** `GET /me/grades` (`me/profile.ts::getMyGrades`) — kurslar
  kesimida testlar (eng yaxshi ball, urinishlar, o'tdi/o'tmadi) va keyslar (ball, **o'qituvchi
  izohi**, kim/qachon tekshirgani, "tekshiruvda"); UI: 3 stat + kurs bloklari + izoh ochiladi.
  **Tekshirildi:** 11/11 smoke (2 talaba: kursi ko'p / bahosi bor) — items konkret, includeDone,
  byCourse/byMonth, grades avg=100% · 2/2 test · keys 8 ball "Aziz Karimov" izohi bilan;
  tsc+build toza.

- **Modul 22B — Jadval moduli + qoldirilgan darslar (2026-07-20).** (1) **Dars jadvali**
  `/app/schedule` (nav 7-modul, CalendarDays): hafta ko'rinishi (dushanba boshlanadi,
  ‹ hafta › + "Bugun"), har kun bo'limi (bugun brand belgisi), dars qatori: vaqt · mavzu/fan ·
  xona · holat — **o'tgan dars o'z yo'qlama holati bilan** (keldi/kelmadi/kechikdi/sababli
  yoki "Belgilanmagan"), kelgusi — "Bo'ladi". Backend: `getMySchedule(from,to)` diapazon +
  `myStatus`/`isPast` (o'z Attendance yozuvlari join), diapazon berilmasa eski xatti-harakat
  (dashboard 7 kun). (2) **Qoldirilgan darslar** — Davomat sahifasida rose-karta bo'lim:
  jami son + **fan kesimida** ("Kardiologiya — 2 ta") har biri sana·mavzu chiplari bilan
  (sessions'dan client-side ABSENT guruhlash). Demo: student@meduni 12-iyul "Amaliy
  mashg'ulot"da ABSENT (davomat 100%→67% — past-davomat ogohlantirishi ham jonlandi).
  ⚠️ **Qayta ishlandi (foydalanuvchi: "yoqmadi")** — ikkalasi ham almashtirildi:
  (a) Jadval endi **haqiqiy to'r**: vaqt qatorlari × 7 kun ustuni (sarlavhada kun+sana,
  bugun brand fon), katakda dars kartasi (mavzu/fan/xona + chap chekka rangi holat bo'yicha:
  brand=bo'ladi, emerald/amber/rose/blue=yo'qlama, kulrang=belgilanmagan), vaqt qatorlari
  FAQAT haqiqatda dars bor soatlardan quriladi (bo'sh qator chizilmaydi), gorizontal skroll +
  pastda legenda. Kunlar ro'yxati va "Dars yo'q" placeholderlari olib tashlandi.
  (b) Davomatdagi qizil chip-bloki + BarRow'lar o'rniga **fanlar bo'yicha jadval**:
  Fan | Jami | Keldi | Kechikdi | Sababli | **Qoldirdi** | Davomat% (<75 rose); qatorni bosish
  — qoldirilgan darslar sana+mavzu bilan ochiladi (Fragment key). Demo: haftaga 7 real
  vaqtli dars (09:00/11:00/14:00, 4 fan) qo'shildi — to'r ma'noli ko'rinadi.

- **Modul 22C — interaktivlik (2026-07-20, foydalanuvchi: "prezentatsiyaga o'xshab qolgan,
  qani interaction?").** Sahifalar raqam ko'rsatardi, lekin hech narsa javob bermasdi.
  Qo'shildi: (a) **packages/ui** — `LegendRow` += `onClick`/`selected` (filtr tugmasiga
  aylanadi), `MiniBars` — kam nuqtada kengroq ustun + qiymat/yorliq matnlari (bitta oylik
  ustun "buzuq grafik" bo'lib ko'rinmasin), hover opacity. (b) **Dashboard** — xulosa
  halqasi va 4 tile bosiladigan drill-down (mavzular/kurslar→Kurslarim, davomat→Davomat,
  o'rin→Baholarim), hover fon. (c) **Baholarim** — 3 ko'rsatkich kartasi **filtr tugmasi**
  (bosilsa faqat testlar/keyslar qoladi, faol karta brand ring bilan) + segmented
  "Hammasi/Testlar/Keyslar" + test qatori **ochiladi**: urinishlar tarixi (har urinish
  ProgressBar + ball + sana, o'tish balli), pastda "Mavzuni ochish →". (d) **Davomat** —
  legenda qatorlari **bosiladigan status filtri** (ro'yxat shu holat bo'yicha filtrlanadi,
  "Filtrni tozalash"), fan jadvali qatori **har doim ochiladi**: qoldirilganlar + o'sha fan
  bo'yicha **to'liq dars jurnali** (sana, mavzu, holat chipi). Backend: `getMyGrades`
  quizzes[] += `passThreshold` va `history[]` (attemptNo/ball/o'tdi/sana).
  tsc+build toza.

- **Modul 22D — talaba layout: kenglikni ishlatish (2026-07-20, foydalanuvchi: "spacelar
  qolib ketgan, joyni zo'r ishlat").** Muammo: SidebarLayout 1280px beradi, sahifalar esa
  `max-w-2xl/3xl` (672-768px) da qotgan edi — ekranning yarmi bo'sh, "prezentatsiya"
  taassuroti. Barcha talaba sahifalari to'liq kenglikka o'tdi (`max-w-*` olib tashlandi;
  CoursePath 4xl, Profil 5xl — o'qish qulayligi uchun ataylab cheklangan).
  **Dashboard qayta qurildi:** (1) hero — bitta karta: salom+sana chapda, ProgressRing va
  4 bosiladigan tile o'ngda (avval alohida qatorlar edi); (2) `lg:grid-cols-[1fr_320px]` —
  chapda ish (ixcham gorizontal "Davom ettirish" + "Bugun" ro'yxati **konkret vazifa
  qatorlari bilan** + joriy kurslar 3 ustunli grid), o'ngda **rels**: kelgusi darslar
  (sana+vaqt bloki), bildirishnomalar, so'nggi faollik — hammasi `RailCard` da.
  **Baholarim:** kurs bloklari `xl:grid-cols-2`, stat kartalar 3 ustun.
  **Vazifalar:** `lg:grid-cols-[1fr_340px]` — chapda ish, o'ngda "Bajarilganlar" tarixi.
  **Davomat:** hero ustunlari qayta o'lchandi (260px + qolgani trend/jadval).
  tsc+build toza.

- **Modul 22E — bir xil zichlik barcha talaba modullarida (2026-07-20, foydalanuvchi:
  "bosh sahifa zo'r, qolganini ham shunday complex qil").** Dashboard naqshi umumiy
  komponentga chiqarildi: **`components/HeroStats.tsx`** — `HeroCard` (sarlavha+subtitle+
  `left` sloti [ring/hafta navigatsiyasi] + 4 tile grid), `HeroTile` (bosiladigan, `selected`
  bilan filtr holati), `RailCard` (o'ng ustun bloki). Dashboard'dagi mahalliy nusxalar
  o'chirildi — endi hamma sahifa shu uchtasini ishlatadi.
  **Vazifalar:** hero 4 tile (ochiq / o'qituvchidan / **muddati o'tgan** rose / bajarilgan) —
  bosilsa ro'yxat filtrlanadi; o'ng ustunda kelgusi darslar + bajarilganlar tarixi (yig'iladigan,
  sanasi bilan); muddati o'tgan topshiriq kartasi rose chegara oladi.
  **Jadval:** hero ichida hafta navigatsiyasi + 4 tile (bu hafta darslar / keldingiz /
  qoldirdingiz / keyingi dars vaqti+fani).
  **Kurslarim:** hero — o'rtacha progress ringi + 4 tile (jami kurs / joriy semestr [bosilsa
  davr filtri qo'yiladi] / mavzular k/N / tugallangan).
  **Baholarim:** hero — o'rtacha test ringi + 4 tile (o'rtacha / o'tilgan / baholangan keys /
  **tekshiruvda**), tile'lar filtr; ostida `1fr+320px`: chapda kurs bloklari, o'ngda
  "Oxirgi baholar" (test+keys aralash, sana bo'yicha) va "Tekshiruvda" ro'yxati.
  i18n: `tasks.stat*`, `schedule.stat*`, `studentCourses.stat*`, `grades.statPending/recentGrades`.
  tsc+build toza.

- **Dizayn tozalash (2026-07-21, foydalanuvchi: glass yoqmadi).** WIP glass/blur
  redizayn olib tashlandi, Indigo Pro tokenlariga qat'iy qaytildi: tokens.css bg
  #f6f7f9, radius 16/10/20, ink-tinted soyalar, `--surface-glass` solid (shaffoflik
  yo'q). Card/Button/Input'dan `glass` prop + arbitrary-opacity hoverlar; SidebarLayout
  suzuvchi glass panel o'rniga **flush border-r yon panel** (side-* tokenlar, solid
  57px header — wizard `top-[57px]` bilan mos, collapse saqlandi). 17 sahifadan
  backdrop-blur + bg-surface-glass tozalandi, accent tintlar (`-/10`) → `-soft`.
  Alohida: turbo monorepo + API helmet/rate-limit + ko'p-rol seed commit qilindi.

- **Modul 23 — Talaba paneli qayta qurish (2026-07-21, buyurtmachi katta spec).**
  Reja: `.claude/plans/polished-juggling-hippo.md`. **A/B/C bosqich (har biri commit):**
  **(A) Bosh sahifa** kunlik ish markaziga aylandi (kurslar gridi OLIB TASHLANDI →
  "Kurslarga o'tish" tugma): hero'da **streak** (🔥 `computeStreak` me/profile.ts —
  Progress/quiz/case timestamp'laridan LOCAL dayKey), subtitle=guruh·semestr·yil;
  "Bugungi/Keyingi darslar" kartasi (jadvaldan client-side), davomat + o'zlashtirish
  kartalari (joriy semestr kesimi), **top-10 reyting** (`getMyRank` kengaytirildi
  `{rank,total,completed,top[]}` — ismlar bilan, `LeaderboardCard` GradesPage'da).
  **(B) Kurslar** karta-griddan **ro'yxatga** (`CourseRow`), sukut bo'yicha **joriy
  semestr** filtri (touched ref); aniq semestr→yassi, "barcha"→PeriodSection.
  **(C) Dars sahifasi — 3 panel** (mobil: rail→kontent→material; desktop: material |
  kontent | rail sticky). **YANGI backend:** talaba endi `SourceMaterial` (chap panel,
  `GET /me/materials/:id/file` — assertTopicOpen himoya, MIME) va `TopicDigest` (o'rta
  panel konspekt — FAQAT `approvedByTeacher` bo'lsa) ni ko'radi; ikkalasi ilgari
  talabaga UMUMAN ochilmagan edi. `me/lesson.ts` payload += `materials[]`+`digest`.
  Frontend `student/lesson/`: `stages.ts` (sof — buildStages O'rganish→Keys→Test→
  Kartochkalar→Natija + finalScore [test-best+tekshirilgan keys o'rtachasi, backend
  chaqiruvsiz]), `StageRail`/`MaterialsPanel`/`ContentPanel` (Konspekt|Video|Slaydlar
  sub-tab + case/quiz/result host)/`DigestView` (doza amber blok)/`ResultPanel`
  (yakuniy ball + keyingi dars + **AI-chat placeholder**). `?view=` + eski `?tab=`
  mapping. Re-entry: test/keys tugagach natija-only (mavjud tab mantiqidan),
  Fleshkartalar+AI-chat "tez orada". **KEYINGI SESSIYALAR** (`.claude/plans/`da):
  flashcards (ContentKind FLASHCARDS, o'qituvchi tasdiqlaydi), AI tutor chat
  (Conversation/Message + gemini multi-turn, digest+material grounding), virtual
  bemor roleplay, spaced repetition, smart tooltip, kurs chati (polling),
  notifications center, bookmarks. tsc+transform toza; smoke: streak/rank/lesson
  payload. ⚠️ Demo'da approved digest/material yo'q — 3-panel to'liq ko'rinishi
  uchun o'qituvchi tomonidan konspekt tasdiqlanishi/material yuklanishi kerak.

- **Modul 24 — Mavzu ekrani (dars sahifasi) to'liq qayta qurish (2026-07-22).**
  Reja: `.claude/plans/polished-juggling-hippo.md`. Modul 23'ning 3-paneli "bo'shu
  arzon" ko'rindi — sabab CSS emas, **kontent arxitekturasi** edi (yassi konspekt,
  metama'lumotsiz material). Bosqichma-bosqich qayta qurildi:
  **(Faza 0 — vizual til)** `packages/ui/tokens.css` dark qiymatlari almashtirildi
  (bg #06080d, surface #0f141f/#151c2b, line #1b2232, brand #6366f1 — yagona aksent),
  shrift **Manrope** (`@fontsource-variable/manrope`) + zich shkala (h1 22, stat 34,
  section 15, body 13, note 12, micro 11, **read 14/1.75** — o'qish ustuni uchun),
  `SidebarLayout` += `fullBleed` (dars sahifasi 1280px konteynerdan chiqadi).
  **(Faza 1 — kontent modeli)** Prisma: `TopicDigest.digestJson` v2 = `sections[]`
  (title/minutes/sourceRef + bloklar `para|callout|list`; eski yassi konspekt ham
  render bo'ladi), `SourceMaterial += sizeBytes/pageCount`, yangi `TopicLink`
  (tashqi manba), yangi `SectionRead` (talaba qaysi bo'limni o'qidi).
  `ai/types.ts` digest v2 + `ai/prompts/digest.ts` bo'limli generatsiya.
  **(Faza 2/2B — layout)** `student/lesson/`: `LessonPage` orkestrator,
  `StageStepper` (yuqorida gorizontal 5 bosqich), `LessonOverview` (kirish holati —
  bosqichlar obzori + "Davom ettirish" CTA), `StudyRail` (chapda: o'quv bloklari
  konspekt/slaydlar/video/materiallar + bo'limlar TOC + havolalar),
  `SectionReader` (**barcha bo'limlar bir oqimda**, IntersectionObserver bilan
  scroll-spy va **avto "o'qildi"**), `NextStageBar`.
  **(Faza 2C — AI-tutor chat)** Prisma `TutorMessage`; `ai/prompts/tutor.ts` +
  `modules/me/chat.ts` — javob FAQAT konspekt+material asosida (24k belgi budjeti,
  oxirgi 12 xabar), **test jarayonida 403 `chat_locked_quiz`** (halollik).
  **(REJIM AJRATILDI — buyurtmachi talabi, MUHIM)** 3 panel **faqat o'rganish uchun**:
  konspekt/slaydlar/video/materiallar. Test, natija, keys, fleshkartalar —
  **fokus rejim** (`focusMode`: rail ham, chat ham RENDER BO'LMAYDI). Halollik
  strukturaviy: test paytida material/chat qulf oynasi emas, umuman yo'q.
  **(Fleshkartalar)** `modules/me/flashcards.ts` — kartalar test savollari + konspekt
  atamalaridan **hosila** (AI chaqiruvi YO'Q, o'qituvchi qayta tasdiqlamaydi);
  yakunlangan test urinishi bo'lmasa **403 `flashcards_locked`**.
  **(Mini-konspektlar)** `GET /me/materials/:id/text` (ajratilgan matn) va
  prezentatsiyaning matn ko'rinishi — talaba faylni yuklab olmasdan o'qiydi.
  **(Klinik keys v2)** `caseSchema` v2 (bemor kartasi + `steps[]` variant/izoh bilan),
  `CASE_PROMPT_VERSION=2` (vitals FAQAT manbadan), `CaseAttempt += stepsJson/autoScore`
  (migratsiya `case_steps_v2`); payloadda `correct`/`feedback` qadam tanlangunicha
  **yashirin**; talaba qadamma-qadam qaror qabul qiladi, izoh darhol chiqadi;
  gibrid baholash (qadamlar avto-%, yozma savollar — o'qituvchi). **CaseEditor v2**:
  o'qituvchi AI qadamlarini ko'radi/tahrirlaydi (ilgari ko'rmasdan tasdiqlardi).
  ⚠️ **Gemini**: `thinkingBudget: 0` endi 400 beradi — 3-bo'limga qarang (bu butun
  AI generatsiyani jimgina sindirgan edi). Demo: `apps/api/src/scripts/demoLesson.ts`
  (topic 29 — 5 bo'limli tasdiqlangan konspekt, 2 material, 2 havola, v2 keys).

- **Dars sahifasi UX overhaul + fleshkarta o'rganishga (2026-07-23).** Buyurtmachi:
  "joylashuvlar norm, lekin samolyot boshqaruviga o'xshaydi". Sabab layout emas —
  ovoz ierarxiyasi + takror signal + kichik matn edi. (1) **OVOZ IERARXIYASI**:
  `lesson/Panel.tsx::tone` (`content`=yagona yoritilgan karta; `chrome`=rail/chat,
  chegarasiz). (2) **Takrorlar olib tashlandi** (~13 signal): "O'qildi 5/5" faqat
  TOC'da, stepper=marker+nom+1 agregat %, overview'da stepper yashirin, materiallar
  rail'da 1 joyda, ContentPanel shapkasiz. "Tugadi" = kontur belgi (to'ldirilgan
  yashil emas). (3) **Tipografika +1** (§4 tokenlar). (4) **Motion**: layoutId
  suzuvchi chip, o'qish-progress chizig'i, sakramas % counter, chat animatsiyalari,
  focus-visible ring — hammasi `useReducedMotion` bilan. (5) **anime.js v4** natija
  ekrani timeline'i (React.lazy chunk). (6) 3D fleshkarta. §4 "OVOZ IERARXIYASI"
  va "Motion" qoidalari qo'shildi. **Fleshkarta fokus rejimidan O'RGANISH bloklariga
  ko'chirildi** (`ContentView += "flashcards"`, StageKey'dan chiqarildi): chap
  rail'da konspekt/slaydlar/video/material bilan yonma-yon, test yakunlanmaguncha
  qulf (backend qulfi bilan mos).

- **Modul 25 — Kurs guruh chati + nav qayta nomlash (2026-07-23, buyurtmachi
  "Yakuniy Xulosa" strukturasi).** (A) **Nav qayta tuzildi:** Jadval alohida modul
  emas → **Davomat sahifasi ichida tab** (`?sub=jadval`, `AttendancePage` endi
  Davomat|Dars jadvali segmented tab; `/app/schedule` → redirect). Nomlar:
  Kurslarim→**Kurslar**, Baholarim→**O'zlashtirish**, Profil→**Profil va sozlamalar**.
  Vazifalar qoldi. (B) **Kurs Chati (yangi, to'liq)** — o'qituvchi + guruh talabalari
  real muloqoti (dars ichidagi AI-tutor chatdan ALOHIDA). Prisma `CourseChatMessage`
  (courseId/authorId/text, cascade; migratsiya `course_chat`). Backend
  `modules/chat/service.ts` — kirish: talaba ACTIVE enrollment, o'qituvchi
  `course.teacherId`; `me` route (`/me/courses/:id/chat[/meta]`) + `teach` route
  (`/teach/courses/:id/chat[/meta]`), **5s polling** (jadval yo'q). Frontend:
  `/app/chat` (`CourseChatPage` — kurslar ro'yxati + chat, mobil'da bitta ustun,
  fullBleed) + o'qituvchi kurs shell'ida **"Chat" tab** (`CourseChatTab`). Xabar:
  rol badge (o'qituvchi), mine=o'ng brand, sana ajratgichlar. **Smoke 10/10**
  (real): talaba post/mine=student, o'qituvchi javob mine=false role=teacher,
  yozilmagan kurs→403. tsc+build ikkala tomonda toza. ⚠️ Roadmap qoldi:
  PDF export, notifications, bookmarks (talabnoma — `Desktop/talabnoma-student-panel.md`).

- **Modul 26 — Talabnoma AI xususiyatlari: Smart Tooltip + Interval takrorlash +
  Virtual bemor (2026-07-23).** Buyurtmachi 5 talabini bajarish: #1 chatlar diviziyasi
  (Modul 25'da tayyor) va #3 gibrid baholash (test avto + keys qadam-avto/yozma-o'qituvchi —
  tayyor) allaqachon bor; qolgan uchtasi yangi.
  **(A) Smart Tooltip** (frontend-only, AI'siz): o'qish ustunidagi matnда konspekt
  `terms` (uz+lat) avtomatik topilib, hover/click'да tooltip (lotincha + uz + ru).
  `lesson/TermTooltip.tsx` (buildMatcher — unicode so'z chegarasi, uzun avval;
  TermText matnni bo'ladi; TermChip popover), `BlockView`/`SectionReader`/`ContentPanel`
  terms uzatadi.
  **(B) Interval takrorlash (Spaced Repetition)**: Prisma `FlashcardReview +=
  intervalDays + dueAt` (migratsiya `spaced_repetition`). `flashcards.ts::reviewFlashcard`
  SM-2 lite bucketlar [1,3,7,16,35] kun (bilaman→keyingi, bilmayman→1); yangi
  `getReviewDue` (dueAt<=hozir, mavzu bo'yicha). `GET /me/review/due`. Dashboard o'ng
  ustunда "Bugun takrorlang" RailCard (→ `?view=flashcards`).
  **(C) Virtual bemor (AI roleplay)**: Prisma `PatientMessage` (role student|patient|eval,
  eval matni JSON; migratsiya `virtual_patient`). `ai/prompts/patient.ts` — bemor
  BIRINCHI SHAXSDA, keysдан yashirin haqiqat, tashxisni OSHKOR QILMAYDI, faqat
  so'ralganда obyektiv/lab beradi; `evalSystemPrompt` — anamnez/muloqot/umumiy ball +
  strengths/improvements + to'g'ri tashxis. `modules/me/patient.ts` — get/send/finish/
  reset (assertTopicOpen + kvota, kind PATIENT/PATIENT_EVAL). Frontend: `lesson/PatientTab.tsx`
  (fokus rejim — bemor kartasi + chat + "Yakunlash"→tashxis modali→baholash natijasi
  ProgressRing bilan), `ContentView`/LessonView += `patient` (bosqich EMAS), CaseTab
  yuqorisида kirish banneri (`?view=patient`). **Real Gemini smoke 13/13**: bemor
  keysga mos javob berdi (holsizlik/bosh aylanishi/hansirash), tashxis oshkor qilinmadi,
  baholash to'g'ri tashxisni tan oldi (III daraja AV blokada). Interval smoke 6/6.
  tsc+build ikkala tomonда toza.

- **Modul 27 — O'zlashtirish kengaytmasi: Takrorlash + Mashg'ulotlar (2026-07-23).**
  Reja: `.claude/plans/ozlashtirish-takrorlash-mashgulotlar.md`. `/app/grades` endi
  3 tab (`?sub=`): **Baholar** (eski sahifa, `GradesHome`) | **Takrorlash**
  (badge=due soni) | **Mashg'ulotlar**. **(A) Takrorlash** (`grades/ReviewTab.tsx`):
  kross-mavzu sessiya — `flashcards.ts::getReviewSession` (due kartalar BARCHA
  mavzulardan, 60 tagacha, mavzu konteksti bilan; belgilash mavjud per-topic
  endpoint orqali — interval mantig'i bir joyda) + `getReviewStats` (dueNow/
  reviewedToday/knownPct/upcoming). UI: 4 stat karta + katta karta-pleyer
  (CardFace reuse, mavzu badge, 1/2 klaviatura) + yakuniy ring + o'ng ustunда
  kelgusi takrorlar jadvali. Dashboard "Bugun takrorlang" endi shu tabga
  (`?sub=takrorlash&topic=`). **(B) Mashg'ulotlar** (`grades/PracticeTab.tsx`,
  yangi `modules/me/practice.ts` — AI YO'Q, bahoga/progressga ta'sir YO'Q):
  (1) **Virtual bemor amaliyot markazi** — barcha OCHIQ mavzulardagi published
  keyslar gridi (bemor ismi bilan) + "Tasodifiy bemor" tugmasi → mavjud
  `?view=patient` roleplay (buyurtmachi: "hoxlagan payt kirib har xil keyslar");
  `getPatientPractice` loadCourse/computeTopics reuse. (2) **Xatolar ustida
  ishlash** — zaif mavzular (xato test savollari FAQAT yakunlangan urinishdan —
  javob allaqachon reveal, sizdirish yo'q; xato keys qadamlari; known=false
  kartalar) → mashq pleyeri: variant → darhol izoh (+sourceFragment) → yakunда
  ring + "Konspektni qayta o'qish". Route'lar: `/me/review/{session,stats}`,
  `/me/practice[/patients|/:topicId]` (⚠️ patients :topicId'dan OLDIN).
  i18n `review.*`/`practice.*`/`grades.tab*`; grades title endi "O'zlashtirish"/
  "Успеваемость". **Smoke 14/14** (session/belgilash/stats/overview/set/patients).
  Faza C (AI yangi savollar — o'qituvchi tasdig'i bilan) rejada, qurilmagan.

- **Modul 28 — O'qituvchi paneli talaba modullari bilan bog'landi + guruh chati
  BEKOR (2026-07-23).** Reja: `.claude/plans/teacher-modul28.md`. Tamoyil:
  bitta ma'lumot — ikki qarash (talaba Modul 26/27 ↔ o'qituvchi ko'zgusi).
  **(Faza 0) Guruh chati BUTUNLAY olib tashlandi** (buyurtmachi; AI-tutor va
  virtual bemor chatlariga tegilmagan): nav/route/sahifa/tab/hook/route'lar/
  `modules/chat/` o'chirildi, `/app/chat`→redirect; `CourseChatMessage` jadvali
  bazада qoladi (Glossary presedenti). Modul 25 yozuvi tarixiy — kod endi yo'q.
  **(Faza 1) Guruh xatolari xaritasi** — `modules/courses/mistakes.ts::
  getCourseMistakes` (savol darajasida xato% + distraktor taqsimoti + xato
  qilganlar ismlari; keys qadamlari ham; mavzu severity). Mezonlar talaba
  `practice.ts::topicMistakes` bilan BIR XIL — raqamlar mos. UI: ProgressTab
  ostида `MistakesMap` (severity badge, ochiladigan savol qatorlari, variant
  barlari) + **"Mashq qildirish"** → QuickTaskModal prefill (talabaning
  `?sub=mashgulot` deep-linki). `GET /teach/courses/:id/mistakes`.
  **(Faza 2) AI tavsiyaviy baho + bemor logi** — `CaseAttempt += aiSuggestJson`
  (kesh; migratsiya `case_ai_suggest`); `review.ts::suggestCaseScore` (kind
  CASE_SUGGEST, kvota; {score,rationale,missed[]}; FAQAT tavsiya — yakuniy
  baho o'qituvchida); review detail += `autoScore`/`aiSuggest`/`patientSession`
  (talabaning bemor suhbati + eval, read-only). UI: CaseReviewQueue'da
  AiSuggestCard ("Qo'llash: N" ball inputга ko'chadi) + PatientSessionCard.
  ⚠️ **i18n dublikat-kalit saboqi**: ikkita bir xil top-level JSON kalit
  (student "review" + teacher "review") — JSON.parse jimgina birinchisini
  yutadi; teacher bo'limi git tarixидан tiklandi, talaba tabi `reviewTab`
  prefiksiga ko'chdi. YANGI i18n bo'lim ochishdan oldin kalit bandligini tekshir!
  **(Faza 3) Virtual bemor ssenariysi** — `caseSchema += patientBehavior`
  (o'qituvchi yozadi, migratsiyasiz); patientSystemPrompt "O'QITUVCHI QO'SHIMCHA
  QOIDALARI" (xavfsizlik ustuvor); CaseEditor "Bemor xulqi" + 4 shablon.
  Real Gemini smoke: "EKG faqat so'ralganda" — bemor amal qildi.
  **(Faza 4) Amaliyot faolligi** — `getStudentDetail += practiceSignals`
  (kartalar+bilaman%, bemor mashqlari+o'rt.ball, AI-tutor savollari);
  StudentDetailPage kartasi. Smoke'lar: 8/8 xarita, 8/8 AI-tavsiya (real, 70
  ball+kesh), 4/4 ssenariy, 5/5 signallar. tsc+build ikkala tomonда toza.

- **Fan/kurs BIRLASHDI — endi bitta model (2026-07-23, foydalanuvchi: "fanlar va
  kurslar bitta qivorgin").** Ilgari `Subject` (fan: nom+kafedra+mavzular) va
  `Course` (fan-ref+o'qituvchi+guruh+semestr) alohida edi — endi **Course yagona
  birlik**: `name`+`description`+`departmentId`+teacher+semestr+yil+guruhlar+
  **mavzular**. Prisma: `Subject` modeli O'CHIRILDI, `Course += name/description/
  departmentId` (`subjectId` o'rniga), `Topic.subjectId → courseId`, `Department.
  subjects → courses`. Migratsiya `20260723170000_merge_subject_into_course`
  (⚠️ DROP+ADD — ma'lumot saqlamaydi; pilotdan oldin, prod ma'lumot yo'q paytida).
  ⚠️ **DB reset falokati:** birlashuv paytida `db push` butun akademik bazani
  o'chirib yuborgan (5 seed user qolgan) VA `_prisma_migrations` jadvalini ham
  tozalagan. Tuzatildi: (1) merge migratsiya SQL `migrate diff` bilan generatsiya +
  `migrate resolve --applied`; (2) barcha 33 migratsiya `migrate resolve --applied`
  bilan **baseline** qilindi (DB sxemasi to'g'ri, faqat tarix yo'qolgandi) →
  `migrate status` = "up to date"; (3) `apps/api/src/scripts/demoRestore.ts` YANGI
  sxemada demo quradi (fakultet→kafedra→guruh→kurslar→mavzular→published test+keys→
  talaba tarixi[67% test 1 xato, keys 1 qadam xato]→fleshkarta→darslar+davomat).
  ⚠️ **`prisma migrate reset` klassifikator tomonidan bloklandi** (destruktiv) —
  shu sabab baseline yo'li tanlandi (bazani buzmaydi). **Backend:** `toCourseOut`
  `subjectName: c.name` **compat alias** beradi (eski o'qituvchi/talaba UI hali
  `subjectName` o'qiydi — tegilmadi); `courses/router` create sxemasi `{name,
  description?, departmentId, teacherId, semester, academicYear, groupIds}`;
  `structureTree` dept ostида `courses[]`; `topics` faqat `courseId`; `subjects.ts`
  moduli+`/teach/subjects` route O'CHIRILDI. users profil endi kurs `name` beradi
  (subjectName EMAS). **Frontend:** admin CoursesPage — fan-picker o'rniga **nom
  input + kafedra select** + kafedra filtri; admin structure — DepartmentPage
  "Fanlar" bo'limi **"Kurslar" (o'qish-uchun ro'yxat → /admin/courses)** ga aylandi,
  EntityKind'dan `subject` olib tashlandi, FacultyPage `nCourses`; UserProfilePage
  `c.name`; **teach/subjects/ sahifalari O'CHIRILDI** (route yo'q edi), topics/api
  `SubjectRow/useMySubjects/useSubject` + `TopicScope` subjectId varianti +
  `TopicRow.subjectId` olib tashlandi, TopicListSection "fan umumiy" izohi ketdi.
  i18n `courses.courseName/department/selectDepartment/allDepartments`,
  `structure.coursesSection/noCoursesInDept`. **Smoke 10/11 (1 "xato" = demo
  tartibi — talaba 1-kursi Nefrologiya, published kontentsiz; Kardiologiya to'liq
  yuriladi: anatomiya IN_PROGRESS→fiziologiya LOCKED).** tsc+build ikkala tomonda
  toza. Demo: student@meduni.uz/student123, teacher.m11demo@meduni.uz/student123,
  admin@meduni.uz/admin123.

- **Sana-rejimi: mavzular DARS JADVALI bo'yicha ochiladi (2026-07-24, foydalanuvchi
  so'rovi).** Ilgari mavzu faqat ketma-ketlik-tugatish bilan ochilardi (N-mavzu
  (N-1) COMPLETED bo'lgach). Endi kurs **`scheduleUnlock`** rejimida mavzu **IKKI
  shart birga** bajarilganda ochiladi: (1) mavzuning dars kuni kelgan (jadval
  sanasi) VA (2) oldingi mavzu ham tugagan (ketma-ketlik). Qulf sababi: avval
  oldingi-mavzu (aktual qadam), u tugagach dars sanasi ("DD.MM.YYYY dan ochiladi").
  **Model:** har mavzuning ochilish sanasi = o'sha mavzuga bog'langan **oxirgi dars
  kuni + 1 kun** ("dars bo'lgan kundan keyin"). Sessiya→mavzu bog'lanishi mavjud
  `LessonSession.topicId` orqali (o'qituvchi Davomat → Dars jadvalida sessiyani
  mavzudan yaratganda). Prisma: `Course.scheduleUnlock Boolean` (migratsiya
  `course_schedule_unlock`, additive). **Kalit arxitektura:** `loadCourse`
  sana-rejimida `scheduleDates` (topicId→ISO) ni kursga BIRIKTIRADI
  (`loadScheduleDates`: sessiyalardan MAX(date)+1), `computeTopics` esa uni SINXRON
  o'qiydi — shuning uchun 11 ta chaqiruv joyi (student yo'li, o'qituvchi progress
  matritsasi, tasks, lesson, `assertTopicOpen` 403) hech biriga tegmasdan avtomatik
  mos ishlaydi. `computeTopics` sana-rejimida qulf sababi "DD.MM.YYYY dan ochiladi"
  yoki "jadvalga qo'shilmagan". `updateCourseSettings` endi `{defaultUnlockRuleJson?,
  scheduleUnlock?}` qabul qiladi, meta `scheduleUnlock` qaytaradi. Frontend
  SettingsTab: "Mavzu ochilish rejimi" tanlovi (Ketma-ketlik | Dars jadvali);
  sana-rejimida tugash-mezoni formasidan `notBeforeDate` yashiriladi (`hideDate`).
  **Tugash mezoni (quizPassedPct v.h.)** har ikki rejimda ham mavzu "bajarildi"
  (progress/baho) uchun ishlatiladi — sana-rejimida faqat OCHILISH sanadan, tugash
  esa o'sha mezondan. Demo: `src/scripts/demoSchedule.ts` (Kardiologiya sana-rejimida:
  anatomiya darsi o'tgan→ochiq, fiziologiya oxirgi darsi kelajakda→qulf). Smoke 7/7
  (HTTP): fizio LOCKED "29.07.2026 dan ochiladi", qulf mavzu→403, meta toggle,
  OFF'da sabab ketma-ketlikka qaytadi. tsc+build toza. ⚠️ Sana-arifmetikasi UTC
  emas, mahalliy: `loadScheduleDates` `setDate(+1)` + `toISOString().slice(0,10)`;
  `computeTopics` `today` UTC ISO — dev'da mos, prod TZ farqi bo'lsa tekshir.

- **O'qituvchi ish oqimi: kurs yaratish + Darslar hub (2026-07-24, foydalanuvchi
  so'rovi).** Buyurtmachi: o'qituvchi kirib kurs yaratsin, yo'qlamani oson (bugungi
  darslar/guruhlar orqali) qilsin. **(Faza 1) O'qituvchi o'zi kurs yaratadi** (ilgari
  faqat admin): `service.ts::teacherCreateCourse` (kafedra o'qituvchi TeacherProfile'dan,
  guruhlar shu FAKULTETdan — begona → 400; `createCourse` reuse, talabalar avto
  yoziladi) + `teacherCourseFormOptions` (kafedra nomi + fakultet guruhlari). Route:
  `GET /teach/course-form-options`, `POST /teach/courses`. Frontend: TeachCoursesPage
  "+Yangi kurs" modal (nom + kafedra[avto] + semestr + yil + guruh chip) → yaratgach
  kurs sahifasiga o'tadi. Smoke 6/6. **(Faza 2) Darslar hub** (`/teach/schedule`, nav
  "Darslar"): `attendance.ts::getTeacherSessions` — o'qituvchining BARCHA kurslaridagi
  darslar (sana oralig'i + qidiruv kurs/guruh/mavzu) + har dars kurs/guruh/holat
  (UNMARKED/PARTIAL/FULL) + marked/roster. `GET /teach/sessions`. UI: hafta ko'rinishi
  (‹hafta› + Bugun, bugun brand ring; bo'sh kunlar yashirin), qidiruvda barcha sanalar
  yassi ro'yxat; har dars bir bosishda "Yo'qlama" → mavjud AttendanceModal; "Yangi dars"
  → kurs tanlab SessionModal. `useMarkAttendance`/`useCreateSession` endi
  `["teacher-sessions"]` ni ham invalidatsiya qiladi. ⚠️ i18n prefiksi **`teachSchedule`**
  (talaba `schedule` band — Modul 28 dublikat-kalit sabog'i). Smoke 4/4. **(Faza 3)**
  Dashboard "Bugungi darslar" bo'limi (login qilib darrov yo'qlama; `useTeacherSessions`
  bugungi oraliq + AttendanceModal, "Barcha darslar →"); TeachGroupsPage qidiruv
  (guruh/fakultet/kurs). Demo: `demoSchedule.ts` sessiyalari (07-20/22/28) + bugungi
  dars qo'shildi. tsc+build ikkala tomonda toza. **Biznes o'zgarishi:** kurs yaratish
  endi admin+o'qituvchi (ikkalasi ham; teacher o'z kafedrasida).

- **Haftalik takroriy jadval: darslar AVTO hosil bo'ladi + guruh profili qayta
  qurildi (2026-07-24, buyurtmachi).** Muammo: o'qituvchi har dars uchun qo'lda
  "yangi mashg'ulot" yaratardi — bu keraksiz. Yechim: **haftalik takroriy jadval**
  (bir marta sozlanadi) → darslar avtomatik paydo bo'ladi; o'qituvchi faqat
  yo'qlama/baho qo'yadi. Prisma: `ScheduleSlot` (courseId, weekday 0-6=Du..Ya,
  startTime "HH:MM", room) — migratsiya `schedule_slots`. **Backend
  `modules/courses/timetable.ts`:** slot CRUD (kurs egasi; dublikat kun+vaqt→400);
  `getTeacherLessons` — slotlardan [from..to] darslarni **hosil qiladi** (qo'lda
  yaratilmaydi) + yo'qlama holati; `getGroupTimetable` — guruh kurslari slotlari;
  `rosterByDate`/`markByDate` — yo'qlama **(kurs, sana)** bo'yicha, `LessonSession`
  birinchi belgilashda **LAZY** yaratiladi (ensureSession: o'sha kun bo'yicha
  find-or-create). Routes: `/teach/courses/:id/schedule-slots` (GET/POST),
  `/teach/schedule-slots/:id` (DELETE), `/teach/lessons`, `/teach/groups/:id/timetable`,
  `/teach/attendance-by-date` (GET/POST). Smoke 10/10. **Frontend:** guruh profili
  (GroupProfile) **radikal soddalashdi** — 2 tab: "Dars jadvali" (haftalik ko'rinish,
  slotlardan avto darslar, bir bosishda yo'qlama `RollCallModal`, "Jadval sozlash"
  `TimetableSetupModal`: kurs+kun+vaqt+xona) + "Talabalar" (best/behind, rank).
  **Jurnal/Sessiyalar/Hisobot tablari OLIB TASHLANDI** (JournalView/SessionsView/
  ReportView/AttendanceModal/SessionModal endi o'lik — ishlatilmaydi). Mashg'ulotlar
  hub (TeachSchedulePage) + Dashboard "Bugungi mashg'ulotlar" endi `useTeacherLessons`
  (hosil qilingan darslar) — **qo'lda yaratish YO'Q**. `demoTimetable.ts` (Kardiologiya
  haftalik jadval). ⚠️ **Sana mahalliy** (dayKey lokal, slot vaqti mahalliy Date) —
  prod TZ da tekshir. tsc+build ikkala tomonda toza.

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
cd apps/api; npm run dev                       # Express, port 8000
cd apps/web; npm run dev                       # Vite, port 3000
```
⚠️ Turbo'ga o'tilgach ildizda `npm run dev:api` YO'Q — API'ni `apps/api` ichidan
ishga tushir. Prisma migratsiya/generate oldidan API'ni to'xtat (dev-server query
engine DLL'ini ushlab turadi → EPERM).

**Muhim:**
- Eski stack (FastAPI + Next.js, M1–M8 + R1) — `pre-rewrite-fastapi-nextjs` branchida
  saqlangan. Kerak bo'lsa eski logika/UX'ni o'sha yerdan ko'r.
- ⚠️ `GEMINI_API_KEY` (pulli kalit) `apps/api/.env`da (gitignore — commit
  QILINMAYDI, tracked fayllarda yo'q). Matn+rasm generatsiyaga to'liq ulangan va
  ishlaydi. Kalit chatga yozilgan — **skomprometatsiya deb hisobla**, pilot/prod'dan
  oldin aistudio.google.com'da yangila.
