# O'qituvchi UX soddalashtirish (2026-08-02)

## Kontekst

Buyurtmachi: *"Если учитель зайдет сюда, он испугается от новой системы... нужно
упростить, уменьшить данных, чтобы всё структурно плавно пошло."*

Platforma funksional jihatdan tugagan (Modul 1-28), lekin **yuza** o'sib ketgan.
O'lchandi:

- O'qituvchida **6 nav bo'limi**, ustiga ikkinchi daraja (SubNav) va ba'zi
  sahifalarda uchinchi (StudentDetailPage o'z pill-bari) — bir ekranda 3 qavat
  gorizontal navigatsiya.
- **61 ta `StatCard`/`HeroTile` 12 sahifada** — deyarli har sahifa 4 ta raqam
  qatori bilan ochiladi. Ko'pi hech narsani filtrlamaydi (bezak).
- `TeachDashboard` — bitta skrollda **8 bo'lim** (hero + 3 mini-stat, 4 quick
  action, bugungi darslar, 3 stat karta, analitika bloki, kurslar).
- `DigestSection` — kelishi bilan **20-60+ input** chizadi.
- `ProgressTab` ichida **ikkita to'liq analitika moduli** (heatmap + MistakesMap).
- Loyihaning O'Z qoidasi buzilgan (CLAUDE.md §4 *"bitta fakt — bitta joy"*):
  bugungi darslar Dashboard va Jadvalda; vazifa sonlari Dashboard va
  TasksPage'da; guruh statistikasi TeachGroupsPage va GroupProfile'da.

## Buyurtmachi qarorlari (so'ralgan va tasdiqlangan)

1. **Avval o'qituvchi**, keyin talaba (alohida faza).
2. **Progressiv ochilish — HECH NARSA O'CHIRILMAYDI.** Sukut bo'yicha 1 asosiy
   amal + 1-2 raqam; qolgani "Batafsil" ostida. Qaytarib bo'ladigan.
