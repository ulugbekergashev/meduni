// ⚠️ 2026-09-08 (Davomat 2.0, F0): holat xaritasi endi `lib/attendance.ts` da —
// butun ilova uchun bitta manba. Bu fayl faqat mavjud chaqiruv nomlarini saqlaydi
// (RollCallModal), yangi kod to'g'ridan-to'g'ri `lib/attendance` dan olsin.
// `fmtDate`/`fmtShort`/`monthRange` bu yerda edi, lekin ularni faqat o'chirilgan
// JournalView/ReportView ishlatardi — olib tashlandi.
export { ATT_META as STATUS_META, ATT_STATUSES as STATUSES } from "../../../../lib/attendance";
export type { AttStatusMeta } from "../../../../lib/attendance";
