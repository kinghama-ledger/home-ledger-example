// 서버에서 남기는 기록 — `app_logs` 표에 한 줄씩 쓴다(서비스 키 전용 표).
// 서버 전용이다. 브라우저 코드가 import 하면 빌드가 멈춘다.
import "server-only";

import { headers } from "next/headers";
import { after } from "next/server";

import { serviceDb } from "@/lib/backend/service";
import { resolveClientIp } from "@/lib/login-rate-limit";

export type AuditLevel = "INFO" | "ERROR";

export type AuditActor = { id?: string | null; name?: string | null };

export type AuditOptions = {
  actor?: AuditActor;
  resource?: string;
  resource_id?: string;
  details?: Record<string, unknown>;
};

export type AuditRow = {
  level: AuditLevel;
  action: string;
  message: string;
  resource?: string | null;
  resource_id?: string | null;
  actor_id?: string | null;
  actor_name?: string | null;
  ip_address?: string | null;
  details?: unknown;
};

// 한 줄 쓰기. 던지지 않고 실패 사유(없으면 null)를 돌려준다.
export async function writeAuditRow(row: AuditRow): Promise<string | null> {
  try {
    const { error } = await serviceDb().from("app_logs").insert({
      level: row.level,
      action: row.action,
      message: row.message,
      resource: row.resource ?? null,
      resource_id: row.resource_id ?? null,
      actor_id: row.actor_id ?? null,
      actor_name: row.actor_name ?? null,
      ip_address: row.ip_address ?? null,
      details: row.details ?? null,
    });
    return error ? error.message : null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

// 요청 안이면 그 요청의 IP 를, 요청 밖(스크립트)이면 null 을 준다.
// 부르는 즉시 headers() 를 잡아 둔다 — 응답이 나간 뒤에 읽으려 하면 늦다.
function captureClientIp(): Promise<string | null> {
  try {
    return headers().then(
      (list) => resolveClientIp((name) => list.get(name)),
      () => null
    );
  } catch {
    return Promise.resolve(null);
  }
}

function record(level: AuditLevel, action: string, message: string, options: AuditOptions) {
  const ipPromise = captureClientIp();

  const task = async () => {
    const reason = await writeAuditRow({
      level,
      action,
      message,
      resource: options.resource,
      resource_id: options.resource_id,
      actor_id: options.actor?.id,
      actor_name: options.actor?.name,
      ip_address: await ipPromise,
      details: options.details,
    });
    // 기록 실패가 본래 작업을 죽이지 않는다. 대신 서버 콘솔에는 남긴다.
    if (reason) console.error(`[audit] ${action} 기록 실패: ${reason}`);
  };

  try {
    // 응답을 보낸 뒤에도 기록이 끝나도록 Next 에 맡긴다.
    after(task);
  } catch {
    // 요청 밖(스크립트 등)에서는 after() 를 쓸 수 없다 — 바로 실행한다.
    void task();
  }
}

// 호출부는 기다리지 않아도 된다(반환값 없음).
export function auditInfo(action: string, message: string, options: AuditOptions = {}): void {
  record("INFO", action, message, options);
}

export function auditError(action: string, message: string, options: AuditOptions = {}): void {
  record("ERROR", action, message, options);
}
