# Tuzatish rejasi: ishlamaydigan tugmalar + ekran tuzilishi (2026-09-08)

Buyurtmachi: *«yoqmadi menga unchalik ham to'g'risini aytsam… keyin ko'p tugmalar
ham ishlamayapdi»* → **bitta reja**: avval yolg'on gapiradigan interfeys
(bosiladigandek ko'rinib, hech narsa qilmaydigan tugmalar), keyin ekran tuzilishi.

Manba: kod bo'yicha to'liq tekshiruv (har `<button>` balансланган-qavs parseri
bilan, 130+ navigatsiya nishoni va ~180 `api()` yo'li route jadvali bilan
solishtirildi) + jonli API o'lchovlari. Har band `file:line` bilan, tasdiqlangan
va tekshirish kerak bo'lganlari ajratilgan.

Belgilar: ✅ bajarilgan · 🟡 qisman · ⬜ boshlanmagan

---

## 0. Nima uchun "ko'p tugma ishlamayapdi" degan taassurot paydo bo'ldi

Aslida **butunlay bo'sh** (`onClick` yo'q) tugma butun ilovada YO'Q — buni parser
tasdiqladi. Muammo boshqa: bir nechta element **bosiladigandek ko'rinadi**
(kursor, hover, ring), lekin bosilganda hech narsa sodir bo'lmaydi yoki noto'g'ri
narsa sodir bo'ladi. Foydalanuvchi uchun bu "ishlamaydi" bilan bir xil — hatto
yomonroq, chunki u o'zini aybdor his qiladi ("noto'g'ri bosdimmi?").

Eng ko'p uchraydigani — **dekanat bergan vazifa qatori**: u o'qituvchining bosh
sahifasida turadi va bosilganda hech narsa qilmaydi.

**Brauzer obhodi (uchala rol, 18 sahifa) yana bir narsani ko'rsatdi**, statik
tahlil ko'ra olmagan: topilgan 15 ta "javob bermaydigan" elementning **9 tasi
bitta naqsh** — tugma **o'zi allaqachon turgan holatni** o'rnatadi (A5). Ya'ni
bu 9 ta alohida bug emas, bitta qoida yo'qligi. Shuning uchun F1 aynan shundan
boshlanadi: bitta qoida — to'qqiz joy.

---

## A. TUGMALAR — tasdiqlangan nosozliklar

### A1. Dekanat/admin bergan vazifa qatori bosilmaydi ⬜ **[eng muhim]**
`apps/web/src/pages/teach/tasks/TaskItemRow.tsx:161` + `apps/api/src/modules/tasks/service.ts:296`

```ts
// backend: har tayinlangan vazifa
link: a.linkUrl ?? "",                    // linkUrl HECH QACHON to'ldirilmaydi
quickAction: { type: "done", taskId: a.id },

// frontend
onClick={qa || item.link ? handleClick : undefined}   // qa bor → onClick BERILADI
// handleClick: attendance emas → `if (item.link)` → "" falsy → HECH NARSA
```

`quickAction` mavjudligi uchun qator `cursor-pointer hover:bg-bg` oladi
(`components/TaskFeedRow.tsx:56-57`), ya'ni bosishga chaqiradi — va jim qoladi.
`linkUrl` maydoni na `CreateTaskBody` (`pages/admin/api.ts:224`), na
`AssignTaskBody` (`pages/teach/api.ts:544`) da yo'q, shuning uchun `createTask`
har doim `null` yozadi (`service.ts:698`).

**Tuzatish:** `onClick` ni faqat haqiqiy amal bo'lganda berish
(`qa?.type === "attendance" || item.link`). **Va** vazifa yaratishda `linkUrl`
ni ixtiyoriy maydon sifatida qo'shish — dekan "mavzuni tayyorlang" desa,
havola bilan bersin.

### A2. "Qayta yaratish" tugmasi abadiy o'chiq ⬜
`apps/web/src/pages/teach/topics/GenerateSection.tsx:108`

```ts
const status = useBatchStatus(topic.id, run.isSuccess || run.isPending); // :79
const steps = status.data?.steps ?? [];                                  // bo'sh
disabled={busy || (missing.length === 0 && !steps.length)}               // :108
{missing.length === 0 && !busy ? t("batchRegenerate") : …}               // :116
```

