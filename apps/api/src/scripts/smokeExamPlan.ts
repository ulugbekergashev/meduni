// Virtual bemor — TEKSHIRUV REJASI (narx + reja tahlili) mantiqiy smoke.
// Gemini kerak emas: narx deterministik, reja hukmi server tomonda mustahkamlanadi.
//   npx tsx src/scripts/smokeExamPlan.ts
import { BUDGET_SOFT, catalogFor, costOf, TEST_CATALOG } from "../modules/me/testCatalog";
import { buildExamPlan } from "../modules/me/patient";
import { evalUserContent } from "../ai/prompts/patient";

let ok = 0;
let fail = 0;
function check(name: string, cond: boolean, got?: unknown) {
  if (cond) {
    ok++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}${got !== undefined ? ` — got: ${JSON.stringify(got)}` : ""}`);
  }
}

console.log("\n— Katalog va narx —");
check("katalog bo'sh emas", TEST_CATALOG.length >= 16, TEST_CATALOG.length);
check("uz katalogi lokalizatsiya qilingan", catalogFor("uz")[0].name === TEST_CATALOG[0].uz);
check("ru katalogi lokalizatsiya qilingan", catalogFor("ru")[0].name === TEST_CATALOG[0].ru);
check("EKG arzon (30)", costOf("EKG") === 30, costOf("EKG"));
check("ЭКГ (ru nomi) ham topiladi", costOf("ЭКГ") === 30, costOf("ЭКГ"));
check("registr/bo'shliq ahamiyatsiz", costOf("  ekg ") === 30, costOf("  ekg "));
check("apostrof normallashadi", costOf("Koʻkrak qafasi rentgeni") === 60, costOf("Ko'krak qafasi rentgeni"));
check("MRT — eng qimmat", costOf("MRT") === 900, costOf("MRT"));
check("erkin buyurtma: 'Bosh miya MRT si' → 900", costOf("Bosh miya MRT si") === 900, costOf("Bosh miya MRT si"));
check("erkin buyurtma: 'КТ органов грудной клетки' → 550", costOf("КТ органов грудной клетки") === 550);
check("erkin buyurtma: 'jigar biopsiyasi' → 400", costOf("jigar biopsiyasi") === 400);
check("noma'lum nom sukut narxda", costOf("qandaydir tahlil") === 60, costOf("qandaydir tahlil"));
check("byudjet chegarasi mavjud", BUDGET_SOFT > 0 && BUDGET_SOFT < 1000, BUDGET_SOFT);

console.log("\n— Reja: RO'YXAT serverdan, HUKM AI dan —");
const orders = [
  { name: "EKG", cost: 30 },
  { name: "Troponin", cost: 120 },
  { name: "MRT", cost: 900 },
];
const plan = buildExamPlan(orders, {
  rationalityScore: 45,
  items: [
    { test: "EKG", verdict: "required", note: "Ishemiya belgisi" },
    { test: "  troponin ", verdict: "required", note: "Nekroz markeri" },
    { test: "MRT", verdict: "unnecessary", note: "Bu holatda ko'rsatma yo'q" },
  ],
  missed: [{ test: "Umumiy qon tahlili", why: "Yallig'lanishni istisno qilish" }],
});
check("xarajat serverdan hisoblanadi (AI raqami e'tiborsiz)", plan.spent === 1050, plan.spent);
check("ortiqcha = keraksiz testlar narxi", plan.wasted === 900, plan.wasted);
check("hukm nomi normallashib mos keladi", plan.items[1].verdict === "required", plan.items[1]);
check("narx har qatorда katalogdan", plan.items[2].cost === 900, plan.items[2].cost);
check("rationalityScore clamp ichida", plan.rationalityScore === 45);
check("missed o'tadi", plan.missed.length === 1 && plan.missed[0].test === "Umumiy qon tahlili");

console.log("\n— Chegara holatlari —");
const noAi = buildExamPlan(orders, undefined);
check("AI examPlan bermasa — ro'yxat baribir to'liq", noAi.items.length === 3, noAi.items.length);
check("hukmsiz qator 'optional' bo'ladi", noAi.items.every((i) => i.verdict === "optional"));
check("hukmsiz holatda ortiqcha = 0", noAi.wasted === 0);
check("AI ballsiz → 0", noAi.rationalityScore === 0);

const empty = buildExamPlan([], { rationalityScore: 10, items: [], missed: [] });
check("tekshiruvsiz reja: spent 0", empty.spent === 0 && empty.items.length === 0);

const weird = buildExamPlan(orders, {
  rationalityScore: 350,
  // AI noto'g'ri qiymat / begona test qaytarsa
  items: [{ test: "Bunday test buyurilmagan", verdict: "REQUIRED!!", note: "" }],
  missed: [],
});
check("ball 0..100 ga siqiladi", weird.rationalityScore === 100, weird.rationalityScore);
check("AI qo'shgan begona test ro'yxatga kirmaydi", weird.items.length === 3, weird.items.length);
check("noma'lum verdict → optional", weird.items.every((i) => i.verdict === "optional"));

console.log("\n— Jazo: buyurish paytidagi hukm USTUVOR —");
// Buyurtmachi: "kerakmas tekshiruv buyurganda ko'rsatkichlari tushsin".
// Talaba jarayonда ko'rgan hukm yakunda o'zgarmasligi kerak.
const live = [
  { name: "EKG", cost: 30, indicated: true },
  { name: "MRT", cost: 900, indicated: false },
  { name: "Bosh miya KT si", cost: 550, indicated: false },
];
const p2 = buildExamPlan(live, {
  rationalityScore: 60,
  // AI yakunda FIKRINI O'ZGARTIRSA ham saqlangan hukm ustun turadi
  items: [
    { test: "EKG", verdict: "unnecessary", note: "" },
    { test: "MRT", verdict: "required", note: "" },
    { test: "Bosh miya KT si", verdict: "optional", note: "" },
  ],
  missed: [],
});
check("buyurishда o'rinli deb topilgan test keraksizga aylanmaydi", p2.items[0].verdict === "optional", p2.items[0].verdict);
check("buyurishда ortiqcha deb topilgani ortiqcha qoladi (1)", p2.items[1].verdict === "unnecessary");
check("buyurishда ortiqcha deb topilgani ortiqcha qoladi (2)", p2.items[2].verdict === "unnecessary");
check("ortiqchalar soni", p2.unneededCount === 2, p2.unneededCount);
check("jazo = 2 × 15 = 30 ball", p2.penalty === 30, p2.penalty);
check("bekorga ketgan pul = 900 + 550", p2.wasted === 1450, p2.wasted);

const clean2 = buildExamPlan(
  [{ name: "EKG", cost: 30, indicated: true }],
  { rationalityScore: 90, items: [{ test: "EKG", verdict: "required", note: "" }], missed: [] }
);
check("ortiqcha yo'q → jazo 0", clean2.penalty === 0 && clean2.unneededCount === 0);

// Izoh ham buyurish paytidagi qarordan — "Keraksiz" ostida "foydali edi" turmasin.
const noteFix = buildExamPlan(
  [{ name: "MRT", cost: 900, indicated: false, reason: "Bu holatda ko'rsatma yo'q" }],
  { rationalityScore: 50, items: [{ test: "MRT", verdict: "required", note: "Juda foydali edi" }], missed: [] }
);
check("izoh saqlangan qarordan olinadi", noteFix.items[0].note === "Bu holatda ko'rsatma yo'q", noteFix.items[0].note);
check("izoh bo'lmasa AI izohiga qaytadi", plan.items[0].note === "Ishemiya belgisi");
check("eski sessiya (hukm saqlanmagan) → jazo 0", noAi.penalty === 0, noAi.penalty);

console.log("\n— Baholash promptida narx ko'rinadi —");
const uc = evalUserContent([{ role: "student", text: "Salom" }], "Miokard infarkti", orders);
check("buyurilgan testlar promptда", uc.includes("EKG — 30") && uc.includes("MRT — 900"));
check("jami xarajat promptда", uc.includes("JAMI XARAJAT: 1050"));
check(
  "tekshiruvsiz holat aniq yoziladi",
  evalUserContent([], "x", []).includes("hech qanday tekshiruv buyurilmagan")
);

console.log(`\n${fail === 0 ? "✅" : "❌"} ${ok}/${ok + fail}`);
process.exit(fail === 0 ? 0 : 1);
