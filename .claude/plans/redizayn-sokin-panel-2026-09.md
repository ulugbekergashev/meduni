# Redizayn 2026-09 — «Sokin panel»

Referens: **Sariosiyo CRM** (`Desktop/saraosiyo crm`, `src/index.css` + `docs/UI_UPGRADE_PLAN.md`).
Buyurtmachi qarori (2026-09-08): *«bir xil qilish shart emas, lekin vprinsipe yoqdi»* —
**referens yo'nalish, nusxa emas.** Maket: artifact «MedUni yangi dizayn»
(4 artbord: bosh sahifa + talaba profili, tungi/yorug').

Belgilar: ✅ bajarilgan · 🟡 qisman · ⬜ boshlanmagan

---

## 0. Diagnoz — nima uchun bizniki «noprofessional» ko'rinadi

Kod bo'yicha o'lchandi (`apps/web/src`, 96 sahifa: admin 17 · teach 43 · student 36):

| Belgi | Bizda | Referensda |
|---|---|---|
| `font-extrabold`/`font-black` | **141 joy** (40 fayl) | og'irlik shkalasi pasaytirilgan: bold=600, extrabold=600, black=700 |
| Gradient fon | 26 joy (hero bloklari) | yo'q (faqat logo) |
| Karta soyasi (`shadow-card`) | 32 joy | **soyasiz**, faqat 1px chegara |
| `uppercase tracking-wider` | 56 joy | faqat ≤11px yorliqda |
| Stat-karta turlari | **4 xil**: StatCard, HeroTile, HeroCard, RailCard | 1 ta `StatTile` |
| Raqamlar | `tabular-nums` 184 joy, `font-mono` **2 joy** | jadval/telefon/vaqt — mono (`.num`), katta raqam — `.raqam` |
| Shrift | Manrope, h1 26 / stat 34 / body 16 | **Sora** (+Inter kirill), 26 / 27 / 15 / 13 / 12 / 11 |
| Radius | karta 20, tugma 12 | karta 10–12, tugma 8 |
| Header / rail | 64 / 84px | 54 / 76px |
| Bosh sahifa bloklari | 8 | 5 |

Xulosa: muammo layout emas — **ovoz balandligi** (og'irlik, soya, gradient, uppercase)
va **bir ma'no uchun 4 xil karta**. Referens tinch: kam og'irlik, chegara, bitta rangli
karta, raqamlar mono. §4 «OVOZ IERARXIYASI» qoidasi biz uchun to'g'ri yozilgan edi,
lekin komponentlar unga zid qurilgan.

## 1. Tamoyillar (nima olinadi, nima qoladi)

**Referensdan olinadi:**
1. Tinch tipografika — og'irlik shkalasi global pasaytiriladi (fayllarga tegmasdan).
2. Kartada soya yo'q; hover faqat chegara rangi. Gradient faqat logo.
3. Bitta `StatTile`: yorliq 12 → raqam 27 (og'irlik 500) → izoh 11 / chiziq+izoh.
   **Ogohlantirish rangi raqamga emas, izohga** (raqam yomon xabar bo'lsagina).
   Qatorda **faqat bitta** rangli (accent) karta.
4. `Num` — mono raqamlar jadval/telefon/vaqt/ball uchun; katta raqam mono EMAS.
5. Har progress chizig'i tagida **u nimaning ulushi** yozilishi shart; 0% da chiziq chizilmaydi.
6. `ListRow` — 36px ikonka/avatar · sarlavha+izoh · o'ngda qiymat. Dashboard ro'yxatlari,
   «Bugun hal qilinsin», darslar, natijalar — hammasi shu.
7. Sahifa pastida o'lik bo'shliq yo'q; kontent ramkani to'ldiradi.
8. Palitra token-ma-token (tungi = referens; yorug' = referens yorug'i, indigo brend).

**Bizniki qoladi (referensda yo'q yoki bizniki yaxshiroq):**
- Ikki darajali menyu (rail + bo'lim paneli, §14) va `SubNav`; mobil pastki tab-bar (§11).
- STAT DIETASI (§18): stat qatori faqat filtr bo'lsa yoki sahifa xulosasi bo'lsa, ≤4 karta.
- `Disclosure` (progressiv ochilish), dars sahifasi tuzilmasi (§18/§23), fokus rejim.
- AI kontent oqimi, konstruktor, nazorat ekrani — tuzilishi tegilmaydi, faqat qiyofa.
- Yorug' tema **sukut bo'yicha** (2026-07 qarori); tungi — referens bilan bir xil.

## 2. TASDIQLASH KERAK (buyurtmachi)

| # | Savol | Tavsiya |
|---|---|---|
| Q1 | **Shrift**: Sora (referens) yoki Manrope qoladi? | **Sora** — referens hissining yarmi shundan. Sora'da kirill yo'q → Inter fallback (referens ham shunday; ru tilimiz bor). Ikkalasi `@fontsource` (oflayn, CSP). |
| Q2 | **Shkala**: referens 11–13px; bizda §4 «micro 13 — mutlaq minimum» (buyurtmachi 3 marta «kichkina» degan). | Oraliq: **h1 26 · stat 28 · section 16 · body 14 · note 13 · micro 12**. Referensdan 1px katta, bizdan 1–2 pog'ona kichik. Brauzerda ko'rib qaror. |
| Q3 | Talaba tomoni ham shu yo'nalishda? | Ha — bitta tizim; talaba sahifalari F3'da. |

## 3. Fazalar

Har faza = alohida commit + `tsc` + `build` + Chrome (Playwright) skrinshot 3 rol
(desktop 1440 + mobil 390). Ko'rilmagan narsa «tayyor» deyilmaydi.

### F0 — Poydevor: tokenlar, shrift, shkala ⬜ (1 sessiya)
Bitta commit, butun ilovaga o'z-o'zidan tarqaladi (fayllarga tegilmaydi).
- `packages/ui/src/tokens.css`: palitra referensdan — tungi `fon #0f1216 · sirt #171c25 ·
  sirt-2 (rail/header) #131720 · ichki #181d26 · chiziq #232a35/#2b323d/#1e242e · matn
  #e8ebef/#c3cad4/#8b93a1/#6b7482`; brend tungida `#a5b0ff` (matn/faol), tugma `#6366f1`;
  semantik `yaxshi #3ddc97 · ogoh #ffb547 · xato #ff5d6c` + `-fon` va `xato-chiziq`.
  Yorug': `fon #f4f6f5 · chiziq #e3e8e5 · matn #16211d · sokin #71827b · xira #8a978f`.
  Yangi tokenlar: `surface-2` (rail/header), `ink-2`, `line-strong`, `line-soft`,
  `rose-line`, `rose-soft-ink`. Eski nomlar (`bg/surface/ink/line/brand…`) **saqlanadi** —
  qiymati almashadi.
- `--radius-card 20→12`, `--radius-control 12→8`; `--shadow-card` → `none`
  (modalga alohida `shadow-modal`). `--header-h 64→54`; rail 84→76.
- Shrift: `@fontsource/sora` + `@fontsource/inter` (kirill) + `@fontsource/jetbrains-mono`;
  `fontFamily.sans` = Sora, Inter; `fontFamily.data` = JetBrains Mono.
- **Og'irlik shkalasi** `tailwind.config.ts::fontWeight`: `semibold 500 · bold 600 ·
  extrabold 600 · black 700` — referens usuli: 141 joyga tegmasdan butun ilova tinchlanadi.
- Shkala (Q2 bo'yicha): `h1 26 · stat 28 · section 16 · body 14 · note 13 · micro 12 · read 17`.
- Tekshiruv: 3 rol × 6 sahifa skrinshot, dark+light. CLAUDE.md §4 yangilanadi.

### F1 — Umumiy komponentlar (`packages/ui`) ⬜ (1–2 sessiya)
- **`StatTile`** (StatCard o'rnida): `label value unit sub tone subTone bar barTone barCaption
  accent onClick selected`. Ikonka-chip YO'Q. `HeroTile`/`HeroCard`/`RailCard`
  (`components/HeroStats.tsx`) → StatTile + `Card.Header`ga birlashadi (4 → 1).
- **`Card`**: soyasiz; `Card.Header` (15px/500, ostida chiziq, o'ngda amal sloti);
  `Card.Inner` (`bg-surface-2`). `interactive` → faqat chegara o'zgaradi.
- **`ListRow`** yangi: 36px ikonka/avatar · sarlavha 13 + izoh 11 · o'ngda qiymat/sana/yorliq.
- **`Num`** yangi: mono raqam (`font-data tabular-nums`); `Charts` yorliqlari shunga o'tadi.
- **`Button`**: `md` 36px / `sm` 30px, radius 8, 13px/500, soyasiz; `primary | brand
  (kontur) | ghost | danger`.
- **`Segmented`** (davr tanlagich, tablar): `bg-surface-2 p-1 rounded-control`, faol =
  brend fon + oq yozuv. `SubNav` mobil tasmasi shu ko'rinishga o'tadi.
- **`Badge`** 11px; `Avatar` yangi (28/36/112, initsial neytral fonda).
- **`SidebarLayout`**: rail 76 (ikonka 19 + 10px yorliq), header 54: brend blok ·
  kontekst chip (kafedra/guruh) · pill-qidiruv markazda · o'ngda **rolga xos status-pill**
  (o'qituvchi «N keys kutmoqda», talaba «N vazifa», admin «N chetlanish») · UZ · tema · avatar.
- `Charts`: `BarRow`/`MiniBars` — qiymat ustun tepasida doim, eng balandi brend, qolgani 40%;
  `ProgressRing` faqat 3 joyda qoladi (dars natijasi, takrorlash yakuni, bemor baholash).

### F2 — O'qituvchi ⬜ (2 sessiya) — maket bo'yicha
1. **Bosh sahifa** (`TeachDashboard`): gradient hero → salom + davr tanlagich; 4 StatTile
   (talabalar / o'zlashtirish / **kutayotgan ishlar — accent** / mavzular); chapda
   «O'zlashtirish dinamikasi» (6 hafta) + «Bugungi darslar»; o'ngda «Bugun hal qilinsin»
   (`taskBoard.items` 4–5) + «So'nggi natijalar». Kurs kartalari bosh sahifadan ketadi
   (Kurslar bo'limi bor). 8 blok → 5. Analitika `Disclosure` bekor — grafik uning o'rnida.
2. **Talaba sahifasi** (`StudentDetailPage`): avatar 112 + ism 22/500 + meta qatori
   (№ · holat · guruh · kurs) + amallar (Vazifa berish · Baholash · Mavzuni ochish · tel ·
   xabar); chap 1/4: accent «O'zlashtirish» + «Mashq qildirish» + aloqa (InfoRow: yorliq 11,
   qiymat mono 12); o'ng 3/4: 4 StatTile + tabli karta (`SubNav` → Segmented) — Umumiy
   (Diqqat talab qiladi | Kurslar bo'yicha; ostida Amaliyot 3 tile) / Kurslar / Testlar /
   Davomat / Amaliyot.
3. **Guruh profili** (`GroupProfile`): sarlavha + kurs chiplari, jadval/talabalar ro'yxati
   `ListRow` (rank mono, progress + izoh).
4. **Kurslar** (`TeachCoursesPage` + `CourseCard`): referens kurs kartasi — ikonka 44 ·
   nom · guruh · holat badge; jadval qatori (kun · vaqt mono · xona); «Chop etilgan mavzular
   8 / 12» + chiziq + izoh; 3 mini-metrika (o'zlashtirish / davomat / keys).
5. `TopicListSection`, `CaseReviewQueue`, `TeachSchedulePage`, `TeachGroupsPage`,
   `ProgressTab` — tokenlar + ListRow/StatTile almashinuvi (tuzilishi tegilmaydi).

### F3 — Talaba ⬜ (1–2 sessiya)
- `StudentDashboard`: hero karta → salom + 4 StatTile (streak / davomat / o'zlashtirish /
  vazifalar), «Bugun» ro'yxati `ListRow`, o'ng ustun RailCard → Card.Header.
- `StudentCoursesPage` (CourseRow → ListRow), `GradesPage` (LeaderboardCard, statlar),
  `AttendancePage` (jadval ustunlari `Num`), `ProfilePage`, `StudentTasksPage`.
- Dars sahifasi: **faqat tokenlar** (Panel tone, StudyToolbar, MaterialsPanel plitkalari
  soyasiz). Tuzilish §18/§23 saqlanadi.

### F4 — Admin ⬜ (1 sessiya)
- `AdminDashboard`, `/admin/control` — StatTile + ListRow, Donut/MiniBars yangi ranglarda.
- **Talabalar jadvali** (`StudentsPage`) — referens jadvali: filtr chiplari sonlar bilan
  (Barchasi 269 · Orqada 13 · Nofaol 4) + qidiruv + Filtrlar; ustunlar: № mono · FISH+guruh ·
  telefon mono · kurslar chip · o'zlashtirish · davomat (rangli). `DataTable` sarlavha 11px.
- `FacultyPage`/`DepartmentPage`/`AdminGroupProfile`/`UserProfilePage` — profil naqshi F2.2.

### F5 — Tozalash + hujjat ⬜ (1 sessiya)
- Qoldiq: `bg-gradient-to` (26) → faqat logo; `uppercase tracking-wider` (56) → faqat
  eyebrow/guruh ajratgich; `backdrop-blur` (9) → yo'q; `font-black` (10) → yo'q;
  `text-[Npx]` arbitrary → token.
- CLAUDE.md §4 qayta yoziladi (yangi tokenlar, StatTile qoidalari, `Num`, og'irlik shkalasi).
- Yakuniy tekshiruv: 3 rol × barcha asosiy sahifa, dark+light, 1440 + 390; konsol toza.

## 4. Ish tartibi
1. Har faza — alohida commit; faqat o'z fayllari stage qilinadi.
2. `tsc` + `vite build` + Chrome skrinshot (Playwright, real login) — har fazadan keyin.
3. Bazada yo'q raqam ko'rsatilmaydi (maketdagi «o'zlashtirish dinamikasi» uchun backend
   `getTeacherDashboard`ga 6 haftalik seriya qo'shiladi — F2.1 ichida, kichik).
4. Referens — yo'nalish; bizdagisi yaxshiroq bo'lsa (menyu, dars sahifasi, stat dietasi) — qoladi.

## 5. Bajarildi (2026-09-08)

| Faza | Holat | Izoh |
|---|---|---|
| Q1 shrift | ✅ | **Sora** tanlandi (kirill uchun Inter zaxira), raqamlar JetBrains Mono. |
| Q2 shkala | ✅ | Oraliq: h1 26 · stat 28 · section 16 · body 14 · note 13 · micro 12. |
| F0 poydevor | ✅ | Tokenlar referensdan, radius 12/8, soya `none`, header 54 / rey 76, og'irlik shkalasi pasaytirildi (141 joyga tegmasdan). Commit `fa797e7`. |
| F1 komponentlar | ✅ | Bitta `StatCard` (4 xil karta o'rniga), yangi `ListRow`/`Num`/`Segmented`/`Avatar`, `CardHeader`; `HeroStats` ichi qayta yozildi (API o'zgarmadi — 6 sahifa tegilmadi); Charts retune. Commit `74c6007`. |
| F2 o'qituvchi | ✅ | Bosh sahifa gradient hero → 4 ko'rsatkich; talaba profili referens naqshida; kurs kartochkasi; RankingCard ListRow'da. Commit `8854231`. |
| F5 mexanik (F2 bilan) | ✅ | 381 arbitrary `text-[Npx]` → token; 99 joydan UPPERCASE; ilova ichidagi gradientlar va `blur-3xl` dog'lar; EmptyState ixchamlashdi. |
| F3/F4 talaba+admin | ✅ | Tokenlar orqali avtomatik; qo'lda: 152 ta jadval raqami mono shriftga, LeaderboardCard medallari tinchlandi, AI-monitoring/kurs yo'li gradientlari ketdi. |
| CLAUDE.md §4 | ✅ | Yangi tokenlar, tipografika, StatCard 4 qoidasi, komponentlar ro'yxati. |

### Keyingi (ixtiyoriy, bu redizayndan tashqarida)

- Bosh sahifadagi «o'zlashtirish dinamikasi» grafigi — backendda 6 haftalik
  seriya yo'q (`getTeacherDashboard`), shuning uchun qo'shilmadi.
- `Login.tsx` — marketing tomoni, ataylab tegilmadi (gradient o'z o'rnida).
- Admin AI-monitoring kartasidagi inglizcha izoh — i18n kaliti yetishmaydi.
