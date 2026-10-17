# Dizayn v3 — «Pastel bento» (2026-10-17, buyurtmachi maketi)

Manba: buyurtmachi bergan talaba bosh sahifasi maketi (rasm). Talab: **butun
dizayn** shu uslubga — uchala rol, barcha sahifa, qobiq ham.

## Vizual til (maketdan)
- Chap menyu — YOZUVLI keng panel (~248px): brend, ikonka + nom, faol band
  QORA pill (`bg-ink text-surface`), pastda foydalanuvchi kartasi.
- Kartalar katta radiusli (16px), soyasiz, oq yoki PASTEL fon (brand/violet/
  amber/emerald/blue `-soft`). Bitta sahifada 1-2 pastel urg'u, qolgani oq.
- Asosiy amal — QORA pill tugma. Indigo — aksent (havola, faol chip, progress).
- Katta raqamlar `text-display` (44px), mini-ustunli grafiklar, segmentli chiziqlar.
- Bento panjara: hero (2/3) + yon karta (1/3), ostida ko'rsatkichlar + ro'yxat.

## Fazalar
- **A. Asos** — tokenlar (radius 16), `Button` primary = qora pill, qobiq
  (yozuvli sidebar + ichki bo'limlar faol band ostida + foydalanuvchi kartasi,
  yig'ilganda ikonka reyi), header yengil (fon bilan qo'shiladi), BottomNav.
- **B. Talaba** — ✅ Bosh sahifa. Kurslar, kurs yo'li, Vazifalar, O'zlashtirish
  (3 tab), Davomat/Jadval, Profil, dars sahifasi (tasma/overview).
- **C. O'qituvchi** — Bosh sahifa (bento: bugungi darslar, vazifalar, guruhlar),
  Kurslar, kurs ichi (6 bo'lim), Guruhlar + profil, Darslarim, Vazifalar,
  keys navbati, mavzu konstruktori.
- **D. Admin** — Bosh sahifa, Nazorat, Davomat (dekanat), Talabalar, Xodimlar,
  Kurslar, AI, Audit.
- **E. Login** + yakuniy tekshiruv (3 rol × desktop/planshet/390 × yorug'/qorong'i).

## Qoidalar (o'zgarmaydi)
Tokenlar (inline rang yo'q), 4 holat, uz/ru, mobil toshish 0, ZICHLIK
(gap-3), bitta fakt — bitta joy, STAT DIETASI (≤4 karta, faqat filtr yoki
harakat bo'lsa), `useReducedMotion`.
