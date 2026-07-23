# Modul 27 — O'zlashtirish kengaytmasi: Takrorlash + Qo'shimcha mashg'ulotlar

> Buyurtmachi (2026-07-23): "o'zlashtirishga yana ikkita narsa qo'shish kerak:
> takrorlash va qo'shimcha mashg'ulotlar".

## Kontekst — nima allaqachon bor (qayta qurilmaydi)

- **Interval takrorlash bazasi** (Modul 26): `FlashcardReview.intervalDays/dueAt`
  (SM-2 lite: 1/3/7/16/35 kun), `GET /me/review/due` (mavzu kesimida due soni),
  Dashboard "Bugun takrorlang" bloki. Kamchiligi: takrorlashning O'ZI faqat dars
  ichida (`?view=flashcards`), mavzu-mavzu alohida — yagona sessiya yo'q.
- **Xato javoblar bazada**: `QuizAttempt.answersJson` (Record<questionId, optionIndex>)
  vs `Question.correctIndex` + `explanationJson`; `CaseAttempt.stepsJson` vs
  `caseJson.steps[].options[].correct/feedback`; `FlashcardReview.known=false`.
- **GradesPage** (`/app/grades`) — hero + kurs bloklari; `AttendancePage`da tayyor
  `?sub=` segmented-tab naqshi bor (Davomat|Jadval) — shuni takrorlaymiz.

## Sahifa tuzilishi

`/app/grades` uch tab bo'ladi (`?sub=`, AttendancePage naqshi):

```
O'zlashtirish
[ Baholar ]  [ Takrorlash (3) ]  [ Mashg'ulotlar ]
```

