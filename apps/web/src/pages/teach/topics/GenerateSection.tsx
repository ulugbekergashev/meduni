import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Check, ClipboardList, Film, Presentation, Sparkles, Stethoscope } from "lucide-react";
import { Badge, Button, Card, Icon, Select, Spinner, useToast } from "@meduni/ui";
import { Field } from "../../../components/Field";
import { apiErrorMessage } from "../../../lib/api";
import { useLocale } from "../../../lib/useLocale";
import { useGenerateCase, useGenerateQuiz, type ContentSummary, type TopicDetail } from "./api";

function LangSelect({ value, onChange }: { value: "uz" | "ru"; onChange: (v: "uz" | "ru") => void }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value as "uz" | "ru")}>
      <option value="uz">O‘zbek</option>
      <option value="ru">Русский</option>
    </Select>
  );
}

function ReadyRow({ summary, onEdit }: { summary: ContentSummary; onEdit: () => void }) {
  const { t } = useTranslation(undefined, { keyPrefix: "generate" });
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-emerald">
        <Icon icon={Check} size={16} /> {t("ready")}
        {summary.editedByTeacher && (
          <Badge tone="slate">{t("edited")}</Badge>
        )}
      </span>
      <Button variant="soft" size="sm" onClick={onEdit}>
        {t("edit")}
      </Button>
    </div>
  );
}

function QuizCard({ topic }: { topic: TopicDetail }) {
  const { t } = useTranslation(undefined, { keyPrefix: "generate" });
  const locale = useLocale();
  const { show } = useToast();
  const navigate = useNavigate();
  const gen = useGenerateQuiz(topic.id);
  const existing = topic.content.find((c) => c.kind === "quiz");

  const [language, setLanguage] = useState<"uz" | "ru">(locale);
  const [questionCount, setQuestionCount] = useState("10");
  const [difficulty, setDifficulty] = useState("balanced");

  const run = () =>
    gen.mutate({ language, questionCount: Number(questionCount), difficulty }, { onSuccess: () => show(t("ready")) });

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-soft text-blue">
          <Icon icon={ClipboardList} size={18} />
        </div>
        <h3 className="text-section font-bold text-ink">{t("quizTitle")}</h3>
      </div>

      {gen.isPending ? (
        <div className="flex items-center gap-2 py-2 text-[13px] text-ink-soft">
          <Spinner size={16} /> {t("generatingQuiz")}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("questionCount")}>
              <Select value={questionCount} onChange={(e) => setQuestionCount(e.target.value)}>
                {["5", "10", "15", "20"].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("difficulty")}>
              <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                <option value="balanced">{t("difficultyBalanced")}</option>
                <option value="easy">{t("difficultyEasy")}</option>
                <option value="hard">{t("difficultyHard")}</option>
              </Select>
            </Field>
            <div className="col-span-2">
              <Field label={t("language")}>
                <LangSelect value={language} onChange={setLanguage} />
              </Field>
            </div>
          </div>
          {gen.isError && <p className="text-[13px] text-rose">{apiErrorMessage(gen.error, locale) ?? t("error")}</p>}
          <Button icon={<Icon icon={Sparkles} size={16} />} onClick={run}>
            {existing ? t("regenerate") : t("generateQuiz")}
          </Button>
        </>
      )}

      {existing && !gen.isPending && (
        <ReadyRow summary={existing} onEdit={() => navigate(`/teach/content/${existing.id}`)} />
      )}
    </Card>
  );
}

function CaseCard({ topic }: { topic: TopicDetail }) {
  const { t } = useTranslation(undefined, { keyPrefix: "generate" });
  const locale = useLocale();
  const navigate = useNavigate();
  const gen = useGenerateCase(topic.id);
  const existing = topic.content.find((c) => c.kind === "case");

  const [language, setLanguage] = useState<"uz" | "ru">(locale);
  const [format, setFormat] = useState<"SHORT" | "EXTENDED">("SHORT");

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-soft text-rose">
          <Icon icon={Stethoscope} size={18} />
        </div>
        <h3 className="text-section font-bold text-ink">{t("caseTitle")}</h3>
      </div>

      {gen.isPending ? (
        <div className="flex items-center gap-2 py-2 text-[13px] text-ink-soft">
          <Spinner size={16} /> {t("generatingCase")}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("format")}>
              <Select value={format} onChange={(e) => setFormat(e.target.value as "SHORT" | "EXTENDED")}>
                <option value="SHORT">{t("formatShort")}</option>
                <option value="EXTENDED">{t("formatExtended")}</option>
              </Select>
            </Field>
            <Field label={t("language")}>
              <LangSelect value={language} onChange={setLanguage} />
            </Field>
          </div>
          {gen.isError && <p className="text-[13px] text-rose">{apiErrorMessage(gen.error, locale) ?? t("error")}</p>}
          <Button icon={<Icon icon={Sparkles} size={16} />} onClick={() => gen.mutate({ language, format })}>
            {existing ? t("regenerate") : t("generateCase")}
          </Button>
        </>
      )}

      {existing && !gen.isPending && (
        <ReadyRow summary={existing} onEdit={() => navigate(`/teach/content/${existing.id}`)} />
      )}
    </Card>
  );
}

function SoonCard({ title, icon }: { title: string; icon: typeof Film }) {
  const { t } = useTranslation(undefined, { keyPrefix: "generate" });
  return (
    <Card className="flex flex-col gap-4 opacity-60">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-bg text-ink-faint">
          <Icon icon={icon} size={18} />
        </div>
        <h3 className="text-section font-bold text-ink-soft">{title}</h3>
      </div>
      <p className="text-[12.5px] text-ink-faint">{t("soon")}</p>
    </Card>
  );
}

export function GenerateSection({ topic }: { topic: TopicDetail }) {
  const { t } = useTranslation(undefined, { keyPrefix: "generate" });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <QuizCard topic={topic} />
      <CaseCard topic={topic} />
      <SoonCard title={t("presentationTitle")} icon={Presentation} />
      <SoonCard title={t("videoTitle")} icon={Film} />
    </div>
  );
}