Kontent 4/4 bo'lgan mavzuda (skrinshotdagi *antroventricular*, *adrenalin*)
tugma **"Qayta yaratish"** deb yozilgan holda o'chiq turadi va hech qachon
yonmaydi: `steps` faqat generatsiya boshlangandan keyin to'ladi.

**Tuzatish:** `missing.length === 0` bo'lganda tugma FAOL bo'lsin va barcha
turlarni qayta yaratsin (tasdiq oynasi bilan — bu pulli amal), yoki tugma
umuman ko'rsatilmasin. Hozirgi holat — ikkalasining eng yomoni.

### A3. `StatCard` — `div role="button"`, holati e'lon qilinmaydi ⬜
`packages/ui/src/components/StatCard.tsx:100-115`

Filtr vazifasini bajaruvchi kartochka `<div>` (tugma emas), `selected` faqat
chegara rangini o'zgartiradi, `aria-pressed` yo'q. Natija: bosgan odam
o'zgarishni sezmasligi mumkin ("bosildimi?"), skrinrider uchun umuman filtr emas.
Bu **o'zim yaratgan** komponent, ya'ni o'z qoidamni buzganman.

**Tuzatish:** `onClick` bo'lsa `<button type="button" aria-pressed={selected}>`,
faol holatda fon ham o'zgarsin (faqat chegara emas).

### A4. Kalendar katagidagi dars "pill"lari bosiladigandek ko'rinmaydi ⬜
`apps/web/src/components/MonthCalendar.tsx:109-124`

