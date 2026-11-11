// 화면에서 보낸 기록을 받는다 — POST /api/audit  { action, message, level?, resource?, resource_id?, details? }
// 열람(GET)은 없다. 기록은 Supabase 대시보드에서 본다.
import { NextResponse, type NextRequest } from "next/server";

import { denyAccess, getSignedInUser } from "@/lib/account/signed-in";
import { isScreenAction } from "@/lib/audit/actions";
import { writeAuditRow } from "@/lib/audit/server";
import { resolveClientIp } from "@/lib/login-rate-limit";

const MESSAGE_MAX_LENGTH = 500;
const RESOURCE_MAX_LENGTH = 200;
const DETAILS_MAX_BYTES = 8 * 1024;
// 요청 본문 전체의 상한. details 8KB 에 나머지 칸을 더해도 이 안에 든다.
const BODY_MAX_BYTES = 16 * 1024;

// 한 사람이 1분에 남길 수 있는 줄 수. 평소 쓰임(저장 한 번에 한 줄, 화면 오류는 한 화면에 20줄까지)
// 보다 넉넉하고, 되풀이 호출로 기록 표를 채우는 것은 막는다.
// 서버 인스턴스마다 따로 세는 간단한 장치다(인스턴스가 여럿이면 그만큼 느슨해진다).
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT_PER_WINDOW = 60;
const RATE_TRACKED_USERS_MAX = 500;
const recentWrites = new Map<string, number[]>();

function overRate(userId: string, now: number): boolean {
  const since = now - RATE_WINDOW_MS;
  const stamps = (recentWrites.get(userId) ?? []).filter((at) => at > since);
  if (stamps.length >= RATE_LIMIT_PER_WINDOW) {
    recentWrites.set(userId, stamps);
    return true;
  }
  stamps.push(now);
  // 방금 쓴 사람이 맨 뒤로 가도록 다시 넣고, 너무 많이 쌓이면 가장 오래된 사람부터 잊는다.
  recentWrites.delete(userId);
  recentWrites.set(userId, stamps);
  if (recentWrites.size > RATE_TRACKED_USERS_MAX) {
    const oldest = recentWrites.keys().next().value;
    if (oldest !== undefined) recentWrites.delete(oldest);
  }
  return false;
}

function refuse(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value ? value.slice(0, RESOURCE_MAX_LENGTH) : null;
}

export async function POST(request: NextRequest) {
  // 0) 크기 — 알려 온 길이가 상한을 넘으면 읽지도 않는다.
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > BODY_MAX_BYTES) {
    return refuse("요청이 너무 큽니다(16KB 이하).", 413);
  }

  // 1) 로그인 확인
  const signedIn = await getSignedInUser();
  if (signedIn.state !== "signed-in") return denyAccess(signedIn);
  const { user } = signedIn;

  // 2) 빈도 제한
  if (overRate(user.id, Date.now())) {
    return refuse("기록 요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.", 429);
  }

  // 3) 본문 — 길이를 알리지 않았거나 다르게 알린 요청도 실제 크기로 한 번 더 본다.
  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > BODY_MAX_BYTES) {
      return refuse("요청이 너무 큽니다(16KB 이하).", 413);
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return refuse("요청 형식이 올바르지 않습니다.");
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return refuse("요청 형식이 올바르지 않습니다.");
  }

  // 4) 필수 값. action 은 화면용 목록에 있는 이름만 받는다 — 로그인 실패(시도 제한의 재료)를
  //    비롯한 서버 기록 이름은 목록에 없으므로 화면에서 넣을 수 없다.
  const { action, message } = body;
  if (typeof action !== "string" || !action) return refuse("action 이 필요합니다.");
  if (typeof message !== "string" || !message.trim()) return refuse("message 가 필요합니다.");
  if (!isScreenAction(action)) return refuse("화면에서 남길 수 없는 기록입니다.");

  // 5) 길이 제한
  if (message.length > MESSAGE_MAX_LENGTH) {
    return refuse(`message 는 ${MESSAGE_MAX_LENGTH}자 이하여야 합니다.`);
  }
  let details: unknown = null;
  if (body.details !== undefined && body.details !== null) {
    const serialized = JSON.stringify(body.details);
    if (Buffer.byteLength(serialized, "utf8") > DETAILS_MAX_BYTES) {
      return refuse("details 가 너무 큽니다(8KB 이하).");
    }
    details = body.details;
  }

  // 6) level 은 ERROR 만 그대로, 행위자는 세션에서, IP 는 로그인 API 와 같은 규칙으로.
  const reason = await writeAuditRow({
    level: body.level === "ERROR" ? "ERROR" : "INFO",
    action,
    message,
    resource: optionalText(body.resource),
    resource_id: optionalText(body.resource_id),
    actor_id: user.id,
    actor_name: user.name,
    ip_address: resolveClientIp((name) => request.headers.get(name)),
    details,
  });

  if (reason) {
    console.error(`[api/audit] 기록 실패: ${reason}`);
    return refuse("기록하지 못했습니다.", 500);
  }
  return NextResponse.json({ success: true }, { status: 201 });
}
