# Modul 28 — O'qituvchi paneli: talaba modullari bilan bog'lash + guruh chatini olib tashlash

> Buyurtmachi (2026-07-23): o'qituvchi g'oyalaridan 1→2→3 tanlandi (xatolar
> xaritasi, AI tavsiyaviy baho + bemor logi, bemor ssenariysi), "hozir qilgan
> o'zgarishlarimizni student bilan assotsiatsiya qil" va "guruh chatini hamma
> joydan olib tashla (AI chat emas)".

## Asosiy tamoyil — talaba ↔ o'qituvchi bog'lanishi

Modul 26/27 da talaba tomonida qurilganlar endi o'qituvchi tomonida "ko'zgu"
oladi. Hech narsa ikki marta hisoblanmaydi — bitta ma'lumot, ikki qarash:

| Talaba (bor) | O'qituvchi (quriladi) |
|---|---|
| Xatolar ustida ishlash (practice.ts topicMistakes) | Guruh xatolari XARITASI (o'sha xato-signallar guruh bo'ylab agregat) |
| Virtual bemor roleplay + AI baho (PatientMessage) | Keys tekshiruvida talabaning bemor-suhbati LOGI + AI bahosi ko'rinadi |
| Virtual bemor xulqi (prompt) | O'qituvchi keys tahrirlagichida SSENARIY yozadi / shablon tanlaydi |
| Interval takrorlash (FlashcardReview dueAt) | Talaba kartochkasida amaliyot FAOLLIGI (takrorlash/bemor sessiyalari) |
| Mashg'ulotlar tabi (?sub=mashgulot) | Xatolar xaritasidan bir bosishda "Mashq qildirish" topshiriq (deep-link) |

## Faza 0 — Guruh chatini olib tashlash (buyurtmachi qarori, alohida commit)

AI-tutor chat (dars ichi) va virtual bemor chati QOLADI — faqat odamlar
guruh-chati (Modul 25 "Kurs Chati") olib tashlanadi.

- **Frontend talaba**: nav'dan "Kurs chati" bandi; `/app/chat` → redirect `/app`;
  `CourseChatPage.tsx` o'chiriladi; StudentShell fullBleed shartidan `/app/chat`;
  `api.ts`dan useCourseChat/useCourseChatMeta/useSendCourseChat + tiplar.
- **Frontend o'qituvchi**: kurs shell'idan "Chat" tab + route; `CourseChatTab.tsx`
  o'chiriladi; teach `api.ts`dan chat hooklari.
- **Backend**: `me/router` va `teachRouter`dagi chat route'lari; `modules/chat/`
  butunlay o'chiriladi.
- **i18n**: `courseChat.*` bo'limi, `nav.courseChat`, `teach.tabs.chat` (uz+ru).
- **Prisma**: `CourseChatMessage` jadvali BAZADA QOLADI (presedent: Glossary/
  PresentationTemplate — kod ishlatmaydi, keyin xohlasa DROP migratsiya).
- CLAUDE.md: Modul 25 yozuviga "BEKOR QILINDI (2026-07-23)" belgisi.

## Faza 1 — Guruh xatolari xaritasi (eng katta qiymat)

