import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Check, ClipboardList, Film, Presentation, Sparkles, Stethoscope } from "lucide-react";
import { Badge, Button, Card, Icon, Select, Spinner, useToast } from "@meduni/ui";
import { Field } from "../../../components/Field";
import { apiErrorMessage } from "../../../lib/api";
import { useLocale } from "../../../lib/useLocale";
import {
  useContent,
  useGenerateCase,
  useGeneratePresentation,
  useGenerateQuiz,
  useGenerateVideo,
  type ContentSummary,
  type TopicDetail,
} from "./api";

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

function PresentationCard({ topic }: { topic: TopicDetail }) {
  const { t } = useTranslation(undefined, { keyPrefix: "generate" });
  const locale = useLocale();
  const { show } = useToast();
  const navigate = useNavigate();
  const gen = useGeneratePresentation(topic.id);
  const existing = topic.content.find((c) => c.kind === "presentation");

  const [language, setLanguage] = useState<"uz" | "ru">(locale);

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-soft text-violet">
          <Icon icon={Presentation} size={18} />
        </div>
        <h3 className="text-section font-bold text-ink">{t("presentationTitle")}</h3>
      </div>

      {gen.isPending ? (
        <div className="flex items-center gap-2 py-2 text-[13px] text-ink-soft">
          <Spinner size={16} /> {t("generatingSlides")}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("template")}>
              <Select disabled>
                <option>{t("templateDefault")}</option>
              </Select>
            </Field>
            <Field label={t("language")}>
              <LangSelect value={language} onChange={setLanguage} />
            </Field>
          </div>
          <p className="text-[12px] text-ink-faint">{t("imagesNote")}</p>
          {gen.isError && <p className="text-[13px] text-rose">{apiErrorMessage(gen.error, locale) ?? t("error")}</p>}
          <Button
            icon={<Icon icon={Sparkles} size={16} />}
            onClick={() => gen.mutate({ language }, { onSuccess: () => show(t("ready")) })}
          >
            {existing ? t("regenerate") : t("generatePresentation")}
          </Button>
        </>
      )}

      {existing && !gen.isPending && (
        <ReadyRow summary={existing} onEdit={() => navigate(`/teach/content/${existing.id}`)} />
      )}
    </Card>
  );
}

function VideoStages({ status }: { status: string }) {
  const { t } = useTranslation(undefined, { keyPrefix: "generate.vStep" });
  const order = ["script", "tts", "render"];
  const idx = order.indexOf(status);
  return (
    <div className="space-y-1.5">
      {order.map((step, i) => {
        const done = idx > i;
        const active = status === step;
        return (
          <div key={step} className="flex items-center gap-2 text-[13px]">
            {done ? (
              <Icon icon={Check} size={15} className="text-emerald" />
            ) : active ? (
              <Spinner size={13} />
            ) : (
              <span className="h-[13px] w-[13px] rounded-full border border-line" />
            )}
            <span className={done ? "text-emerald" : active ? "text-ink" : "text-ink-faint"}>{t(step)}</span>
          </div>
        );
      })}
    </div>
  );
}

function VideoCard({ topic }: { topic: TopicDetail }) {
  const { t } = useTranslation(undefined, { keyPrefix: "generate" });
  const locale = useLocale();
  const { show } = useToast();
  const navigate = useNavigate();
  const gen = useGenerateVideo(topic.id);
  const summary = topic.content.find((c) => c.kind === "video");

  const [language, setLanguage] = useState<"uz" | "ru">(locale);
  const [voice, setVoice] = useState<"male" | "female">("female");

  // When a video exists, watch its build status.
  const detail = useContent(summary?.id ?? 0);
  const video = summary ? detail.data?.video : null;
  const building = video && ["pending", "script", "tts", "render"].includes(video.buildStatus);
  const errored = video?.buildStatus === "error";

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-soft text-blue">
          <Icon icon={Film} size={18} />
        </div>
        <h3 className="text-section font-bold text-ink">{t("videoTitle")}</h3>
      </div>

      {building ? (
        <VideoStages status={video!.buildStatus} />
      ) : (
        <>
          {!summary && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("voice")}>
                  <Select value={voice} onChange={(e) => setVoice(e.target.value as "male" | "female")}>
                    <option value="female">{t("voiceFemale")}</option>
                    <option value="male">{t("voiceMale")}</option>
                  </Select>
                </Field>
                <Field label={t("language")}>
                  <LangSelect value={language} onChange={setLanguage} />
                </Field>
              </div>
              <p className="text-[12px] text-ink-faint">{t("videoNote")}</p>
            </>
          )}
          {(gen.isError || errored) && (
            <p className="text-[13px] text-rose">
              {errored ? t("vError", { stage: video!.errorStage ?? "" }) : apiErrorMessage(gen.error, locale) ?? t("error")}
            </p>
          )}
          {!summary || errored ? (
            <Button
              icon={<Icon icon={Sparkles} size={16} />}
              onClick={() => gen.mutate({ language, voice }, { onSuccess: () => show(t("ready")) })}
              disabled={gen.isPending}
            >
              {errored ? t("regenerate") : t("generateVideo")}
            </Button>
          ) : (
            <ReadyRow summary={summary} onEdit={() => navigate(`/teach/content/${summary.id}`)} />
          )}
        </>
      )}
    </Card>
  );
}

export function GenerateSection({ topic }: { topic: TopicDetail }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <QuizCard topic={topic} />
      <CaseCard topic={topic} />
      <PresentationCard topic={topic} />
      <VideoCard topic={topic} />
    </div>
  );
}
