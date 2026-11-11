"use client";

// 화면에서 처리되지 않은 오류만 서버 기록으로 보낸다.
// 클릭·페이지 이동은 기록하지 않는다.
import { useEffect } from "react";

import { reportEvent } from "@/lib/audit/client";

const MESSAGE_LIMIT = 300;
const STACK_LIMIT = 1500;
// 같은 오류가 이 시간 안에 다시 나면 보내지 않는다(되풀이 렌더로 쏟아지는 것 방지).
const REPEAT_WINDOW_MS = 30_000;
// 한 번 화면을 연 동안 보내는 총량의 상한.
const MAX_REPORTS_PER_LOAD = 20;

type Failure = { kind: "error" | "promise"; text: string; stack: string | null };

function describe(reason: unknown): { text: string; stack: string | null } {
  if (reason instanceof Error) {
    return { text: reason.message || reason.name, stack: reason.stack ?? null };
  }
  if (typeof reason === "string") return { text: reason, stack: null };
  try {
    return { text: JSON.stringify(reason) ?? String(reason), stack: null };
  } catch {
    return { text: String(reason), stack: null };
  }
}

export function ClientErrorReporter() {
  useEffect(() => {
    const lastSentAt = new Map<string, number>();
    let sentCount = 0;

    const send = ({ kind, text, stack }: Failure) => {
      const message = (text || "알 수 없는 오류").slice(0, MESSAGE_LIMIT);
      const signature = `${kind}:${message}`;
      const now = Date.now();
      const previous = lastSentAt.get(signature);
      if (previous !== undefined && now - previous < REPEAT_WINDOW_MS) return;
      if (sentCount >= MAX_REPORTS_PER_LOAD) return;

      lastSentAt.set(signature, now);
      sentCount += 1;
      reportEvent("CLIENT_ERROR", message, {
        level: "ERROR",
        resource: "screen",
        details: {
          kind,
          path: window.location.pathname,
          stack: stack ? stack.slice(0, STACK_LIMIT) : null,
        },
      });
    };

    const onError = (event: ErrorEvent) => {
      const found = describe(event.error ?? event.message);
      send({ kind: "error", text: found.text || event.message, stack: found.stack });
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      send({ kind: "promise", ...describe(event.reason) });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
