import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle } from "lucide-react";
import { Button, Card, EmptyState, Icon } from "@meduni/ui";

interface AsyncSectionProps {
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  emptyIcon?: ReactNode;
  emptyText: string;
  onRetry: () => void;
  children: ReactNode;
}

function SkeletonRows() {
  return (
    <Card>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="h-4 w-1/3 animate-pulse rounded bg-line" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-line" />
            <div className="ml-auto h-4 w-16 animate-pulse rounded bg-line" />
          </div>
        ))}
      </div>
    </Card>
  );
}

export function AsyncSection({
  isLoading,
  isError,
  isEmpty,
  emptyIcon,
  emptyText,
  onRetry,
  children,
}: AsyncSectionProps) {
  const { t } = useTranslation(undefined, { keyPrefix: "common" });

  if (isLoading) return <SkeletonRows />;

  if (isError) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-soft text-rose">
            <Icon icon={AlertCircle} size={22} />
          </div>
          <p className="text-[14.5px] text-ink-soft">{t("loadError")}</p>
          <Button variant="ghost" size="sm" onClick={onRetry}>
            {t("retry")}
          </Button>
        </div>
      </Card>
    );
  }

  if (isEmpty) return <EmptyState icon={emptyIcon} text={emptyText} />;

  return <>{children}</>;
}