`GroupProfile.tsx:252` va `home/LessonsBlock.tsx:169` ularga `onClick` beradi
(yo'qlama oynasini ochadi), lekin element — oddiy `<span>`: `cursor-pointer`
yo'q, `role` yo'q, fokus halqasi yo'q. Ishlaydi, lekin **ishlamaydigandek
ko'rinadi** — "bosdim, hech narsa bo'lmadi" aynan shundan.

### A5. "O'zi turgan holatini qo'yadigan" filtrlar ⬜ **[tizimli xato]**
Brauzer obhodi topdi (statik tahlil ko'ra olmaydi). Bir nechta kartochka
bosilganda **o'zi allaqachon turgan holatni** o'rnatadi, ya'ni klik hech narsa
qilmaydi — lekin kartochka bosiladigandek ko'rinadi va yoritilgan:

| Joy | Kod | Nima bo'ladi |
|---|---|---|
| `pages/student/StudentTasksPage.tsx:177` "Bajarilgan" | `setHistoryOpen(true)` | `historyOpen` **sukut bo'yicha `true`** (`:125`) — klik hech narsa qilmaydi |
| `pages/student/StudentTasksPage.tsx:154` "Ochiq vazifalar" | `setFilter("all")` | `filter` sukut bo'yicha `"all"` |
| `pages/student/StudentCoursesPage.tsx:182` "Joriy" | `backToCurrent()` | sahifa ochilishida allaqachon joriy semestr (`:115-119`) |
| `pages/student/GradesPage.tsx:320` "Barchasi" | `setFilter("all")` | `filter` sukut bo'yicha `"all"` |
| `pages/teach/home/LessonsBlock.tsx:202` "Hafta" | `onMode("week")` | rejim sukut bo'yicha `week` |
| `pages/teach/home/LessonsBlock.tsx:256` "Bugun" (oy) | joriy oyga qaytaradi | oy allaqachon joriy — hech nima o'zgarmaydi |
| `pages/teach/group/GroupProfile.tsx:616` kurs chiplari | `setTab("courses")` | `?tab=courses` da allaqachon shu tab ochiq |
| `/app/attendance?sub=jadval` "Hafta"/"Bugun" | o'sha naqsh | sukut holat |
| `/app/profile` "O'zbek (lotin)" | `changeLanguage("uz")` | til allaqachon uz |

**To'g'ri naqsh loyihada ALLAQACHON bor:** `LessonsBlock.tsx:249` — hafta
"Bugun" tugmasi faqat `weekOffset !== 0` bo'lganda **umuman chizilmaydi**.
Aynan shu qoida qolgan joylarga ko'chiriladi.

**Tuzatish (uchta yo'ldan biri, holatga qarab):**
1. **Toggle** — filtr kartochkasi bo'lsa (`toggle("all")` naqshi
   `StudentTasksPage.tsx:143` da bor): ikkinchi bosish filtrni tozalaydi.
2. **Chizilmaydi** — "Bugun"/"Joriyga qaytish" kabi qaytaruvchi tugma o'z
   holatida turganda render qilinmaydi (`LessonsBlock.tsx:249`).
3. **`aria-pressed` + faol ko'rinish** — segmented tanlagichda tugma qoladi,
   lekin `disabled`+`aria-pressed="true"` bo'ladi: skrinrider ham, sichqoncha
   ham "bu allaqachon tanlangan" deb tushunadi.

Qoida (yangi, CLAUDE.md §4 ga qo'shiladi): *o'zi turgan holatini qo'yadigan
tugma bo'lmasin — u toggle bo'ladi, chizilmaydi yoki bosilmaydigan ko'rinadi.*

### A5B. Bir ishni qiladigan IKKI boshqaruv ⬜
`pages/student/GradesPage.tsx:279-311` — to'rtta `HeroTile`, lekin ular atigi
**ikki** amalni bajaradi: 1- va 2-kartochka ikkalasi `toggle("quiz")`,
3- va 4-kartochka ikkalasi `toggle("case")`. Ya'ni "Sinov bahosi" ni bosish
"O'rtacha ball" ni bosish bilan aynan bir xil natija beradi. Ustiga o'sha
filtrning uchinchi nusxasi pastdagi segmented tasmada (`:320`).
Bitta fakt — bitta joy (§4) buzilgan: **bir filtr — uch boshqaruv**.

**Tuzatish:** segmented tasma qoladi (u filtr ekani ochiq ko'rinadi),
kartochkalar esa **ko'rsatkich** bo'ladi (bosilmaydi) — yoki har kartochka
o'z filtrini olsin (o'rtacha→quiz, o'tilgan→passed, keys→case, tekshiruvda→
pending). Ikkinchisi afzal: kartochka bosilsa haqiqatan boshqa ro'yxat chiqadi.

### A5C. Kurs chipi qaysi kursligini bildirmaydi ⬜
`GroupProfile.tsx:615-616` — shapkadagi har kurs chipi (`Nefrologiya`,
`Kardiologiya`) **bir xil** `setTab("courses")` chaqiradi. Chipda kurs nomi
turibdi, `title` esa "hisobotni ochish" deydi — ya'ni foydalanuvchi SHU kurs
hisobotini kutadi, lekin barcha kurslar ro'yxati ochiladi.

**Tuzatish:** chip `setTab("courses")` bilan birga o'sha kursning kartasiga
**skroll qilsin va uni yoritsin** (`?tab=courses&course=<id>`), yoki chiplar
umuman bosilmaydigan yorliqqa aylansin.

### A6. Filtr ishlaganini bilib bo'lmaydi ⬜
`StatCard` `selected` faqat **1px chegara** rangini o'zgartiradi. Demo
ma'lumotida "Jami 10 / Faol 10 / Orqada 10" — uchala filtr bir xil ro'yxatni
beradi, ya'ni bosgandan keyin ekranda **hech nima** o'zgarmaydi. Filtr ishlaydi,
lekin foydalanuvchi uchun u ishlamaydi.

**Tuzatish:** A3 bilan birga — faol filtr foni ham o'zgarsin, va ro'yxat ustida
"10 tadan 10 tasi ko'rsatilmoqda · filtrni tozalash" qatori chiqsin. Natija
bir xil bo'lsa ham, tizim javob berayotgani ko'rinsin.

---

## B. TUGMALAR — noto'g'ri ish qiladiganlar (tekshirish kerak)

| # | Joy | Muammo |
|---|---|---|
| B1 | `ProgressTab.tsx:403` + `teachRouter.ts:271` | "Xatolar" ko'rinishida **Excel** bosilsa `?view=mistakes` ketadi, backend uni `heatmap` ga aylantiradi → **boshqa hisobot** yuklanadi, ogohlantirishsiz |
| B2 | `ProgressTab.tsx:318` | "Xatolar" ko'rinishi `localStorage` ga yoziladi, lekin o'qishda faqat `heatmap`/`list` qabul qilinadi → **qayta yuklashda tanlov yo'qoladi** |
| B3 | `CaseReviewQueue.tsx:432-444` | `?open=<id>` havolasi (StudentDetailPage "Baholash" va avto-vazifadan) tekshirilgan keysga olib borsa, avto-tanlov uni **boshqa talabaga** almashtiradi — xabarsiz |
| B4 | `ControlPage.tsx:314-327` | "Qo'shish" — universitet darajasidagi siyosat qatori bo'lmasa `return` qiladi: tugma yonib turadi, bosilsa jim |
| B5 | `StarterCard.tsx:124` | `<button>` ichida `<button>` — noto'g'ri HTML, brauzerga qarab turlicha ishlaydi |
| B6 | `App.tsx:108,114` | `syllabus` va `mistakes` route'lari tirik, lekin ularga **hech qayerdan havola yo'q** — o'lik manzillar |

---

## C. EKRANLAR — nima uchun "samolyot kabinasi" taassuroti

### C1. Guruh sahifasi: kontent ekrandan chiqib ketadi ⬜
Har tab ustida BIR XIL olti blok takrorlanadi: sarlavha → 4 halqa → **2 ta katta
sikl pasporti** → SubNav. Skrinshotda "Davomat matritsasi" sarlavhasi 897 px
ekranning **736-pikselida** boshlanadi — ya'ni bosilgan tab uchun 160 px qoladi.

⚠️ Sikl pasportini tab'lar ustiga men qo'ydim (F2) — xato. U ikkita kartochkada
"hamma koridorda" deb turibdi, ya'ni **yaxshi xabarni** eng qimmat joyga qo'ygan.

**Tuzatish:** sarlavha bir qatorga; 4 halqa → bitta matn qatori
(`15 % o'zlashtirish · 88 % davomat · 10 orqada · 11 talaba`); sikl pasporti →
har sikl uchun BITTA qator (`Kardiologiya · 21/24-kun · 42/48 soat · 13 ta
belgilanmagan → [Yo'qlama]`), batafsili "Dars jadvali" tabida. Kontent birinchi
ekranda boshlanadi.

### C2. Ko'rsatkich kartochkalari filtr emas ⬜
O'z qoidamiz (§18 "STAT DIETASI"): kartochka faqat **filtr** bo'lsa yashaydi.
Bosh sahifada 4 karta, guruhda 4 halqa — birortasi filtr emas.

**Tuzatish:** bosh sahifada 4 karta → bitta xulosa qatori; guruhda halqalar →
matn qatori. Qolgan yagona kartochka — "Ochiq vazifalar" (u ro'yxatni filtrlaydi).

### C3. Bosh sahifa yolg'on tinchlantiradi ⬜
`TeachDashboard.tsx:134` — "Bugungi darslar **0** · *hammasi belgilangan*".
O'lchandi (jonli API): bugun dars yo'q, lekin **oxirgi 30 kunda 13 ta darsning
13 tasi belgilanmagan**. Ya'ni "hammasi belgilangan" — noto'g'ri xulosa.

**Tuzatish:** subtitr faqat bugungi darslar bo'lganda "hammasi belgilangan"
desin; aks holda **"13 ta o'tgan darsda yo'qlama yo'q"** va shu qator
"Bugun bajarish kerak" ro'yxatining BIRINCHI bandi bo'lsin (bir bosishda
yo'qlama oynasi).

### C4. Vazifalar borti "orqada qolganlar" bilan to'lib ketgan ⬜
O'lchandi: `stats.toDo = 33`, shundan **20 tasi `students_behind`** — bu amal
emas, HOLAT. Shuning uchun bosh sahifa qizil "33" bilan qo'rqitadi va bu 33 dan
o'qituvchi bugun bajaradigan ish 9 ta (yo'qlama) + 3 ta (chop etish).

**Tuzatish:** `students_behind` avto-vazifadan chiqarilsin va guruh/talaba
ekranidagi "Orqada" filtriga qolsin (u yerda allaqachon bor). Bortda faqat
BAJARILADIGAN ish qolsin.

### C5. Doim ochiq "Yangi mavzu" formasi ⬜
`TopicListSection` — ro'yxat ustida doim ochiq forma-kartochka (skrinshot 2).
Adminda bunday formalar 2026-07 da modalga ko'chirilgan, o'qituvchida qolib ketgan.

**Tuzatish:** "+ Yangi mavzu" tugmasi + modal.

### C6. Mayda, lekin yig'ilib ketadigan ⬜
- Jurnal shapkasida uch boshqaruv ustma-ust (`AttendanceMatrix.tsx` toolbar) → bitta qator.
- Ustunda `2s` → `2 soat` (tooltipda emas, ustun ostida).
- Talabalar tabida saralash `Select` butun kenglikda, yonida yolg'iz tugma → bitta qator.
- Guruh sahifasidagi kurs chiplari (`Nefrologiya` `Kardiologiya`) — nima
  qilishlari tushunarsiz (tab almashtiradi) → yorliq yoki olib tashlash.

---

## D. Bajarish tartibi

### F1 — tugmalar rost gapirsin ⬜ (1 sessiya, dizayn tegilmaydi)
A1 · A2 · A3 · A4 · **A5 (tizimli — eng ko'p qatorni tuzatadi)** · A5B · A5C ·
A6 · B1 · B2 · B3 · B4 · B5 · B6.
Tartib: avval A5 (bitta qoida — 9 joy), keyin A1 va A3 (eng ko'p ko'riladigan).
**Приёмка:** brauzer bo'yicha avtomatik obhod — har bosiladigan element uchun
"URL / DOM / tarmoq so'rovi / modal" o'zgarishi qayd etiladi; hech narsa
qilmaydigan element qolmasin (skript: `scratchpad/crawl2.mjs` asosida repo'ga
`scripts/uiCrawl.mjs` sifatida ko'chiriladi).
⚠️ Obhod **demo ma'lumotiga sezgir**: "Jami 10 / Faol 10 / Orqada 10" bo'lgani
uchun to'g'ri ishlaydigan filtr ham "hech nima o'zgarmadi" deb belgilanadi
(A6). Shuning uchun obhod natijasi **avtomatik hukm emas** — har qator kod
bilan tasdiqlanadi; F1 tugagach bazaga farqli demo qatorlari qo'shiladi.

### F2 — o'qituvchi bosh sahifasi rost gapirsin ⬜ (0.5 sessiya)
C3 (yolg'on subtitr + belgilanmagan darslar birinchi qatorga) · C4 (bort tozalash)
· C2 ning bosh sahifa qismi (4 karta → qator).

### F3 — guruh sahifasi bitta ekranga sig'sin ⬜ (0.5 sessiya)
C1 · C2 ning guruh qismi · C6 ning guruh qismi.

### F4 — qolgan sayqal ⬜ (0.5 sessiya)
C5 (modal) · C6 (jurnal toolbar, birliklar, saralash qatori).

⚠️ **Tartib muhim:** avval tugmalar (F1) — chunki "ishlamaydi" degan taassurot
dizayndan ko'ra ko'proq zarar qiladi. Keyin ekranlar.

---

## E. Qilinmaydigan narsalar (ataylab)

- **Yangi dizayn tili yaratilmaydi.** "Sokin panel" tokenlari va `StatCard`/
  `ListRow`/`Num` qoladi — muammo ularda emas, ularni QAYERGA qo'yganimda.
- **Backend mantiqiga tegilmaydi** (F1 dagi `linkUrl` maydonidan tashqari).
  Davomat hisobi, koridor, sikl — hammasi tekshirilgan va ishlaydi.
- **Sikl pasporti o'chirilmaydi**, faqat bitta qatorga siqiladi va o'z tabiga
  ko'chadi: tushuncha kerak, joylashuvi noto'g'ri edi.