3. Fokus (to'rttasi ham): birinchi kirish / "bugun nima qilaman", dars yaratish
   oqimi (material→AI→chop etish), ortiqcha raqam va analitika, menyu.

## Qabul qilinadigan qoidalar

**STAT DIETASI** (CLAUDE.md §4 ga qo'shiladi, OVOZ IERARXIYASI yonida):

1. Sahifada **eng ko'pi bitta stat qatori**, va faqat kartalar **filtr vazifasini
   bajarsa** (`selected` + `onClick` pastdagi ro'yxat filtriga ulangan).
   Aks holda raqamlar: ro'yxat qatoriga, h1 ostidagi bitta matn qatoriga,
   yoki `Disclosure` ichiga ko'chadi.
2. Qatorda ko'pi bilan 4 karta. 5-chisi — disclosure yoki u jamlagan jadval ichiga.
3. Ota sahifada ko'rsatilgan raqam bola sahifada TAKRORLANMAYDI.
4. Hech kim filtrlamaydigan/harakat qilmaydigan raqam — **matn**, karta emas.

---

## Faza 0 — umumiy qismlar (ko'rinmas, lekin keyingi fazalarni nusxasiz qiladi)

- **`apps/web/src/components/Disclosure.tsx`** (yangi) — `GenerateSection.tsx:39-55`
  dagi mahalliy `Advanced` komponentini umumiylashtirish: chevron + yorliq +
  ixtiyoriy son, sukut bo'yicha YOPIQ, ixtiyoriy `storageKey` (localStorage).
  1, 3, 4, 5-fazalarda yagona "Batafsil" mexanizmi.
- **`apps/web/src/pages/teach/tasks/TaskItemRow.tsx`** (yangi) — `TeachTasksPage.tsx`
  dan `KIND_META`, `ageText()`, badge/trailing quruvchilari va `handleRowClick`
  AYNAN ko'chiriladi. Props: `item`, `onRollCall(target)`, `onDelete(item)`.
  TasksPage va yangi Bosh sahifa ikkalasi ishlatadi (aks holda ~80 qator nusxa).
- **`DigestView.tsx` + `BlockView.tsx`** `pages/student/lesson/` dan
  `apps/web/src/components/lesson/` ga ko'chadi, eski yo'llarda bir qatorli
  re-export qoladi (talaba importlari tegilmaydi). 2-faza uchun kerak —
  rollar bir-biridan import qilmasin.

## Faza 1 — Menyu + Bosh sahifa + birinchi kirish  ⬅ eng katta ta'sir

### 1a. Nav: 6 → 4, `/teach/tasks` va `/teach/schedule` bo'lim ichiga kiradi

**Mexanizm: yo'lsiz (pathless) layout route**, sahifa-bo'yicha `SubNav` EMAS —
`SubNav` mount'da `set(data)`, unmount'da `set(null)` qiladi (`SubNav.tsx:57-64`),
ya'ni uchta aka-uka sahifa bo'lsa 248px panel har almashishda qayta mount bo'lib
sakraydi va massiv uch joyda takrorlanadi.

`apps/web/src/App.tsx` (hozir 88-92-qatorlar):

```tsx
<Route element={<TeachHomeShell />}>
  <Route index element={<TeachDashboard />} />
  <Route path="tasks" element={<TeachTasksPage />} />
  <Route path="schedule" element={<TeachSchedulePage />} />
</Route>
```

Yo'lsiz → **URL'lar bir xil qoladi**. `/teach/schedule` (backend
`tasks/service.ts:206` `attendance_unmarked` uchun chiqaradi), `/teach/tasks`,
`/teach/cases/review?open=`, `/teach/topics/:id?step=` — hech biri buzilmaydi.

**`apps/web/src/pages/teach/home/TeachHomeShell.tsx`** (yangi, ~35 qator,
`TeacherCourseShell.tsx:96-111` shakli): SubNav `Bugun | Vazifalar | Jadval`
(badge = `taskBoard.stats.toDo` "Vazifalar"da), `footer` = "Boshlash qo'llanmasi"
(o'chirilgan onboarding kartasini qayta ochadi), so'ng `<Outlet/>`.

**`TeachShell.tsx`** yangi `items`: Bosh sahifa (badge=toDo) · Kurslar · Guruhlar ·
Sozlamalar.

**⛔ IKKI TUZOQ — ikkalasi ham kodda tasdiqlandi:**

1. **Faol holat.** `RoleShell.tsx:110-113`: `active = end ? pathname===href : …`.
   `/teach` da `end:true` bo'lgani uchun `/teach/tasks` da **birorta rey elementi
   yonmaydi** (mobil tab-barda ham chiziq yo'q — buzuq ko'rinadi); `end` ni olib
   tashlasak esa har `/teach/*` da yonadi. Yechim: `RoleShellItem` ga
   (`RoleShell.tsx:41-51`) `alsoActiveOn?: string[]` qo'shib, hisobga OR bilan
   qo'shish. `packages/ui/SidebarLayout` ga tegilmaydi — RoleShell allaqachon
   hisoblangan `active` uzatadi.
2. **⚠️ Mobil "Yana" paneli YO'QOLADI.** `BottomNav.tsx:46` — `primaryCount = 4`
   sukut; `:99` — `{rest.length > 0 && …}`. Aynan 4 element bo'lsa `rest` bo'sh →
   "Yana" tugmasi CHIZILMAYDI → `moreExtra` (Til / Tema / **Chiqish**) mobilda
   umuman ochilmaydi. Telefondagi o'qituvchi tizimdan chiqa olmaydi. Yechim:
   `RoleShellProps` ga ixtiyoriy `primaryCount` qo'shib, `TeachShell` dan
   `primaryCount={3}` berish (Sozlamalar Til/Tema/Chiqish yoniga tushadi —
   ma'no jihatdan to'g'ri guruh, ustiga 3 tab kattaroq tap-target).
   Qo'shimcha himoya: `BottomNav.tsx:99` → `rest.length > 0 || moreExtra`.

### 1b. Bosh sahifa = "bugun nima qilaman"

`TeachDashboard.tsx` qayta yoziladi (259 → ~150 qator). Yuqoridan pastga:

1. **Salom bandi** — gradient (faqat urg'u, `py-4`), h1 + sana.
   **3 mini-stat OLIB TASHLANADI** (talaba/kurs/guruh — ular Guruhlar va
   Kurslar sahifalarida bor).
2. **`StarterCard`** — faqat trigger bo'lganda (1c).
3. **Bugungi darslar** — mavjud `useTeacherLessons({from:today,to:today})`,
   har qatorda bitta asosiy tugma `Yo'qlama` → `RollCallModal` (o'zgarmaydi).
   **`AsyncSection` ga o'raladi** — hozir (119-125) loading + empty bor, lekin
   **xato holati YO'Q** (4-holat qoidasi buzilgan).
4. **"Bugun bajarish kerak" — ko'pi bilan 5 aniq QATOR.** Hozirgi 3 StatCard
   (`casesToReview` / `contentToApprove` / `studentsBehind`, 166-171) o'rniga.
   Manba: `useTaskBoard().data.items`, `status !== "done"`, avval muddati
   o'tganlar, keyin eng eskisi, `.slice(0,5)`, umumiy `TaskItemRow` bilan.
   Shu uchta raqam AYNAN shu qatorlar — endi ism bilan, mavhum son emas.
   Karta pastida `Hammasi (N) →` va `Keys navbati →` (uning rey elementi yo'q).
   Bo'sh holat = mavjud emerald "hammasi bajarilgan" kartasi.
5. **`<Disclosure label="Analitika" storageKey="meduni.teach.homeAnalytics">`** —
   sukut YOPIQ, ichida hozirgi analitika bo'limi AYNAN (3 ProgressRing, kurs
   BarRow'lari, kelgusi darslar, 2 reyting kartasi, guruh chiplari). Hech narsa
   o'chmaydi — bir bosish naridа, tanlov saqlanadi.
6. **Kurslar** — 3 ta `CourseCard` + "Barchasi" (navigatsiya yorlig'i, statistika emas).

**4 ta QuickAction kartasi O'CHIRILADI** — Vazifalar+Jadval endi SubNav elementi,
Kurslar+Guruhlar rey elementi; bu sof nav dublikati edi.

Natija (1440×900, skrollsiz): salom + bugungi darslar + 5 ta nomli harakat.

### 1c. Birinchi kirish — "3 qadam" kartasi

`apps/web/src/pages/teach/home/StarterCard.tsx` (yangi). Holat sahifadagi
MAVJUD so'rovlardan hosila — **backend o'zgarmaydi, yangi so'rov yo'q**:

| Qadam | Bajarildi shart | Havola |
|---|---|---|
| 1. Kurs yarating | `useTeachCourses().data.length > 0` | `/teach/courses?new=1` |
| 2. Mavzu qo'shing, material yuklang | `dash.stats.totalTopics > 0` | `/teach/courses/{birinchi}/topics` |
| 3. Konspektni tasdiqlang va chop eting | `dash.stats.publishedTopics > 0` | `/teach/courses/{birinchi}/topics` |

- **Trigger:** `dash.data && stats.publishedTopics === 0` (kurssiz, mavzusiz va
  chop etilmagan uchala holatni qamraydi) **va** o'chirilmagan bo'lsa.
- **Holat:** `localStorage["meduni.teachStart." + me.id]` — loyihadagi mavjud
  naqsh (`lib/theme.ts`, `SectionReader.tsx:88`). Foydalanuvchi bo'yicha kalit —
  umumiy demo brauzerda keyingi o'qituvchidan yashirmaydi.
- **Qaytariladi:** `TeachHomeShell` SubNav `footer` dagi "Boshlash qo'llanmasi"
  kalitni tozalaydi.
- Kichik bog'liqlik: `TeachCoursesPage` `?new=1` ni o'qib `NewCourseModal` ochsin.

---

## Faza 2 — Dars yaratish: konspekt sukut bo'yicha O'QISH rejimida

Ikkinchi o'rinda, chunki aynan bu ekran "испугается" ni ko'p ishlab chiqaradi.

**Fayl bo'linishi (ko'chirish AYNAN — qaytarish oson):**
- `DigestSection.tsx` da qoladi: so'rovlar, `draft`, `dirty`, `autogen` effekti,
  `saveAndApprove`, sticky amal paneli + yangi `mode` holati.
- `topics/DigestEditor.tsx` (yangi) — hozirgi `EditableList`/`TermsTable`/
  `CheckpointCard`/`Block` va 300-339 JSX AYNAN ko'chadi.
- `topics/DigestPreview.tsx` (yangi).

**O'qish ko'rinishi — talaba renderlari QAYTA ISHLATILADI.** Tasdiqlandi:
`student/api.ts:245-252` `DigestJson` va `teach/topics/api.ts:57-65` strukturaviy
bir xil (o'qituvchinikida qo'shimcha ixtiyoriy `sections`), `Term` aynan bir xil.

- `DigestView.tsx` — maqsad/tushuncha/atama (3 ustunli jadval + mobil karta
  stack)/fakt/**doza (doim ko'rinadigan amber blok — hozirgi qoidaga mos)**.
- `BlockView.tsx` — bo'lim bloklari (`para`/`list`/`callout`), buzuq AI bloki
  uchun himoyasi bor.
- Token xavfsizligi tekshirildi: `text-brand-tint`, `bg-surface-raised`,
  `text-ink-strong` `tokens.css` da ikkala temada bor.
- i18n: `DigestView` `keyPrefix:"lesson"` ishlatadi — uz+ru da bor, **yangi
  satr kerak emas**, ustiga o'qituvchi talabaning aynan matnini ko'radi.
- **`SectionReader.tsx` QAYTA ISHLATILMAYDI** — `read` bayroqli `LessonSection[]`,
  IntersectionObserver, shrift do'koni kerak. Faqat `BlockView` olinadi.
- **Bo'limlar birinchi marta ochiladi:** hozirgi tahrirlagich `sections[].blocks`
  ni umuman ko'rsatmaydi (faqat checkpoint). Preview'da har bo'lim yig'ilgan
  qator (sarlavha · `minutes` · N blok · checkpoint belgisi), ochilsa `BlockView`.
  Bu yangi qiymat: bugun AI nima yozganini o'qish uchun chop etib, talaba bo'lib
  kirish kerak.
- Preview `draft` ni chizadi (server JSON emas) — saqlanmagan tahrir ko'rinadi.

**Sticky amal paneli holatlari:**

| Holat | Panel |
|---|---|
| o'qish, toza, tasdiqlanmagan | **`Tasdiqlash va davom etish`** · `Tahrirlash` · Ovoz · v{n} |
| o'qish, o'zgargan | `Saqlanmagan…` · `Saqlash` · **`Tasdiqlash va davom etish`** · `Tahrirlash` · Ovoz |
| tahrir | bugungi panel AYNAN + `Ko'rish` |
| tasdiqlangan | emerald `Tasdiqlangan` + `Tahrirlash` |

`saveAndApprove` o'zgarmaydi. `draft` konteynerda — rejim almashsa tahrir
yo'qolmaydi. Rejim sukut bo'yicha URL'da EMAS (`?step=digest` deep-link tinch
ko'rinishga tushsin), lekin `?edit=1` qabul qilinadi.

**Shu fazada yana ikki yig'ish:**
- `GenerateSection.tsx` — 4 ta tur kartasi `<Disclosure>` ichiga; sukut bo'yicha
  faqat `BatchCard` ko'rinadi (ichidagi `Advanced` sozlamalar joyida qoladi).
- `PublishSection` qadami — `TopicUnlockRule` (7 boshqaruv) `<Disclosure>` ichiga;
  faqat "Chop etish" tugmalari ko'rinadi.

**Stepper `SubNav` ga AYLANTIRILMAYDI:** `SubNavItem` da faqat `badge?: number`
bor, done/current/locked ni ifodalay olmaydi, mobilda tasma+stepper ikkalasi
chiqadi. O'rniga arzon tuzatish: `TopicConstructor.tsx:138-143` dagi quruq
`← Orqaga` o'rniga `Kurs nomi / Mavzu nomi` breadcrumb.

---

## Faza 3 — Raqam dietasi

Yuqoridagi STAT DIETASI qoidasi bo'yicha; o'qituvchi tomonidan **14 karta** ketadi.

- **`TeachGroupsPage.tsx:162-167` — 4 kartaning hammasi.** Faqat `sBehind` filtr.
  O'rniga: sarlavha ostidagi qator `N guruh · N talaba · o'rtacha X%`
  (`text-note text-ink-soft`), "Orqada N" esa sort `Select` yonidagi rose **filtr
  pill** (`TeachTasksPage.tsx:191-214` markupi), `onlyBehind` ni boshqaradi.
  Progress har qatordagi `GroupCard` ringida allaqachon bor.
- **`TeachSchedulePage.tsx:180-185` — 4 kartaning hammasi.** Birortasi filtr emas.
  O'rniga bitta qator `Bu hafta: 12 dars · 4 yo'qlama kutmoqda`, "yo'qlama
  kutmoqda" — **bosiladigan toggle** (`status !== "FULL"`). Ya'ni kartalar faqat
  nazarda tutgan amal endi haqiqatan bor. Ustiga `search` + guruh `Select`
  `<Disclosure label="Filtr" count={faolFiltrlar}>` ichiga.
- **`StudentDetailPage.tsx` — 5 karta → 2 raqam + o'z tab-bari o'ladi.**
  (a) Xususiy 3-pill bar o'rniga `<SubNav …?tab=…/>` (`GroupProfile.tsx:586-595`
  bilan bir xil) — shunda SubNav ilovadagi YAGONA ikkinchi daraja mexanizmi bo'ladi.
  (b) Shapkada `ProgressRing` (umumiy %) + davomat %; o'rtacha test, keys sonlari
  va `practiceSignals` `overview` tabi ichiga (u yerda yorliq va konteksti bor).
- **`ProgressTab.tsx:257-263` — 5 → 4.** Bu qator O'RNINI OQLAYDI (5 tadan 4 tasi
  filtr) — qoladi. Faqat `statAvg` (yagona filtr bo'lmagani) tushadi — qiymati
  heatmap'ning guruh-o'rtacha qatorida (`:173`) allaqachon bor.

**`TeachTasksPage` ning 4 kartasiga TEGILMAYDI** — ular filtr, qoidaga mos.
Uning haqiqiy muammosi boshqa: 6 filtr holati BITTA `filter` o'zgaruvchisiga
yozadi, `statDone` (`:178`) va `filterDone` chipi (`:130`) bir xil holatni
qo'yadi. Yechim — o'lchamlarni ajratish: kartalar = **holat** (todo/overdue/
waiting/done), chiplar = **manba** (`Manba:` yorlig'i bilan Hammasi/Kafedra/
Talabalar), dublikat `done` chipi ketadi. Bu boshqaruv dublikatini olib tashlash,
funksiya o'chirish emas.

---

## Faza 4 — Kurs tablari: ikki analitikani ajratish

`ProgressTab` 337 qator (5 karta, qidiruv, sort, ko'rinish toggle, Excel,
heatmap, modal) va **ustiga** `MistakesMap` (306 qator, 3 qavat akkordeon, o'z
so'rovi, o'z `QuickTaskModal`i) `:334` da inline. O'qituvchi tomonidagi eng
og'ir bitta ekran.

Yangi kurs SubNav (`TeacherCourseShell.tsx:99-105`) — 6 element, mavjud
route'lar saqlanadi: Mavzular · Dastur · Guruhlar · Natijalar · **Xatolar**
(yangi `…/mistakes`) · Sozlamalar. Yangi ingichka
`course/MistakesTab.tsx` → `<MistakesMap courseId/>`; `App.tsx:103` yoniga route.

**Sukut ko'rinish list'ga o'tadi** (`ProgressTab.tsx:221` hozir `"heatmap"`):
talaba×mavzu jadvali gorizontal skroll talab qiladi va telefonда o'qib
bo'lmaydi — aynan "samolyot kabinasi" taassuroti. List qatorlari = ism +
progress bar + oxirgi faollik + o'rtacha test. Toggle qoladi, tanlov
`localStorage["meduni.teach.progressView"]` da saqlanadi. Shu o'tishda
`sort` + `Excel` (`:276-290`) `<Disclosure>` ichiga.

---

## Faza 5 — Qolgan sayqal (kichik, oxirida)

- `TopicListSection.tsx:37-56` — 6 quvur chipi → **2**: `Material N` va bitta
  `Kontent 2/4`; bosilsa 4 ta tur chipi ochiladi. Qatordagi element ~11 → ~6.
- `GroupProfile` `TimetableSetupModal` (~24 boshqaruv) → ikki qadam:
  1) kurs + sana oralig'i → 2) kunlar/vaqtlar. `useSetupCycle` payload'i o'sha.
- `CaseReviewQueue.tsx` — 5 filtr: `status` + qidiruv ko'rinadi, `course`/
  `topic`/`sort` `Disclosure` ichiga.

---

## Faza 6 — Talaba tomoni (KEYINGI SESSIYA, buyurtmachi: "потом ученик")

Yo'nalish (batafsil reja o'sha sessiyada):
- `StudentDashboard.tsx` (597 qator, ilovadagi eng zich sahifa) — 4 hero tile +
  6 chap bo'lim + 3 rail karta ≈ 25-40 bosiladigan nishon. Bosh sahifa "bugungi
  ish"ga qisqaradi, qolgani `Disclosure`/rail ichiga.
- Dars sahifasi o'rganish rejimida ≈35-55 nishon (5 rail bloki + TOC + material
  chiplari + shrift + audio + checkpoint + chat). `overview` sukut ekan (yaxshi),
  lekin rail ikkinchi darajasi va StageStepper bir xil faktni ikki marta aytadi.
- Raqam dietasi: `SchedulePage` 4 tile, `StudentCoursesPage` 4 tile + 4 filtr,
  `ReviewTab` 4 tile (birortasi filtr emas).

---

## Tekshirish (har faza uchun majburiy darvoza)

Playwright + real Chrome (`channel:"chrome"`), real login
`teacher.m11demo@meduni.uz` / `student123`; API `cd apps/api; npm run dev` (:8000),
web `cd apps/web; npm run dev` (:3000).

- `npx tsc --noEmit` toza · `npm run build` toza (ikkala tomonda)
- Brauzer konsoli toza; xom `key.path` matn chizilmagan (uz **va** ru)
- 390px: `document.documentElement.scrollWidth <= innerWidth` har tegilgan sahifada
- Yorug' **va** qorong'i tema
- Har tegilgan ro'yxat 4 holatda (yuklanmoqda / bo'sh / xato / normal)

**Faza 1 uchun alohida regressiya tekshiruvlari:**
- rey 4 element, badge Bosh sahifada; `/teach/tasks` va `/teach/schedule`
  ochiladi VA Bosh sahifa yonadi + to'g'ri panel elementi belgilanadi
- 390px → **3 tab + "Yana", va Yana ichida Sozlamalar/Til/Tema/Chiqish bor**
  (bu — `BottomNav` tuzog'ining tekshiruvi)
- `quickAction.type==="attendance"` qatori Bosh sahifadan `RollCallModal` ochadi
- Analitika disclosure holati qayta yuklashdan keyin saqlanadi
- orqaga/oldinga tugmalari ishlaydi

**Faza 2:** o'qish rejimida DOM'da `input,textarea` soni === 0; `Tahrirlash`
ochadi; tahrir → o'qish → o'zgarish ko'rinadi + `Saqlash` chiqadi;
`Tasdiqlash va davom etish` PUT+POST yuboradi va `?step=generate` ga tushadi;
`?step=digest&autogen=1` bir marta generatsiya qilib o'qish rejimida qoladi;
doza bloki bosishsiz ko'rinadi.
