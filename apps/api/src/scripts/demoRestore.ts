/**
 * Demo muhitni QAYTA TIKLASH (2026-07-23 — fan/kurs birlashuvi paytida db push
 * barcha akademik ma'lumotni o'chirib yuborgan; 5 user qolgan edi).
 *
 * YANGI sxemada (Course = fan: name+departmentId; Topic.courseId) idempotent
 * quradi: fakultet → kafedra → guruh → kurslar → mavzular → published test +
 * keys → talaba tarixi (tugagan urinish, xatolar bilan) → darslar+davomat →
 * fleshkarta takror jadvali. Modul 28 (xatolar xaritasi / AI tavsiya / bemor)
 * uchun signal beradi.
 *
 * Ishga tushirish:  npx tsx src/scripts/demoRestore.ts
 */
import { prisma } from "../lib/prisma";

async function main() {
  // ---- Foydalanuvchilar (seed'dan qolgan) ----
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@meduni.uz" } });
  const teacher = await prisma.user.findUniqueOrThrow({ where: { email: "teacher.m11demo@meduni.uz" } });
  const student = await prisma.user.findUniqueOrThrow({ where: { email: "student@meduni.uz" } });
  const facAdmin = await prisma.user.findUnique({ where: { email: "fakultet.admin@meduni.uz" } });
  const deptAdmin = await prisma.user.findUnique({ where: { email: "kafedra.admin@meduni.uz" } });
  void admin;

  // ---- Tuzilma ----
  let faculty = await prisma.faculty.findFirst({ where: { name: "Davolash fakulteti" } });
  if (!faculty) faculty = await prisma.faculty.create({ data: { name: "Davolash fakulteti" } });

  async function dept(name: string) {
    const d = await prisma.department.findFirst({ where: { facultyId: faculty!.id, name } });
    return d ?? prisma.department.create({ data: { facultyId: faculty!.id, name } });
  }
  const kardio = await dept("Kardiologiya kafedrasi");
  const ichki = await dept("Ichki kasalliklar kafedrasi");

  let group = await prisma.studentGroup.findFirst({ where: { name: "301-guruh" } });
  if (!group)
    group = await prisma.studentGroup.create({ data: { facultyId: faculty.id, name: "301-guruh", yearOfStudy: 3 } });

  // ---- Bog'lashlar ----
  await prisma.user.update({ where: { id: student.id }, data: { groupId: group.id } });
  if (facAdmin) await prisma.user.update({ where: { id: facAdmin.id }, data: { facultyId: faculty.id } });
  if (deptAdmin) await prisma.user.update({ where: { id: deptAdmin.id }, data: { adminDepartmentId: kardio.id } });
  await prisma.teacherProfile.upsert({
    where: { userId: teacher.id },
    create: { userId: teacher.id, departmentId: kardio.id, position: "Dotsent" },
    update: { departmentId: kardio.id },
  });

  // ---- Kurslar (YANGI sxema: kurs = fan) ----
  async function course(name: string, departmentId: number, semester: number) {
    const c = await prisma.course.findFirst({ where: { name, teacherId: teacher.id } });
    if (c) return c;
    return prisma.course.create({
      data: { name, departmentId, teacherId: teacher.id, semester, academicYear: "2026/2027" },
    });
  }
  const cardio = await course("Kardiologiya", kardio.id, 2);
  const nefro = await course("Nefrologiya", ichki.id, 2);

  for (const c of [cardio, nefro]) {
    const cg = await prisma.courseGroup.findFirst({ where: { courseId: c.id, groupId: group.id } });
    if (!cg) await prisma.courseGroup.create({ data: { courseId: c.id, groupId: group.id } });
    await prisma.enrollment.upsert({
      where: { studentId_courseId: { studentId: student.id, courseId: c.id } },
      create: { studentId: student.id, courseId: c.id, status: "ACTIVE" },
      update: { status: "ACTIVE" },
    });
  }

  // ---- Mavzular (Kardiologiya) ----
  async function topic(courseId: number, title: string, orderIndex: number) {
    const t = await prisma.topic.findFirst({ where: { courseId, title } });
    if (t) return t;
    return prisma.topic.create({ data: { courseId, title, orderIndex, status: "PUBLISHED" } });
  }
  const anatomy = await topic(cardio.id, "Yurak anatomiyasi", 1);
  const fizio = await topic(cardio.id, "Yurak fiziologiyasi", 2);
  await topic(nefro.id, "Buyrak fiziologiyasi", 1);

  // ---- Published testlar ----
  interface Q {
    text: string;
    options: string[];
    correct: number;
    explain: string[];
    source: string;
  }
  async function quiz(topicId: number, pass: number, maxAttempts: number, qs: Q[]) {
    let item = await prisma.contentItem.findFirst({ where: { topicId, kind: "QUIZ" } });
    if (!item) {
      item = await prisma.contentItem.create({
        data: {
          topicId,
          kind: "QUIZ",
          language: "uz",
          status: "PUBLISHED",
          approvedById: teacher.id,
          approvedAt: new Date(),
          factcheckStatus: "CLEAN",
        },
      });
    }
    let qz = await prisma.quiz.findUnique({ where: { contentItemId: item.id }, include: { questions: true } });
    if (!qz) {
      qz = { ...(await prisma.quiz.create({ data: { contentItemId: item.id, passThreshold: pass, maxAttempts } })), questions: [] };
    }
    if (qz.questions.length === 0) {
      for (const [i, q] of qs.entries()) {
        await prisma.question.create({
          data: {
            quizId: qz.id,
            text: q.text,
            optionsJson: q.options,
            correctIndex: q.correct,
            explanationJson: q.explain,
            difficulty: i < 2 ? "RECALL" : "UNDERSTAND",
            sourceFragment: q.source,
            orderIndex: i,
          },
        });
      }
    }
    return prisma.quiz.findUniqueOrThrow({ where: { id: qz.id }, include: { questions: { orderBy: { orderIndex: "asc" } } } });
  }

  const anatomyQuiz = await quiz(anatomy.id, 60, 3, [
    {
      text: "Yurak nechta kameradan iborat?",
      options: ["2 ta", "3 ta", "4 ta", "5 ta"],
      correct: 2,
      explain: ["Noto'g'ri.", "Noto'g'ri.", "To'g'ri — 2 bo'lmacha va 2 qorincha.", "Noto'g'ri."],
      source: "Yurak to'rt kamerali organ: ikki bo'lmacha va ikki qorincha.",
    },
    {
      text: "Mitral klapan qayerda joylashgan?",
      options: ["O'ng bo'lmacha va o'ng qorincha orasida", "Chap bo'lmacha va chap qorincha orasida", "Aorta og'zida", "O'pka arteriyasi og'zida"],
      correct: 1,
      explain: ["Bu uch tavaqali klapan.", "To'g'ri — mitral (ikki tavaqali) klapan chap tomonda.", "Bu aortal klapan.", "Bu pulmonal klapan."],
      source: "Mitral klapan chap bo'lmacha bilan chap qorincha orasida joylashadi.",
    },
    {
      text: "Yurakning o'z qon ta'minoti qaysi tomirlar orqali amalga oshadi?",
      options: ["Koronar arteriyalar", "O'pka venalari", "Kovak venalar", "Aorta ravog'i shoxlari"],
      correct: 0,
      explain: ["To'g'ri — toj (koronar) arteriyalar miokardni oziqlantiradi.", "Ular chap bo'lmachaga qon olib keladi.", "Ular o'ng bo'lmachaga quyiladi.", "Ular bosh-bo'yinni ta'minlaydi."],
      source: "Miokard qon ta'minoti koronar arteriyalar orqali.",
    },
  ]);

  const fizioQuiz = await quiz(fizio.id, 70, 3, [
    {
      text: "Yurak ritmini kim boshqaradi?",
      options: ["Atrioventrikulyar tugun", "Sinoatrial tugun", "Giss tutami", "Purkinye tolalari"],
      correct: 1,
      explain: ["AV tugun ikkilamchi markaz (40–60).", "To'g'ri — SA tugun birlamchi vodiy ritm (60–100 imp/daq).", "U impulsni qorinchalarga o'tkazadi.", "Ular oxirgi bo'g'in (20–40)."],
      source: "SA tugun impuls chastotasi ~60–100 imp/daq — u yurak ritmini belgilaydi.",
    },
    {
      text: "AV tugunda impuls taxminan qancha ushlanadi?",
      options: ["~0,01 s", "~0,1 s", "~1 s", "Ushlanmaydi"],
      correct: 1,
      explain: ["Juda qisqa.", "To'g'ri — ~0,1 s kechikish bo'lmachalar avval qisqarishini ta'minlaydi.", "Juda uzoq.", "Fiziologik kechikish mavjud."],
      source: "AV tugunda impuls ~0,1 s ushlanadi.",
    },
    {
      text: "Tinch holatda zarba hajmi taxminan qancha?",
      options: ["~7 ml", "~70 ml", "~700 ml", "~5 l"],
      correct: 1,
      explain: ["Kam.", "To'g'ri — ~70 ml.", "Ko'p.", "Bu minutlik hajm (yurak chiqishi)."],
      source: "Zarba hajmi tinch holatda ~70 ml; yurak chiqishi ~5 l/daq.",
    },
    {
      text: "Frank–Starling qonuni nimani bildiradi?",
      options: [
        "Chastota oshsa zarba hajmi kamayadi",
        "Diastolada cho'zilish qancha ko'p bo'lsa, qisqarish kuchi shuncha katta",
        "Miokard tetanik qisqaradi",
        "Impuls faqat nerv orqali keladi",
      ],
      correct: 1,
      explain: ["Bunday emas.", "To'g'ri — cho'zilish ↑ → qisqarish kuchi ↑.", "Miokard tetanik qisqarmaydi.", "Yurak avtomatizmga ega."],
      source: "Frank–Starling qonuni: diastolada tolalar qancha cho'zilsa, qisqarish shuncha kuchli.",
    },
    {
      text: "Purkinye tolalarining xususiy chastotasi qancha?",
      options: ["60–100 imp/daq", "40–60 imp/daq", "20–40 imp/daq", "100–120 imp/daq"],
      correct: 2,
      explain: ["Bu SA tugun.", "Bu AV tugun.", "To'g'ri — 20–40 imp/daq (uchlamchi markaz).", "Bunday markaz yo'q."],
      source: "Purkinye tolalari: 20–40 imp/daq; qorinchalarni deyarli bir vaqtda qo'zg'atadi.",
    },
  ]);

  // ---- Published klinik keys (v2 qadamlar bilan) — Yurak fiziologiyasi ----
  let caseItem = await prisma.contentItem.findFirst({ where: { topicId: fizio.id, kind: "CASE" } });
  if (!caseItem) {
    caseItem = await prisma.contentItem.create({
      data: {
        topicId: fizio.id,
        kind: "CASE",
        language: "uz",
        status: "PUBLISHED",
        approvedById: teacher.id,
        approvedAt: new Date(),
        factcheckStatus: "CLEAN",
      },
    });
  }
  const caseJson = {
    complaints: "Holsizlik, bosh aylanishi, hushdan ketishga moyillik.",
    anamnesis: "3 kundan beri holsizlik kuchaygan; ilgari yurak kasalligi qayd etilmagan.",
    objectiveStatus: "Bemor hushida, terisi rangpar. Yurak tonlari bo'g'iq, bradikardiya.",
    labData: "EKG: to'liq AV blokada belgilari — bo'lmacha va qorincha mustaqil qisqaradi.",
    patientName: "Bemor A.",
    patientInfo: "62 yosh, erkak",
    vitals: { bp: "150/90", pulse: "38", spo2: "95%", temp: "36.6°C" },
    steps: [
      {
        title: "Yetakchi buzilishni aniqlash",
        prompt: "EKG'da qorincha chastotasi 38/daq, bo'lmacha 78/daq va ular bir-biriga bog'liq emas. Bu nima?",
        options: [
          { text: "To'liq (III daraja) AV blokada", correct: true, feedback: "To'g'ri — bo'lmacha va qorincha to'liq dissotsiatsiyada." },
          { text: "Sinus bradikardiyasi", correct: false, feedback: "Sinus bradikardiyada bo'lmacha va qorincha bog'liq qoladi." },
          { text: "Bo'lmacha fibrillyatsiyasi", correct: false, feedback: "Bunda bo'lmacha ritmi tartibsiz bo'lardi." },
        ],
      },
      {
        title: "Vodiy ritmni topish",
        prompt: "Qorinchalarni 38/daq bilan qaysi markaz qo'zg'atmoqda?",
        options: [
          { text: "Purkinye / qorincha o'chog'i (20–40 imp/daq)", correct: true, feedback: "To'g'ri — blokadadan pastdagi uchlamchi markaz." },
          { text: "SA tugun", correct: false, feedback: "SA impulslari qorinchalarga o'tmayapti." },
          { text: "AV tugun (40–60)", correct: false, feedback: "Chastota AV tugun diapazonidan past." },
        ],
      },
      {
        title: "Boshlang'ich taktika",
        prompt: "Gemodinamika beqaror bemorда birinchi qadam?",
        options: [
          { text: "Vaqtinchalik yurak stimulyatsiyasi (peysmeyker) ga tayyorlash", correct: true, feedback: "To'g'ri — simptomatik to'liq blokadada." },
          { text: "Beta-blokator berish", correct: false, feedback: "Bradikardiyani yanada kuchaytiradi — xavfli." },
          { text: "Kuzatuv, davolashsiz", correct: false, feedback: "Beqaror bemorда kutish mumkin emas." },
        ],
      },
    ],
    questions: [
      "Yurak chiqishi (minutlik hajm) nega kamaydi va bu bosh aylanishini qanday tushuntiradi?",
      "Nega quyi (Purkinye) markaz ritmni o'z zimmasiga oldi?",
    ],
    referenceAnswer: [
      "Yurak chiqishi = zarba hajmi × chastota. Chastota 38 gacha tushgani uchun minutlik hajm keskin kamaydi, miya perfuziyasi buzildi — bosh aylanishi va hushdan ketish.",
      "Yuqori markazdan (SA) impuls qorinchalarga o'tmagani uchun quyi avtomatizm markazi (Purkinye, 20–40 imp/daq) himoya vodiy ritmini oldi.",
    ],
  };
  const clinicalCase = await prisma.clinicalCase.upsert({
    where: { contentItemId: caseItem.id },
    create: { contentItemId: caseItem.id, caseJson, format: "EXTENDED" },
    update: { caseJson },
  });

  // ---- Talaba tarixi: tugagan test urinishi (1 xato → xatolar xaritasi/mashq) ----
  const existingAttempt = await prisma.quizAttempt.findFirst({
    where: { quizId: anatomyQuiz.id, studentId: student.id },
  });
  if (!existingAttempt) {
    // Q1 to'g'ri (2), Q2 XATO (0 o'rniga 2), Q3 to'g'ri (0) → 2/3 = 67%
    await prisma.quizAttempt.create({
      data: {
        quizId: anatomyQuiz.id,
        studentId: student.id,
        answersJson: {
          [anatomyQuiz.questions[0].id]: 2,
          [anatomyQuiz.questions[1].id]: 0,
          [anatomyQuiz.questions[2].id]: 0,
        },
        scorePct: 67,
        passed: true,
        attemptNo: 1,
        finishedAt: new Date(),
      },
    });
  }

  // ---- Talaba keys javobi (1 qadam xato → keys tekshiruv navbati/bemor logi) ----
  const existingCase = await prisma.caseAttempt.findFirst({
    where: { caseId: clinicalCase.id, studentId: student.id },
  });
  if (!existingCase) {
    await prisma.caseAttempt.create({
      data: {
        caseId: clinicalCase.id,
        studentId: student.id,
        answersJson: [
          "Chastota juda past bo'lgani uchun minutlik hajm kamaygan, miyaga qon yetmagan.",
          "Quyi markazlar o'z avtomatizmiga ega, shuning uchun ular ritmni oladi.",
        ],
        // step 0 to'g'ri (0), step 1 to'g'ri (0), step 2 XATO (1) → autoScore 67
        stepsJson: { "0": 0, "1": 0, "2": 1 },
        autoScore: 67,
        submittedAt: new Date(),
      },
    });
  }

  // ---- Fleshkarta takrori (mavzu kesimida "bilmayman" signali) ----
  const fcCount = await prisma.flashcardReview.count({ where: { studentId: student.id, topicId: anatomy.id } });
  if (fcCount === 0) {
    const cards: { key: string; known: boolean }[] = [
      { key: `q:${anatomyQuiz.questions[0].id}`, known: true },
      { key: `q:${anatomyQuiz.questions[1].id}`, known: false },
      { key: `q:${anatomyQuiz.questions[2].id}`, known: true },
    ];
    for (const c of cards) {
      await prisma.flashcardReview.create({
        data: { studentId: student.id, topicId: anatomy.id, cardKey: c.key, known: c.known, intervalDays: c.known ? 3 : 0 },
      });
    }
  }

  // ---- Darslar + davomat ----
  async function session(courseId: number, topicId: number | null, daysAgo: number, title: string, room: string) {
    const date = new Date(Date.now() - daysAgo * 86_400_000);
    const s = await prisma.lessonSession.findFirst({ where: { courseId, title } });
    if (s) return s;
    return prisma.lessonSession.create({ data: { courseId, topicId, date, title, room, createdById: teacher.id } });
  }
  const s1 = await session(cardio.id, anatomy.id, 6, "Yurak anatomiyasi — ma'ruza", "204-xona");
  const s2 = await session(cardio.id, fizio.id, 2, "Yurak fiziologiyasi — amaliy", "204-xona");
  for (const [sess, status] of [[s1, "PRESENT"], [s2, "LATE"]] as const) {
    const a = await prisma.attendance.findFirst({ where: { sessionId: sess.id, studentId: student.id } });
    if (!a) {
      await prisma.attendance.create({
        data: { sessionId: sess.id, studentId: student.id, status, markedById: teacher.id },
      });
    }
  }

  console.log("✅ Demo tiklandi:");
  console.log(`   Fakultet: ${faculty.name} · kafedralar: ${kardio.name}, ${ichki.name}`);
  console.log(`   Kurslar: ${cardio.name} (${anatomy.title}, ${fizio.title}) · ${nefro.name}`);
  console.log(`   Talaba: ${student.email} — anatomy testi 67% (1 xato), keys 67% (1 qadam xato), 3 fleshkarta, 2 dars`);
  console.log(`   O'qituvchi: ${teacher.email} · Guruh: ${group.name}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
