# Dizayn overhaul rejasi — 2026-iyul

Foydalanuvchi qarori (2026-07-16): hozirgi UI "judayam primitiv", to'liq vizual
overhaul + keraksiz murakkabliklarni olib tashlash. Ilhom: Cake, Monarch, Grammarly,
Compound uslubidagi yorug', havodor SaaS dashboardlar (rasmlar chatda).

## Qabul qilingan qarorlar

| Savol | Qaror |
|---|---|
| Tema | **Yorug' (light)** — rasmlardagidek. Dark keyinroq ehtimol. |
| Til | **Data bir til, UI ikki til.** nameUz+nameRu → bitta `name`. i18n UI (uz/ru) qoladi. |
| Qamrov | **Butun platforma bosqichma-bosqich:** yadro+admin → o'qituvchi → talaba. |
| Palitra | **A — Indigo Pro tanlandi** (#4F46E5 asosiy, #3730A3 chuqur, #EEF2FF soft; ink #101828; fon #F7F8FA). Boshqa variantlar artifact "MedUni — Palitra takliflari"da. |

Palitralar dataviz-validatordan o'tgan (CVD + kontrast):
- A: `#4F46E5, #059669, #D97706, #0284C7, #E11D48` (amber↔emerald faqat oraliq/yorliq bilan)
- B: `#2563EB, #0D9488, #8B5CF6, #D97706, #E11D48` (ideal toza)
- C: `#059669, #2563EB, #D97706, #7C3AED, #E11D48`

## Fazalar (har biri alohida sessiya + commit)

### Faza 0 — Dizayn-tizim yadrosi (packages/ui) ✅ BAJARILDI (2026-07-16)
- Yangi tokenlar: tanlangan palitra, neytrallar shkalasi (bg/surface/ink 3 daraja/line/track),
  soya tokenlari yangilanadi, radius saqlanadi (16/10/20).
- **Sidebar yorug' bo'ladi** (hozirgi to'q-teal gradient o'rniga oq/och surface, faol=soft chip) —
  rasmlardagi uslub. `--side-*` tokenlar qayta yoziladi.
- Komponentlar: Card v2 (header/action sloti), StatCard umumiy komponentga (hozir 3 joyda copy-paste),
  Donut chart (Charts.tsx'ga qo'shiladi, conic-gradient + 2px oraliq), Table v2 (hover, sticky header),
  EmptyState v2. Global qidiruv headerda qoladi.
- Barcha sahifalar mavjud tokenlarni ishlatgani uchun token almashinuvi darhol butun platformaga tarqaladi;
  Faza 2-4 sahifa-layout darajasidagi ishlar.

### Faza 1 — Data soddalashtirish (bir tilli nomlar) ✅ BAJARILDI (2026-07-16, +1B tozalash 07-17)
- Prisma: Faculty/Department/Subject/StudentGroup(?) `nameUz`+`nameRu` → `name`
  (migratsiya: `name = nameUz`; eski ustunlar drop).
- Backend: org/users/courses/search service'larda pickName mantiqiy olib tashlanadi.
- Frontend: formalarda bitta input, `pickName` chaqiruvlari soddalashadi (faqat entity nomlari uchun;
  UI i18n tegmaydi).
- Boshqa "keraksizlar" auditi: har sahifani ko'rib chiqib olib tashlash ro'yxatini foydalanuvchiga
  tasdiqlatish (masalan: ortiqcha maydonlar, ishlatilmaydigan sozlamalar).

### Faza 2 — Admin redizayn ✅ BAJARILDI (2026-07-17)
- Dashboard: stat kartalar + rollar donuti + faollik timeline + attention + AI gradient karta.
- Tuzilma (4 tab), Foydalanuvchilar (2026-07-16 overhaul qilingan — faqat token/uslub moslanadi),
  Kurslar, AI-audit, Audit, Vazifalar.

### Faza 3 — O'qituvchi redizayn ✅ BAJARILDI (2026-07-17; dashboard Modul 19da tayyor edi, + TopicsTab pipeline chiplari)
- TeachDashboard, kurs karkasi + tablar, mavzu konstruktori (wizard stepper), progress heatmap,
  keys navbati, yo'qlama.

### Faza 4 — Talaba redizayn (mobil-birinchi) ✅ BAJARILDI (2026-07-17; sahifalar Modul 11-16da tayyor edi, + dashboard xulosa paneli)
- Dashboard, kurs yo'li, dars sahifasi (4 tab), davomat, profil.

## Eslatmalar
- Auth router `/auth` prefiksida (`/api/v1/auth` EMAS).
- admin@meduni.uz paroli seed'dagi `admin123`dan farq qiladi (foydalanuvchi o'zgartirgan bo'lsa kerak).
- Faza 3 (kafedra-markazlashgan kontent, Topic→subjectId) bu rejadan ALOHIDA — dizayn overhaul bilan
  aralashtirmaslik; ketma-ketligi foydalanuvchi bilan kelishiladi.
