// 비밀번호 변경 — POST /api/account/password  { currentPassword, newPassword }
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { isAuthOutage } from "@/lib/account/outage";
import { denyAccess, getSignedInUser } from "@/lib/account/signed-in";
import { publicDbEnv } from "@/lib/backend/env";
import { requestDb } from "@/lib/backend/request";
import { serviceDb } from "@/lib/backend/service";
import { auditError, auditInfo, writeAuditRow } from "@/lib/audit/server";
import { PASSWORD_MAX_LENGTH, rateLimitWindowStart, shouldBlockLogin } from "@/lib/login-rate-limit";

const MIN_PASSWORD_LENGTH = 6;

// 현재 비밀번호를 틀릴 수 있는 횟수(로그인 API 와 같은 15분 창). 이 계정 하나에만 건다 —
// 이미 로그인한 사람의 요청이라 남이 계정을 잠그는 데 쓸 수 없다.
const WRONG_CURRENT_LIMIT = 5;
// 틀린 시도 기록에 붙이는 표시. 횟수를 셀 때 이 값으로 고른다(서버 오류 기록은 세지 않는다).
const WRONG_CURRENT_MARK = "current_password";

function refuse(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

// 현재 비밀번호가 맞는지 본다. 지금 세션(쿠키)을 건드리지 않도록
// 아무것도 저장하지 않는 임시 연결로 로그인해 본다.
async function checkCurrentPassword(email: string, password: string) {
  const { url, anonKey } = publicDbEnv();
  const probe = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error } = await probe.auth.signInWithPassword({ email, password });
  if (error) return isAuthOutage(error) ? ("outage" as const) : ("mismatch" as const);

  // 확인하느라 생긴 세션은 쓸 일이 없으니 바로 끝낸다. 실패해도 확인 결과는 그대로다.
  await probe.auth.signOut({ scope: "local" }).catch(() => null);
  return "match" as const;
}

// 최근 창 안에서 이 계정이 현재 비밀번호를 틀린 횟수. 못 세면 0(로그인 API 와 같은 방침:
// 기록 조회 장애가 본인의 비밀번호 변경을 막지 않게 하고, 대신 그 사실을 남긴다).
async function countWrongCurrent(userId: string): Promise<number> {
  try {
    const { count, error } = await serviceDb()
      .from("app_logs")
      .select("id", { count: "exact", head: true })
      .eq("action", "PASSWORD_CHANGE")
      .eq("level", "ERROR")
      .eq("resource", WRONG_CURRENT_MARK)
      .eq("actor_id", userId)
      .gte("created_at", rateLimitWindowStart(new Date()));
    if (error) throw error;
    return count ?? 0;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`[account/password] 시도 횟수 조회 실패(제한 없이 진행): ${reason}`);
    auditError("PASSWORD_RATE_CHECK_FAILED", "비밀번호 변경 시도 횟수 조회 실패 — 제한 없이 진행", {
      actor: { id: userId },
      details: { reason },
    });
    return 0;
  }
}

// 비밀번호를 바꾼 뒤 이 브라우저만 남기고 다른 기기의 로그인을 끊는다.
// 끊지 못해도 변경 자체는 끝났으므로 실패는 기록만 한다.
async function signOutOtherDevices(userId: string): Promise<void> {
  let reason: string | null = null;
  try {
    const db = await requestDb();
    const { data } = await db.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) {
      reason = "현재 세션 토큰 없음";
    } else {
      const { error } = await serviceDb().auth.admin.signOut(accessToken, "others");
      if (error) reason = error.message;
    }
  } catch (error) {
    reason = error instanceof Error ? error.message : String(error);
  }
  if (reason) {
    auditError("PASSWORD_CHANGE", "다른 기기 로그아웃 실패(비밀번호는 바뀜)", {
      actor: { id: userId },
      details: { reason },
    });
  }
}

