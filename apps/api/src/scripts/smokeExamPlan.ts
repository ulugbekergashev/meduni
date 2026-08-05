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
  spent: 999_999, // AI xato hisoblasa ham — server o'zi hisoblaydi
  wasted: 0,
  items: [
    { test: "EKG", verdict: "required", note: "Ishemiya belgisi", cost: 0 },
    { test: "  troponin ", verdict: "required", note: "Nekroz markeri", cost: 0 },
    { test: "MRT", verdict: "unnecessary", note: "Bu holatda ko'rsatma yo'q", cost: 0 },
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

const empty = buildExamPlan([], { rationalityScore: 10, spent: 0, wasted: 0, items: [], missed: [] });
check("tekshiruvsiz reja: spent 0", empty.spent === 0 && empty.items.length === 0);

const weird = buildExamPlan(orders, {
  rationalityScore: 350,
  spent: 0,
  wasted: 0,
  // AI noto'g'ri qiymat / begona test qaytarsa
  items: [{ test: "Bunday test buyurilmagan", verdict: "REQUIRED!!" as never, note: "", cost: 0 }],
  missed: [],
});
check("ball 0..100 ga siqiladi", weird.rationalityScore === 100, weird.rationalityScore);
check("AI qo'shgan begona test ro'yxatga kirmaydi", weird.items.length === 3, weird.items.length);
check("noma'lum verdict → optional", weird.items.every((i) => i.verdict === "optional"));

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
