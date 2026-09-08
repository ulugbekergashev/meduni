import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CalendarRange, CheckCircle2, GraduationCap } from "lucide-react";
import { Button, Card, Icon, Num, cls, useToast } from "@meduni/ui";
import { apiErrorMessage } from "../../../lib/api";
import { useLocale } from "../../../lib/useLocale";
import { formatDate } from "../../../lib/date";
import { useFinishCycle, useTeachCycles, type CyclePassport as Cycle } from "../api";

/**
 * SIKL PASPORTI — buyurtmachining asosiy tushunchasi.
 *
 * Tibbiyot vuzida 4-6 kurslar kafedralarni BLOK bo'lib o'tadi: guruh 2-4 haftaga
 * keladi (ko'pincha BOSHQA fakultetdan), oxirgi kuni imtihon, keyin kafedra
 * dekanatga hisobot beradi. Ilgari bu tushuncha ekranda umuman yo'q edi — sikl
 * faqat "Jadval sozlash" oynasidagi ikki sana edi.
 *
 * ⚠️ "Siklni yakunlash" belgilanmagan dars qolgan bo'lsa ISHLAMAYDI: hisobot
 * to'liq bo'lmasa, dekanatga yolg'on davomat ketadi.
 */
function ZoneChip({ zone, children }: { zone: Cycle["atRisk"][number]["zone"]; children: React.ReactNode }) {
  const tone = zone === "BLOCKED" ? "bg-rose text-white" : zone === "DANGER" ? "bg-rose-soft text-rose" : "bg-amber-soft text-amber";
  return <span className={cls("rounded-pill px-2 py-0.5 text-micro font-semibold", tone)}>{children}</span>;
}

function CycleCard({ c }: { c: Cycle }) {
  const { t } = useTranslation(undefined, { keyPrefix: "groupProfile" });
  const locale = useLocale();
  const navigate = useNavigate();
  const { show } = useToast();
  const finish = useFinishCycle();

  const done = c.status === "FINISHED";
  const dayPct = c.totalDays > 0 ? Math.min(100, Math.round((c.dayNo / c.totalDays) * 100)) : 0;

  return (
    <Card className="p-0">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <Icon icon={CalendarRange} size={16} className="text-brand-tint" />
        <span className="text-note font-semibold text-ink">{c.courseName}</span>
        {c.isGuest && (
          <span className="rounded-pill bg-violet-soft px-2 py-0.5 text-micro font-semibold text-violet">
            {t("cycleGuest")} · {c.facultyName}
          </span>
        )}
        {done && (
          <span className="rounded-pill bg-emerald-soft px-2 py-0.5 text-micro font-semibold text-emerald">{t("cycleFinished")}</span>
        )}
        <span className="ml-auto text-micro text-ink-faint">
          <Num>{formatDate(locale, c.startKey, "short")}</Num> — <Num>{formatDate(locale, c.endKey, "short")}</Num>
        </span>
      </div>

      <div className="px-4 py-3">
        {/* Sikl qayerda: kun va soat — ikkalasi ham kerak, chunki kunlar teng emas. */}
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-note font-semibold text-ink">{t("cycleDay", { k: c.dayNo, n: c.totalDays })}</span>
          <span className="text-micro text-ink-soft">{t("cycleHours", { k: c.heldHours, n: c.totalHours })}</span>
          {c.examKey && <span className="text-micro text-ink-faint">{t("cycleExam", { d: formatDate(locale, c.examKey, "short") })}</span>}
        </div>
        {dayPct > 0 && (
          <div className="mt-2 h-1 overflow-hidden rounded-pill bg-line-soft">
            <div className="h-full rounded-pill bg-brand" style={{ width: `${dayPct}%` }} />
          </div>
        )}

        {/* Koridordan chiqqanlar — ismlar bilan, chunki ular bilan ISHLASH kerak. */}
        <div className="mt-3">
          {c.atRisk.length === 0 ? (
            <p className="flex items-center gap-1.5 text-micro text-emerald">
              <Icon icon={CheckCircle2} size={13} /> {t("cycleNoRisk")}
            </p>
          ) : (
            <>
              <p className="mb-1.5 text-micro font-semibold text-ink-soft">{t("cycleAtRisk")}</p>
              <div className="flex flex-col gap-1">
                {c.atRisk.slice(0, 5).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => navigate(`/teach/students/${s.id}`)}
                    className="flex items-center gap-2 rounded-control px-1 py-0.5 text-left transition-colors hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    <span className="min-w-0 flex-1 truncate text-micro text-ink">{s.fullName}</span>
                    <span className="text-micro text-ink-faint">{t("cycleOf", { h: s.unexcusedHours, limit: s.limitHours })}</span>
                    <ZoneChip zone={s.zone}>{t(`zone${s.zone}`, { defaultValue: s.zone })}</ZoneChip>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-2.5">
        {c.unmarkedLessons > 0 ? (
          <span className="flex items-center gap-1.5 text-micro text-amber">
            <Icon icon={AlertTriangle} size={13} /> {t("cycleUnmarked", { n: c.unmarkedLessons })}
          </span>
        ) : (
          <span className="text-micro text-ink-faint">
            <Num>{c.studentCount}</Num>
          </span>
        )}
        {!done && (
          <Button
            size="sm"
            variant="soft"
            className="ml-auto"
            disabled={finish.isPending || c.unmarkedLessons > 0}
            onClick={() =>
              finish.mutate(c.cycleId, {
                onError: (e) => show(apiErrorMessage(e, locale) ?? "Xatolik", "warn"),
              })
            }
          >
            <Icon icon={GraduationCap} size={14} /> {t("cycleFinish")}
          </Button>
        )}
      </div>
    </Card>
  );
}

/** Guruhning sikllari. Sikl bo'lmasa (semestr kursi) — hech narsa chizilmaydi. */
export function CyclePassportList({ groupId }: { groupId: number }) {
  const q = useTeachCycles(groupId);
  const cycles = q.data ?? [];
  if (cycles.length === 0) return null;
  return (
    <div className="grid gap-2 md:grid-cols-2">
      {cycles.map((c) => (
        <CycleCard key={c.cycleId} c={c} />
      ))}
    </div>
  );
}
