// DAVOMAT — frontend uchun YAGONA manba: holat → rang/ikonka/qisqa kod + chegara.
//
// ⚠️ NEGA (2026-09-08 auditi): holat xaritasi 4 xil shaklda 6 marta yozilgan edi
// (student/AttendanceSection `META`, student/SchedulePage `STATUS_CELL`,
// teach/AttendanceMatrix `STATUS_META` massiv, teach/StudentDetailPage `attTone`,
// teach/course/attendance/meta.ts, va inline massivlar UserProfilePage/CourseDetail
// da). Natijada "Sababli" bir ekranda `Minus`, boshqasida `HelpCircle` edi, qisqa
// kod uch xil ko'rinardi. Chegara 75 esa 13 ta joyda qattiq yozilgan, matritsada
// esa umuman boshqa (80/60) edi — bir talaba ikki ekranda ikki rangda chiqardi.
//
// ⚠️ F1: `LOW_ATTENDANCE_PCT` `LearningPolicy` koridoridan (warnUnexcusedPct)
// olinadi — chegarani o'zgartirish reliz emas, /admin/control sahifasi ishi bo'ladi.
// Shu sabab hamma joyda `isLowAttendance()` chaqiriladi, raqam emas.
import { Check, Clock, Minus, X, type LucideIcon } from "lucide-react";

export type AttStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
export const ATT_STATUSES: AttStatus[] = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];

/** Past davomat chegarasi (%) — backend `attendance/facts.ts` bilan bir xil. */
export const LOW_ATTENDANCE_PCT = 75;

/** Belgilanmagan (null) — past EMAS: "yomon" bilan "ma'lumot yo'q" aralashmasin. */
export function isLowAttendance(pct: number | null | undefined): boolean {
  return pct !== null && pct !== undefined && pct < LOW_ATTENDANCE_PCT;
}

/** Foiz matni: belgilanmagan bo'lsa "—" (0 % EMAS — u yolg'on xabar). */
export function pctText(pct: number | null | undefined): string {
  return pct === null || pct === undefined ? "—" : `${pct}%`;
}

export interface AttStatusMeta {
  key: AttStatus;
  icon: LucideIcon;
  /** Yumshoq chip — ro'yxat qatorlari, jurnal. */
  chip: string;
  /** To'ldirilgan — matritsa katagi (tanlangan holat). */
  solid: string;
  hover: string;
  /** Faqat matn rangi — legenda, izohlar. */
  text: string;
  /** Chap chekka rangi — jadval katagi (fon bir xil, holat chekkada). */
  border: string;
  /** Qisqa kod — jurnal va eksport (xlsx bilan bir xil). */
  short: string;
  /** Tor katak uchun belgi — matritsa 32px kataklari. */
  glyph: string;
  /** i18n: `attendance.status.<KEY>` (uz/ru yorliqlar). */
  i18nKey: string;
}

// ⚠️ "Sababli" ikonkasi — `Minus` (neytral). Ilgari matritsada `HelpCircle` edi,
// ya'ni ekran hujjatli sababni "noaniq" deb ko'rsatardi.
export const ATT_META: Record<AttStatus, AttStatusMeta> = {
  PRESENT: {
    key: "PRESENT",
    icon: Check,
    chip: "bg-emerald-soft text-emerald",
    solid: "bg-emerald text-white",
    hover: "hover:bg-emerald-soft hover:text-emerald",
    text: "text-emerald",
    border: "border-l-emerald",
    short: "K",
    glyph: "✓",
    i18nKey: "PRESENT",
  },
  ABSENT: {
    key: "ABSENT",
    icon: X,
    chip: "bg-rose-soft text-rose",
    solid: "bg-rose text-white",
    hover: "hover:bg-rose-soft hover:text-rose",
    text: "text-rose",
    border: "border-l-rose",
    short: "KM",
    glyph: "✗",
    i18nKey: "ABSENT",
  },
  LATE: {
    key: "LATE",
    icon: Clock,
    chip: "bg-amber-soft text-amber",
    solid: "bg-amber text-white",
    hover: "hover:bg-amber-soft hover:text-amber",
    text: "text-amber",
    border: "border-l-amber",
    short: "KCH",
    glyph: "~",
    i18nKey: "LATE",
  },
  EXCUSED: {
    key: "EXCUSED",
    icon: Minus,
    chip: "bg-blue-soft text-blue",
    solid: "bg-blue text-white",
    hover: "hover:bg-blue-soft hover:text-blue",
    text: "text-blue",
    border: "border-l-blue",
    short: "S",
    glyph: "S",
    i18nKey: "EXCUSED",
  },
};

export const attMeta = (s: AttStatus): AttStatusMeta => ATT_META[s];

/** Legendalar va tugmalar uchun tartib (Keldi → Kelmadi → Kechikdi → Sababli). */
export const ATT_META_LIST: AttStatusMeta[] = ATT_STATUSES.map((s) => ATT_META[s]);