- **Baholar** — hozirgi sahifa, o'zgarmaydi (default tab).
- **Takrorlash** — barcha mavzular bo'ylab yagona takrorlash markazi.
- **Mashg'ulotlar** — xatolar ustida ishlash (bahoga ta'sir qilmaydi).
- Tab badge: Takrorlashda bugungi due soni (useReviewDue'dan, tekin).
- Dashboard "Bugun takrorlang" bloki endi shu tabga olib boradi
  (`/app/grades?sub=takrorlash`), mavzu bosilsa o'sha mavzudan boshlaydi.

## Faza A — Takrorlash tabi (kross-mavzu sessiya)

**Backend** (`modules/me/flashcards.ts` kengayadi, yangi jadval YO'Q):
- `getReviewSession(studentId, topicId?)` — due (dueAt<=hozir) kartalarni BARCHA
  mavzulardan yig'adi: har due-mavzu uchun mavjud `build()` chaqiriladi, faqat
  due cardKey'lar filtrlanadi; har kartaga `topicId/topicTitle/subjectName`
  qo'shiladi. `topicId` berilsa — faqat o'sha mavzu. Sessiya cheklovi: 60 karta
  (eng eski dueAt birinchi).
- `getReviewStats(studentId)` — dueToday, reviewedToday (reviewedAt bugun),
  jami known %, `upcoming` bucketlari: bugun / ertaga / shu hafta / keyinroq
  (mavzu kesimida, keyingi dueAt sanasi bilan).
- Route'lar: `GET /me/review/session[?topicId=]`, `GET /me/review/stats`.
  Belgilash MAVJUD endpoint bilan: `POST /me/topics/:id/flashcards/review`
  (karta topicId'ni olib yuradi) — interval mantig'i bir joyda qoladi.

**Frontend** (`pages/student/grades/ReviewTab.tsx`):
- Hero 4 tile (HeroTile reuse): Bugun takrorlash · Bugun takrorlandi ·
  Jami bilaman % · Keyingi takror (sana).
- **Sessiya pleyeri**: FlashcardsTab'dagi katta 3D karta UI umumiy komponentga
  ajratiladi (`lesson/FlashcardPlayer.tsx` — kartalar + flip + 1/2 klaviatura +
  progress segmentlar + yakuniy natija). Farqi: kartaning tepasida mavzu badge
  ("Yurak fiziologiyasi · Kardiologiya"), belgilash kartaning topicId'siga
  yuboriladi. FlashcardsTab ham shu pleyerni ishlatadi (kod ikkilanmaydi).
- **Kelgusi jadval** ro'yxati: mavzu · nechta karta · qachon (bugun/ertaga/sana).
- Bo'sh holat: "Bugun takrorlash yo'q 🎉 Keyingisi: 25-iyul (Yurak fiziologiyasi)".

## Faza B — Mashg'ulotlar tabi (xatolar ustida ishlash)

Tibbiy xavfsizlik sharti: FAQAT tasdiqlangan-chop etilgan kontentdan, FAQAT
yakunlangan urinishlardagi savollar (javob talaba uchun allaqachon ochilgan —
halollik buzilmaydi). AI chaqiruvi YO'Q, bahoga/progressga ta'sir YO'Q.

**Backend** (yangi `modules/me/practice.ts`):
- `getPracticeOverview(studentId)` — enrolled kurslar bo'ylab har mavzuda zaif
  signallar: xato test savollari soni (finished attemptlarning oxirgisi bo'yicha),
  xato keys qadamlari soni, known=false kartalar soni. Natija: mavzu ro'yxati
  (topicId, title, subjectName, wrongQuiz, wrongSteps, unknownCards) — jami>0
  bo'lganlari, eng zaifi tepada.
- `getPracticeSet(studentId, topicId)` — mashq to'plami:
  - xato test savollari: text, options (aralashtirilgan tartib YO'Q — asl),
    correctIndex, explanations (hammasi allaqachon reveal bo'lgan);
  - xato keys qadamlari: prompt, options (correct+feedback bilan);
  - bilinmagan atama-kartalar (front/back/note).
- (ixtiyoriy, yengil) `PracticeRun` jadvali: studentId, topicId, total, correct,
  finishedAt — faqat statistika uchun ("shu hafta 3 ta mashq"); Progress/baho
  dvigateliga ULANMAYDI. V1'da shart emas — qo'shmasa ham bo'ladi.
- Route'lar: `GET /me/practice`, `GET /me/practice/:topicId`.

**Frontend** (`pages/student/grades/PracticeTab.tsx`):
- Zaif mavzular kartalari: "Yurak fiziologiyasi — 3 xato savol · 1 xato qadam ·
  4 atama" + "Mashqni boshlash".
- **Mashq pleyeri** (bitta oqim): savol → variant tanlash → darhol izoh
  (to'g'ri=emerald/xato=rose, tushuntirish bilan) → keyingisi; keys qadamlari
  ham xuddi shunday; atamalar FlashcardPlayer bilan. Yakunda: N/M to'g'ri +
  "Yana bir bor" + "Konspektni qayta o'qish →" (xato savol sourceFragment'i bor
  bo'lsa ko'rsatiladi).
- Hammasi to'g'ri bo'lgan talaba uchun bo'sh holat: "Xatolar yo'q — barakalla!"
  + Takrorlash tabiga havola.

## Faza B2b — Virtual bemor amaliyot markazi (buyurtmachi qo'shimchasi)

Buyurtmachi: "qo'shimcha deganda virtual bemor bilan ishlash mumkin bo'lsin —
hoxlagan payt kirib, har xil keyslar chiqsin".

- Backend `GET /me/practice/patients` — barcha enrolled kurslar bo'ylab OCHIQ
  (LOCKED emas) mavzulardagi published keyslar ro'yxati: topicId, title,
  subjectName, patientName (keysdan), finished (eval bor-yo'qligi).
  `loadCourse/computeTopics/studentFactsMap` reuse (me/service eksportlari).
- PracticeTab tepasida "Virtual bemor" bo'limi: bemor kartalari gridi
  ("Bemor R.A. · Yurak fiziologiyasi · Kardiologiya · [Boshlash/Qayta mashq]")
  + **"Tasodifiy bemor"** tugmasi (ro'yxatdan random tanlab o'sha roleplay'ga
  olib boradi). Mavjud `?view=patient` roleplay + reset ishlatiladi — har mashq
  suhbati tabiiy ravishda har xil kechadi.
- "Har xil keyslar" = hozircha mavzular bo'ylab xilma-xillik; AI har safar YANGI
  keys to'qishi — Faza C (o'qituvchi tasdig'i shart).

## Faza C (keyinroq, alohida qaror) — AI qo'shimcha savollar

O'qituvchi tomonida "qo'shimcha mashq savollari" generatsiyasi (mavjud quiz
pipeline reuse, ContentKind yoki Quiz flag) → o'qituvchi tasdiqlaydi → talaba
Mashg'ulotlar tabida ko'radi. CLAUDE.md §6 qoidasi (hech narsa avto-publish
emas) buziladigan yo'l YO'Q — shuning uchun alohida faza, hozir qurilmaydi.

## Ish tartibi (har biri alohida commit)

1. **A1**: backend session+stats + smoke (2 mavzuda due kartalar, sessiya
   birlashadi, stats to'g'ri).
2. **A2**: FlashcardPlayer ajratish (FlashcardsTab regressiyasiz) + ReviewTab UI
   + grades tab karkasi (?sub=) + dashboard havolasi + i18n.
3. **B1**: practice backend + smoke (xato savol demo talabada bor — 0% urinish!).
4. **B2**: PracticeTab UI + pleyer + i18n.
5. CLAUDE.md yangilash.

## Tekshirish

- Smoke (real talaba): sessiya faqat due kartalarni beradi, belgilash intervalni
  suradi (1→3), stats reviewedToday o'sadi; practice-set faqat xato javoblardan,
  yakunlanmagan attempt savollari CHIQMAYDI (403 sizdirish yo'q), baho/progress
  o'zgarmaydi.
- Demo: student@meduni.uz'da 0% li urinish bor (xato savollar tayyor) + due
  kartalar mavjud — ikkala tab darhol jonli ko'rinadi.
- tsc + build ikkala tomonda toza.
