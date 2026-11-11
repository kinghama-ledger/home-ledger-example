"use client";

// 화면 블록 — 가계부 화면들이 공통으로 쓰는 바깥 상자·카드·숫자 카드·안내.
import type { ComponentProps, ReactNode } from "react";
import { LoaderCircle, TriangleAlert, type LucideIcon } from "lucide-react";

import { usePrivacyMode } from "@/components/privacy/privacy-mode";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { MaskKind } from "@/lib/privacy/mask";
import { cn } from "@/lib/utils";

// ── 화면 바깥 상자 ─────────────────────────────────────────────────────────
export function Screen({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("space-y-4 md:space-y-5", className)}>{children}</div>;
}

// ── 흰 카드 ────────────────────────────────────────────────────────────────
// 안에 든 것을 위에서 아래로 그대로 쌓는다(간격은 안쪽 내용이 정한다).
export function Panel({ className, ...props }: ComponentProps<typeof Card>) {
  return <Card className={cn("block p-4 md:p-6", className)} {...props} />;
}

export function PanelTitle({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-4 gap-y-2", className)}>
      <div className="min-w-0 space-y-0.5">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description ? <p className="hidden text-sm text-muted-foreground md:block">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

// ── 숫자 카드 ──────────────────────────────────────────────────────────────
const GRID_COLUMNS = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-2 lg:grid-cols-4",
  5: "grid-cols-2 md:grid-cols-3 xl:grid-cols-5",
} as const;

export function FigureGrid({
  columns = 4,
  className,
  children,
}: {
  columns?: keyof typeof GRID_COLUMNS;
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("grid gap-2 md:gap-4", GRID_COLUMNS[columns], className)}>{children}</div>;
}

export type FigureTone = "default" | "info" | "positive" | "warning" | "danger";

const TONE_TEXT: Record<FigureTone, string> = {
  default: "text-foreground",
  info: "text-foreground",
  positive: "text-primary",
  warning: "text-amber-600 dark:text-amber-400",
  danger: "text-red-600 dark:text-red-400",
};

export function FigureCard({
  label,
  value,
  mobileValue,
  icon: Icon,
  tone = "default",
  sensitive,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  // 좁은 화면에서 value 대신 보여 줄 짧은 값(만원 단위 등).
  mobileValue?: ReactNode;
  icon?: LucideIcon;
  tone?: FigureTone;
  // 가림 종류. 주어지면 글자·숫자 값은 가림 모드를 따른다.
  sensitive?: MaskKind;
  className?: string;
}) {
  const { mask } = usePrivacyMode();
  const shown = (content: ReactNode): ReactNode =>
    sensitive && (typeof content === "string" || typeof content === "number")
      ? mask(sensitive, content)
      : content;
  const hasMobile = mobileValue !== undefined && mobileValue !== null;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border bg-card px-3 py-3 shadow-sm md:px-4 md:py-4",
        tone === "danger" && "border-red-300 ring-1 ring-red-200 dark:border-red-500/50 dark:ring-red-500/20",
        className
      )}
    >
      {/* 값 글자는 이 칸의 폭(cqw)에 맞춰 줄어든다 — 긴 금액의 "원" 이 다음 줄로 밀리지 않게. */}
      <div className="@container min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground md:text-sm">{label}</p>
        <p
          className={cn(
            "mt-1 break-keep text-[clamp(0.7rem,13cqw,1.5rem)] font-bold leading-tight tabular-nums",
            TONE_TEXT[tone]
          )}
        >
          {hasMobile ? (
            <>
              <span className="md:hidden">{shown(mobileValue)}</span>
              <span className="hidden md:inline">{shown(value)}</span>
            </>
          ) : (
            shown(value)
          )}
        </p>
      </div>
      {Icon ? (
        <span
          aria-hidden="true"
          className="hidden size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground md:flex"
        >
          <Icon className="size-4" />
        </span>
      ) : null}
    </div>
  );
}

// ── 안내 ───────────────────────────────────────────────────────────────────
export function LoadingNotice({ label = "불러오는 중입니다." }: { label?: string }) {
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-muted-foreground">
      <LoaderCircle className="size-6 animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function FailureNotice({
  title = "데이터를 불러오지 못했습니다.",
  description,
  action,
  onRetry,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <TriangleAlert className="size-7 text-red-600 dark:text-red-400" aria-hidden="true" />
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action || onRetry ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {onRetry ? (
            <Button type="button" variant="outline" onClick={onRetry}>
              다시 시도
            </Button>
          ) : null}
          {action}
        </div>
      ) : null}
    </div>
  );
}
