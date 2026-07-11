import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, Spinner } from "@meduni/ui";
import { useContent } from "../topics/api";
import { QuizEditor } from "./QuizEditor";
import { CaseEditor } from "./CaseEditor";
import { PresentationEditor } from "./PresentationEditor";

export function ContentEditor() {
  const { id } = useParams();
  const { t } = useTranslation(undefined, { keyPrefix: "common" });
  const content = useContent(Number(id));

  if (content.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner size={28} />
      </div>
    );
  }
  if (content.isError || !content.data) {
    return (
      <Card className="mt-4">
        <p className="py-6 text-center text-[13.5px] text-rose">{t("loadError")}</p>
      </Card>
    );
  }

  const c = content.data;
  if (c.kind === "quiz" && c.quiz) return <QuizEditor content={c} />;
  if (c.kind === "case" && c.clinicalCase) return <CaseEditor content={c} />;
  if (c.kind === "presentation" && c.presentation) return <PresentationEditor content={c} />;
  return null;
}
