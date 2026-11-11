"use client";

// 화면이 그리다 실패했을 때 대신 보이는 안내. 오류 문구는 개발 중에만 보여 준다.
import { Button } from "@/components/ui/button";

const IN_DEVELOPMENT = process.env.NODE_ENV === "development";

export function CrashNotice({ problem, onRetry }: { problem: unknown; onRetry: () => void }) {
  const detail = IN_DEVELOPMENT && problem instanceof Error ? problem.message : "";

  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <h2 className="text-lg font-semibold text-foreground">문제가 발생했습니다</h2>
      {detail && (
        <p className="max-w-xl whitespace-pre-wrap break-words rounded-md bg-muted px-3 py-2 text-left font-mono text-xs text-muted-foreground">
          {detail}
        </p>
      )}
      <Button type="button" onClick={onRetry}>
        다시 시도
      </Button>
    </div>
  );
}