**Backend** (yangi `modules/courses/mistakes.ts`, TEACHER, o'z kursi):
- `GET /teach/courses/:id/mistakes` — kurs talabalari bo'ylab agregat:
  - har mavzu → har savol: xato% (oxirgi YAKUNLANGAN urinishlar bo'yicha),
    eng ko'p tanlangan noto'g'ri variant (distraktor), xato qilgan talabalar
    ro'yxati (ism);
  - keys qadamlari xato% xuddi shunday;
  - mavzu darajasida jamlanma: "60% talaba shu mavzuda qiynaldi" (xato savollari
    o'rtachasi), saralangan (eng og'ir tepada).
  - Talaba tomonidagi `practice.ts::topicMistakes` mantig'i bilan BIR XIL
    mezonlar (oxirgi finished attempt) — ikki tomon bir xil raqamni ko'radi.
- Qo'shimcha: har mavzuda nechta talaba hali xatosini mashq qilmagani —
  hozircha practice yozilmaydi (persistensiya yo'q), shuning uchun v1'da
  "due kartalar / bilinmagan kartalar soni" (FlashcardReview'dan) ko'rsatiladi.

**Frontend** — `ProgressTab` ichida yangi "Xatolar xaritasi" bo'limi (yoki
sub-tab): mavzu kartalari (xato% bar, eng og'ir savol preview) → ochilsa savollar
ro'yxati: savol matni, xato%, distraktor taqsimoti (StackedBar), xato qilganlar.
Har mavzuda **"Mashq qildirish"** tugmasi → mavjud `QuickTaskModal` prefill:
"Mavzuni takrorlang: X — Mashg'ulotlar bo'limida xatolaringiz ustida ishlang",
link `/app/grades?sub=mashgulot` (talaba deep-link — assotsiatsiya).

## Faza 2 — Keys tekshiruvi: AI tavsiyaviy baho + virtual bemor logi

**Prisma**: `CaseAttempt += aiSuggestJson Json?` (kesh — har ochilishda qayta
so'ramaslik uchun). Migratsiya `case_ai_suggest`.

**Backend**:
- `GET /teach/cases/:id` (review detail) += `patientSession` — o'sha talabaning
  shu mavzudagi PatientMessage suhbati (student/patient xabarlari + eval JSON,
  read-only) — o'qituvchi talaba anamnez qanday yig'ganini ko'radi.
- `POST /teach/cases/:id/ai-suggest` — Gemini (kind `CASE_SUGGEST`, kafedra
  kvota): talaba yozma javoblari + etalon + qadam natijalari asosida tavsiya:
  `{score, rationale, missed[]}`; `aiSuggestJson`ga keshlangan; qayta bosilsa
  qaytadan. AI FAQAT tavsiya — yakuniy baho o'qituvchida (gibrid qoida).

**Frontend** — `CaseReviewQueue` o'ng panelida: "AI tavsiyasi" kartasi (ball +
sabab + qoldirilgan narsalar; "Qo'llash" bosilsa ball inputga ko'chadi) va
yig'iladigan "Virtual bemor suhbati" bo'limi (log + AI eval ko'rsatkichlari).

## Faza 3 — Virtual bemor ssenariysi (o'qituvchi nazorati)

- `caseJson += patientBehavior?: string` (JSON — migratsiya KERAK EMAS).
- `CaseEditor`: "Bemor xulqi" textarea + 3-4 shablon chip ("Kamgap bemor — faqat
  aniq savolga javob beradi", "EKG/analizlarni faqat so'ralganda beradi",
  "Og'riqdan bezovta, chalg'iydi", "Tibbiy savodsiz — sodda tilda").
- `ai/prompts/patient.ts::patientSystemPrompt` — o'qituvchi qoidalari system
  promptga "O'QITUVCHI QO'SHIMCHA QOIDALARI" bloki sifatida qo'shiladi
  (bazaviy xavfsizlik qoidalari USTUVOR qoladi — keysда yo'q faktni to'qimaydi).

## Faza 4 — Talaba amaliyot faolligi (yengil "portret")

- `getTeacherGroup` / progress talaba modali payload += `practiceSignals`:
  takrorlangan kartalar soni + knownPct (FlashcardReview), virtual bemor
  sessiyalari soni va o'rtacha AI ball (PatientMessage eval), AI-tutor savollari
  soni (TutorMessage count). Batch so'rovlar, N+1 yo'q.
- UI: GroupProfile talaba qatori + StudentDetail sahifasida 3 mikro-ko'rsatkich
  ("Takrorlash: 24 karta · Bemor: 2 mashq (o'rt. 78) · AI savol: 15").

## Ish tartibi (har biri alohida commit)

0. Chat olib tashlash + CLAUDE.md.
1. Xatolar xaritasi (backend+smoke → UI).
2. AI tavsiya + bemor logi (migratsiya → backend+smoke → UI).
3. Bemor ssenariysi (prompt+editor+smoke).
4. Amaliyot faolligi (payload+UI).
5. CLAUDE.md Modul 28.

## Tekshirish

- Chat: /app/chat va teach chat route'lari 404; nav'larda yo'q; tsc toza.
- Xarita smoke: demo guruhda savol xato% lar talaba practice raqamlari bilan MOS
  (bir xil mezonlar); ownership 403.
- AI tavsiya: real Gemini bilan bitta keys — score 0-100 + rationale; kesh
  ishlaydi (ikkinchi so'rov AI'siz); kvota 403 yo'li.
- Ssenariy: patientBehavior yozilgan keysда bemor qoidaga amal qiladi (masalan
  EKG faqat so'ralganda) — real Gemini smoke.
- Faollik: guruh payloadida signallar to'g'ri (demo talabada takrorlash bor).
