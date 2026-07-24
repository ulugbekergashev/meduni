# Kontent taqdimoti 2.0 — kanonik oqim · mindmap · AI tejamkorlik

Sana: 2026-07-25. Buyurtmachi so'rovi: (1) generatsiya qilingan kontentni talabaga
taqdim etish workflow'i mukammal emas, (2) mindmap qo'shish, (3) AI xarajatlarini
sifatni pasaytirmasdan kamaytirish.

**Yadro g'oya:** uchala muammoning kaliti BITTA texnik ish — **bo'lim ↔ slayd ↔
video-segment xaritasi**. U bo'lsa: konspekt ichiga media ichma-ich kiradi (taqdimot),
video prezentatsiya rasmlarini qayta ishlatadi (xarajat), mindmap esa allaqachon
tayyor strukturadan AI'siz quriladi (fleshkarta presedenti).

Har faza — alohida sessiya + commit. Tartib: 0 → 1 → 2 → 3 (0-faza hammasiga poydevor,
lekin 2 va 3c/3d/3e undan mustaqil — kerak bo'lsa parallel qilsa bo'ladi).

---

## Faza 0 — Poydevor: bo'lim↔slayd↔segment xaritasi

Hozirgi holat (tekshirildi, `ai/types.ts`):
- `digestSectionSchema` — `id` YO'Q (title/minutes/sourceRef/blocks).
- `Slide` — barqaror `id` BOR, lekin bo'limga ref yo'q.
- `lectureSegmentSchema` — `visual` mustaqil, slaydga ref yo'q (eski `slideIndex`
  faqat legacy formatda).