export async function POST(request: NextRequest) {
  let body: { currentPassword?: unknown; newPassword?: unknown } | null;
  try {
    body = await request.json();
  } catch {
    return refuse("요청 형식이 올바르지 않습니다.");
  }

  // 1) 입력 확인
  const currentPassword = body?.currentPassword;
  const newPassword = body?.newPassword;
  if (
    typeof currentPassword !== "string" ||
    typeof newPassword !== "string" ||
    !currentPassword ||
    !newPassword
  ) {
    return refuse("현재 비밀번호와 새 비밀번호를 모두 입력해 주세요.");
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return refuse(`새 비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`);
  }
  // 로그인 API 가 받는 길이보다 길면 바꾼 뒤 로그인할 수 없게 된다.
  if (newPassword.length > PASSWORD_MAX_LENGTH) {
    return refuse(`새 비밀번호는 ${PASSWORD_MAX_LENGTH}자 이하여야 합니다.`);
  }
  // 확인용 로그인에 터무니없이 긴 값을 넘기지 않는다. 그런 비밀번호는 있을 수 없다.
  if (currentPassword.length > PASSWORD_MAX_LENGTH) {
    return refuse("현재 비밀번호가 올바르지 않습니다.");
  }

  try {
    // 2) 로그인 확인
    const signedIn = await getSignedInUser();
    if (signedIn.state !== "signed-in") return denyAccess(signedIn);
    const { user } = signedIn;
    const actor = { id: user.id, name: user.name };

    // 3) 시도 횟수 제한 — 로그인된 창을 잠깐 쓴 사람이 현재 비밀번호를 대입해 보는 것을 막는다.
    //    막힌 요청은 기록하지 않는다(막힌 기록이 다시 횟수를 늘리지 않게).
    //    한계: 세기와 기록이 한 묶음(원자)이 아니다 — 동시에 보낸 요청은 같은 횟수를 읽어 그 수만큼 제한을 넘겨 시도된다.
    if (shouldBlockLogin(await countWrongCurrent(user.id), WRONG_CURRENT_LIMIT)) {
      return refuse("비밀번호 확인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.", 429);
    }

    // 4) 현재 비밀번호 확인
    const check = await checkCurrentPassword(user.email, currentPassword);
    if (check === "outage") return denyAccess({ state: "outage" });
    if (check === "mismatch") {
      // 다음 요청이 이 줄을 세므로 응답보다 먼저 적는다.
      const writeFailure = await writeAuditRow({
        level: "ERROR",
        action: "PASSWORD_CHANGE",
        message: "현재 비밀번호 불일치로 변경 거부",
        resource: WRONG_CURRENT_MARK,
        actor_id: actor.id,
        actor_name: actor.name,
      });
      if (writeFailure) console.error(`[account/password] 틀린 시도 기록 실패: ${writeFailure}`);
      return refuse("현재 비밀번호가 올바르지 않습니다.");
    }

    // 5) 현재 비밀번호가 맞다는 것을 확인한 뒤에만 "같은 값인지" 를 알려 준다.
    //    같은 값으로 바꾸면 성공처럼 보이지만 실제로는 아무것도 바뀌지 않는다.
    if (newPassword === currentPassword) {
      auditError("PASSWORD_CHANGE", "새 비밀번호가 현재와 같아 변경 거부", { actor });
      return refuse("새 비밀번호가 현재 비밀번호와 같습니다. 다른 값을 입력해 주세요.");
    }

    // 6) 변경
    const { error } = await serviceDb().auth.admin.updateUserById(user.id, {
      password: newPassword,
    });
    if (error) {
      // 원문은 기록에만 남기고 화면에는 일반 문구만 보낸다.
      auditError("PASSWORD_CHANGE", "비밀번호 변경 실패", {
        actor,
        details: { reason: error.message, status: error.status ?? null },
      });
      return refuse("비밀번호를 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요.", 500);
    }

    // 7) 성공 — 옛 비밀번호로 열려 있던 다른 기기의 로그인은 끊는다.
    await signOutOtherDevices(user.id);
    auditInfo("PASSWORD_CHANGE", "비밀번호 변경", { actor });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[account/password]", error instanceof Error ? error.message : error);
    return refuse("서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.", 500);
  }
}
