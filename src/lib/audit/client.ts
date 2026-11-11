// 화면(브라우저)에서 서버로 기록 한 줄을 보낸다.
// 기록은 부가 기능이다 — 결과를 기다리지 않고, 실패해도 화면 동작을 막지 않는다.
import type { ScreenAction } from "./actions";

export type ReportEventOptions = Partial<{
  level: "INFO" | "ERROR";
  resource: string;
  resource_id: string;
  details: Record<string, unknown>;
}>;

const AUDIT_URL = "/api/audit";

// action 은 `actions.ts` 의 목록에 있는 이름만 쓸 수 있다.
export function reportEvent(action: ScreenAction, message: string, options: ReportEventOptions = {}): void {
  if (typeof window === "undefined") return;

  try {
    const packet = new Blob([JSON.stringify({ action, message, ...options })], { type: "application/json" });
    // 비컨은 화면이 닫히거나 다른 주소로 넘어가는 중에도 끝까지 나간다(같은 사이트 쿠키도 함께 간다).
    if (typeof navigator.sendBeacon === "function" && navigator.sendBeacon(AUDIT_URL, packet)) return;
    // 비컨을 못 쓰거나 브라우저가 받아 주지 않으면 일반 요청으로 보낸다.
    void fetch(new Request(AUDIT_URL, { method: "POST", body: packet, keepalive: true })).catch(() => {});
  } catch {
    // 직렬화할 수 없는 값이 섞였거나 보낼 수단이 없는 환경 — 조용히 넘어간다.
  }
}
