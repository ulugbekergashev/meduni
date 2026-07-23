import { useTranslation } from "react-i18next";
import { CheckCircle2, Lightbulb, ListChecks, Pill, TriangleAlert } from "lucide-react";
import { Icon } from "@meduni/ui";
import type { DigestJson } from "../api";

function Section({
  icon,
  title,
  tone,
  children,
}: {
  icon: typeof ListChecks;
  title: string;
  tone: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2.5 flex items-center gap-2">
        <div className={`flex h-7 w-7 items-center justify-center rounded-full ${tone}`}>
          <Icon icon={icon} size={15} />
        </div>
        <h3 className="text-section font-bold text-ink">{title}</h3>
      </div>
      {children}
    </section>
  );
}

/** AI konspekt — o'qish uchun (tahrirsiz). Teacher DigestSection semantikasi. */
export function DigestView({ digest }: { digest: DigestJson }) {
  const { t } = useTranslation(undefined, { keyPrefix: "lesson" });

  return (
    <div className="space-y-4">
      {digest.objectives.length > 0 && (
        <Section icon={ListChecks} title={t("konspekt_objectives")} tone="bg-brand-soft text-brand-tint">
          <ol className="space-y-1.5">
            {digest.objectives.map((o, i) => (
              <li key={i} className="flex gap-2.5 text-body text-ink">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[12px] font-bold text-brand-tint">
                  {i + 1}
                </span>
                <span>{o}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {digest.concepts.length > 0 && (
        <Section icon={Lightbulb} title={t("konspekt_concepts")} tone="bg-blue-soft text-blue">
          <ul className="space-y-1.5">
            {digest.concepts.map((c, i) => (
              <li key={i} className="flex gap-2.5 text-body text-ink">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue" />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {digest.terms.length > 0 && (
        <Section icon={ListChecks} title={t("konspekt_terms")} tone="bg-violet-soft text-violet">
          {/* Desktop: 3 ustunli jadval; mobil: karta-stack */}
          <div className="hidden overflow-hidden rounded-card border border-line sm:block">
            <table className="w-full text-left text-body">
              <thead className="bg-surface-raised text-note font-bold uppercase tracking-wide text-ink-soft">
                <tr>
                  <th className="px-4 py-2">{t("konspekt_termRu")}</th>
                  <th className="px-4 py-2">{t("konspekt_termUz")}</th>
                  <th className="px-4 py-2">{t("konspekt_termLat")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {digest.terms.map((term, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2 font-semibold text-ink">{term.ru}</td>
                    <td className="px-4 py-2 text-ink">{term.uz}</td>
                    <td className="px-4 py-2 italic text-ink-soft">{term.lat}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 sm:hidden">
            {digest.terms.map((term, i) => (
              <div key={i} className="rounded-card border border-line p-3">
                <p className="text-body font-bold text-ink">{term.ru}</p>
                <p className="text-body text-ink">{term.uz}</p>
                <p className="text-note italic text-ink-soft">{term.lat}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {digest.facts.length > 0 && (
        <Section icon={CheckCircle2} title={t("konspekt_facts")} tone="bg-emerald-soft text-emerald">
          <ul className="space-y-1.5">
            {digest.facts.map((f, i) => (
              <li key={i} className="flex gap-2.5 text-body text-ink">
                <Icon icon={CheckCircle2} size={16} className="mt-0.5 shrink-0 text-emerald" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {digest.dosages.length > 0 && (
        <div className="rounded-card border border-amber-soft bg-amber-soft p-4">
          <div className="mb-2 flex items-center gap-2 text-amber">
            <Icon icon={Pill} size={16} />
            <h3 className="text-section font-bold">{t("konspekt_dosages")}</h3>
          </div>
          <ul className="space-y-1.5">
            {digest.dosages.map((dz, i) => (
              <li key={i} className="flex gap-2.5 text-body text-ink">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber" />
                <span>{dz}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex items-center gap-1.5 text-note text-amber">
            <Icon icon={TriangleAlert} size={13} />
            {t("konspekt_dosagesNote")}
          </p>
        </div>
      )}
    </div>
  );
}