### Ishlar
1. **Bo'lim ID.** `digestSectionSchema += id: z.string()` — AI generatsiya qilmaydi,
   **server generatsiyadan keyin beradi** (slayd `id` presedenti: nanoid/crypto).
   PUT (o'qituvchi tahriri)da mavjud id saqlanadi, yangi bo'limga yangisi beriladi.
   Eski v1/v2 konspektlar id'siz — o'qish paytida indeks-fallback (`s0, s1...`),
   renderer buzilmaydi.
2. **Slayd → bo'lim.** `slideGenSchema += sectionIndex: z.number().int()` (AI qaysi
   konspekt bo'limini yoritayotganini qaytaradi; promptda bo'limlar raqamlangan
   ro'yxat bilan beriladi). Server `sectionIndex` → `sectionId`ga aylantirib
   `Slide.sectionId?` sifatida saqlaydi (slidesJson ichida — migratsiya KERAK EMAS).
   Diapazondan tashqari qiymat → null (graceful).
3. **Segment → slayd.** `lectureSegmentSchema += slideIndex: z.number().int()`
   (video skript slaydlardan generatsiya qilinadi — promptda slaydlar raqamlangan).
   `ScriptSegment.slideIndex` maydoni allaqachon bor (legacy) — endi lecture
   formatda ham to'ldiriladi. Zanjir yopiladi: segment → slayd → bo'lim.
4. **Vaqt xaritasi.** Segmentlarda `durationSec` bor — kumulyativ yig'indi =
   har bo'limning videodagi boshlanish vaqti. Alohida saqlash shart emas,
   lesson payload'da hisoblanadi.

### Tekshiruv
- Yangi generatsiya: digest bo'limlari id bilan, slaydlar sectionId bilan,
  segmentlar slideIndex bilan (real Gemini smoke).
- Eski demo topic (id'siz konspekt) — lesson payload buzilmaydi.
- tsc+build toza.

---

## Faza 1 — Kanonik o'quv oqimi (talabaga taqdimot)

Muammo: 4 format (konspekt/slayd/video/material) parallel turadi, talaba tanlashga
majbur; o'qish passiv (scroll = "o'qildi").

### 1A. Bo'lim ichiga media
- **Backend** (`me/lesson.ts`): payload har bo'limga `media` qo'shadi:
  `{slideImages: [{slideId, url}], videoAt: number|null}` — sectionId bo'yicha
  slaydlar (faqat DONE rasm slotlari, mavjud `/me/presentations/:id/image` route)
  + Faza 0 vaqt xaritasidan videodagi boshlanish sekundi.
- **Frontend** (`SectionReader`): bo'lim oxirida media bloki — diagramma rasm
  (lazy img, bosilsa lightbox) + "Videoda: 3:42" chipi. Chip → `?view=video&t=3m42s`,
  `VideoTab` `t` paramni o'qib `currentTime` qo'yadi.
- OVOZ IERARXIYASI: media bloki `content` toni ichida, alohida karta EMAS —
  rasm + bitta chip, shovqin qo'shmaydi.

### 1B. Checkpoint savollar (active recall)
- **Generatsiya:** digest promptiga har bo'lim uchun 1 ta `checkpoint
  {question, options[4], correctIndex, explanation}` qo'shiladi — **ALOHIDA AI
  chaqiruvi YO'Q**, o'sha digest chaqiruvining outputi (marginal token).
  `digestSectionSchema += checkpoint?`. O'qituvchi konspektni tasdiqlaganda
  checkpointlar ham tasdiqlanadi (1-qulf o'zgarmaydi), DigestSection editorida
  ko'rinadi/tahrirlanadi.
- **Talaba:** bo'lim oxirida savol → variant tanlaydi → darhol izoh (bahoga
  TA'SIR QILMAYDI, asosiy testdan MUSTAQIL havza — sizdirish yo'q).
- **"O'qildi" mantig'i:** checkpoint bor bo'lim scroll bilan EMAS, javob berilganda
  o'qilgan hisoblanadi (`SectionRead`ga `checkpointAnswered` yozish — mavjud
  jadvalga bitta ustun yoki answersJson; eng sodda: SectionRead faqat checkpoint
  javobidan keyin yoziladi). Checkpoint'siz (eski) bo'lim — scroll-spy qoladi.
- Eski konspektlar checkpoint'siz — UI shunchaki ko'rsatmaydi.

### 1C. Audio-konspekt (ixtiyoriy, arzon)
- O'qituvchi konstruktorida "Audio yaratish" tugmasi: bo'limlar matni →
  `generateSpeech` (mavjud Gemini TTS) → bitta m4a/wav, storage'da keshlanadi,
  konspekt tahrirlansa eskiradi (digest version bilan solishtirish).
- Talaba: SectionReader tepasida ixcham audio-pleyer. `GET /me/topics/:id/digest-audio`
  (published+unlocked tekshiruvi, media route presedenti).
- Kvota/AiUsage hisobiga kiradi (ttsChars).

### Tekshiruv
- Smoke: media bloklari to'g'ri bo'limda, videoAt seek ishlaydi, checkpoint
  javob → SectionRead, eski konspekt regress yo'q.
- Playwright: talaba oqimi konsol toza.

---

## Faza 2 — Mindmap (AI'siz hosila, fleshkarta presedenti)

- **AI chaqiruvi YO'Q, backend o'zgarishi deyarli YO'Q**: manba — tasdiqlangan
  digest (sections → concepts/terms). Atama→bo'lim bog'lash mijoz tomonda matn
  moslik bilan (`TermTooltip::buildMatcher` reuse — unicode chegara, uzun avval).
- **Komponent** `lesson/MindmapView.tsx`: markazda mavzu → bo'lim tugunlari →
  har bo'limning atama/tushuncha barglari. Sof SVG, radial layout, dizayn
  tokenlari (`Charts.tsx` presedenti — tashqi kutubxona YO'Q).
- **Interaktiv (navigatsiya qatlami, dekoratsiya emas):**
  - bo'lim tuguni bosilsa → `?view=digest` + o'sha bo'limga scroll (anchor);
  - atama tuguni → TermTooltip popover (lat/uz/ru);
  - o'qilgan bo'lim tuguni — kontur-emerald belgi (OVOZ IERARXIYASI: to'ldirilgan
    yashil EMAS).
- **Joylashuv:** StudyRail O'rganish bloklariga `ContentView += "mindmap"`
  (fleshkarta qanday qo'shilgan bo'lsa shunday; bosqich EMAS). LessonOverview'da
  kichik preview bo'lishi mumkin (ixtiyoriy).
- Motion: tugunlar `useReducedMotion` bilan yumshoq paydo bo'ladi, focus-visible ring.
- v1 (bo'limsiz) konspekt → mindmap tuguni ko'rsatilmaydi (digest v2 sharti).
- **2-bosqich (HOZIR EMAS, alohida qaror):** bo'limlararo sabab-oqibat qirralari
  uchun 1 kichik AI chaqiruvi; kurs darajasidagi mavzular xaritasi.

### Tekshiruv
- Demo topic (5 bo'limli konspekt) — xarita to'g'ri quriladi, klik-navigatsiya,
  konsol toza (Playwright).

---

## Faza 3 — AI xarajatlarini kamaytirish (sifat saqlangan holda)

Monitoring fakti: oxirgi o'lchovda $1.16/$1.44 = **rasm**. Ustuvorlik shunga mos.

### 3A. Rasm opt-in (eng katta tejov)
- Slayd generatsiyasida AI har slaydga `imagePrompt` beradi (bo'sh = rasm yo'q) —
  bu bor. Qo'shiladi: **"Rasmlarni yaratish" bosqichida slayd checkboxlari**
  (PresentationEditor modal): default — faqat BODY_DIAGRAM/IMAGE_LEFT layoutlar
  belgilangan; o'qituvchi qo'shadi/olib tashlaydi.
- Backend `POST /presentations/:id/generate-images` `{slideIds?: string[]}`
  qabul qiladi (bo'sh = eski xatti-harakat, backward compat).
- Matnli slaydga atlas-rasm yasalmaydi → rasm soni ~ 2-3x kamayadi, sifat
  o'zgarmaydi (chizilganlari o'sha darajada).

### 3B. Video rasm reuse (Faza 0 talab qiladi)
- `video.ts` render: segmentda `slideIndex` bor va o'sha slaydning DONE rasm
  sloti bo'lsa → **yangi generateImage O'RNIGA slayd rasm faylini o'qib** HERO
  kadr yasaydi (`imgBuf` allaqachon fayldan o'qiladi — kod nuqtasi tayyor,
  `video.ts:360-374`). Generatsiya faqat mos slayd rasmi yo'q segmentlarga.
  `MAX_VIDEO_IMAGES` limiti qoladi (faqat yangi generatsiyalar sanaladi).
- Natija: video rasm xarajati deyarli 0 (prezentatsiya rasmlari bilan bo'lishadi).

### 3C. Gemini kontekst keshlash (matn tejovi)
- Muammo: bitta material matni 5-6 marta to'liq yuboriladi (digest→quiz→case→
  slides→factcheck→har tutor xabari 24k belgigacha).
- `gemini.ts`ga explicit caching (`@google/genai` caches API): topic material
  matni cache'lanadi (TTL ~1 soat, kalit: topicId+material hash), keyingi
  chaqiruvlar `cachedContent` bilan. Material o'zgarsa/qayta parse bo'lsa —
  hash o'zgaradi, eski kesh o'z-o'zidan eskiradi.
- ⚠️ OLDIN TEKSHIR: joriy kalit + `gemini-flash-latest` alias caching'ni
  qo'llashini kichik skript bilan sinab ko'r (xotira: 2.5-flash bloklangan,
  alias'lar ishlaydi). Qo'llamasa — bu band bekor, qolganlari mustaqil.
- Eng katta foyda: tutor-chat (har xabarda 24k kontekst) va ketma-ket
  generatsiya sessiyalari.

### 3D. Model tiering
- Virtual bemor **roleplay navbatlari** → `gemini-flash-lite-latest` (har navbat
  kichik, xato arzon, talaba baholanmaydi); **eval (baholash)** va barcha tibbiy
  kontent generatsiyasi → flash QOLADI.
- `modules/me/patient.ts`da model parametri; AiUsage'da model allaqachon
  yoziladi — /admin/ai byModel'da farq ko'rinadi.
- Sifat nazorati: 10 ta real roleplay smoke — bemor xulqi buzilmasa qoladi,
  buzilsa qaytariladi (bitta flag bilan).

### 3E. TTS segment keshi
- `video.ts` TTS bosqichi: har segment narration matni hash'i → WAV fayl nomi;
  rebuild'da hash mos kelsa qayta ovozlanmaydi (visualImageUrl presedenti).
  Skriptning 1 segmenti tahrirlansa faqat o'sha segment TTS bo'ladi.

### Tekshiruv
- Har band uchun before/after: /admin/ai oylik cost (AiUsage allaqachon yozadi).
- 3B: rebuild'da yangi rasm chaqiruvi 0 ekanini log bilan tasdiqla.
- 3C: cache hit'da input token kamayganini AiUsage'dan ko'r.

---

## Xavflar / eslatmalar
- **Eski kontent:** id'siz bo'limlar, sectionId'siz slaydlar, slideIndex'siz
  segmentlar hamma joyda graceful fallback (media bloki yo'q, mindmap yo'q,
  video rasm generatsiyasi eski yo'l) — hech narsa sinmaydi, yangi generatsiya
  yangi imkoniyatlarni oladi. Kerak bo'lsa o'qituvchiga "qayta generatsiya"
  tavsiyasi UI'da.
- **sectionIndex sifati:** AI noto'g'ri indeks qaytarishi mumkin — diapazon
  validatsiyasi + null fallback; smoke'da real generatsiya bilan tekshir.
- **Gemini caching:** kalit/model cheklovi (xotira faylı!) — Faza 3C boshida
  mini-smoke, ishlamasa band bekor.
- **Checkpoint ≠ test:** checkpoint javoblari bahoga kirmaydi, Question
  jadvaliga ARALASHMAYDI (digestJson ichida yashaydi) — test sizdirish xavfi yo'q.
- **i18n:** yangi bo'limlar uchun kalit bandligini tekshir (Modul 28 dublikat
  saboqi). Taxminiy prefikslar: `lesson.media*`, `lesson.checkpoint*`,
  `lesson.mindmap*`, `presentation.pickSlides*`.
- Har faza oxirida: 2-bo'lim o'z-o'zini tekshirish, tsc+build, smoke, commit,
  CLAUDE.md yangilash.
