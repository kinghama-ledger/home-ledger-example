// 프로필 변경 — POST /api/account/profile  { displayName, loginId }
import { NextResponse, type NextRequest } from "next/server";

import { denyAccess, getSignedInUser } from "@/lib/account/signed-in";
import { loginIdToAuthEmail } from "@/lib/auth-email";
import { serviceDb } from "@/lib/backend/service";
import { auditError, auditInfo } from "@/lib/audit/server";

const DISPLAY_NAME_MAX_LENGTH = 50;
const LOGIN_ID_MAX_LENGTH = 64;
// 영문·숫자와 . _ - 만. @ 를 받지 않으므로 임의의 이메일 주소로는 바꿀 수 없다.
const LOGIN_ID_PATTERN = /^[A-Za-z0-9._-]+$/;

function refuse(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

function isTakenEmail(error: { code?: string; status?: number; message: string }) {
  if (error.code === "email_exists") return true;
  return error.status === 422 && /already|registered|exists/i.test(error.message);
}

export async function POST(request: NextRequest) {
  let body: { displayName?: unknown; loginId?: unknown } | null;
  try {
    body = await request.json();
  } catch {
    return refuse("요청 형식이 올바르지 않습니다.");
  }

  // 1) 입력 확인
  const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : "";
  const loginId = typeof body?.loginId === "string" ? body.loginId.trim() : "";
  if (!displayName) return refuse("이름을 입력해 주세요.");
  if (displayName.length > DISPLAY_NAME_MAX_LENGTH) {
    return refuse(`이름은 ${DISPLAY_NAME_MAX_LENGTH}자 이하로 입력해 주세요.`);
  }
  if (!loginId) return refuse("로그인 ID를 입력해 주세요.");
  if (loginId.length > LOGIN_ID_MAX_LENGTH) {
    return refuse(`로그인 ID는 ${LOGIN_ID_MAX_LENGTH}자 이하로 입력해 주세요.`);
  }
  if (!LOGIN_ID_PATTERN.test(loginId)) {
    return refuse("로그인 ID는 영문, 숫자, 마침표(.), 밑줄(_), 붙임표(-)만 쓸 수 있습니다.");
  }

  try {
    // 2) 로그인 확인
    const signedIn = await getSignedInUser();
    if (signedIn.state !== "signed-in") return denyAccess(signedIn);
    const { user } = signedIn;
    const actor = { id: user.id, name: user.name };

    // 3) 이름과 (바뀌었다면) 로그인 이메일을 한 번에 바꾼다.
    const nextEmail = loginIdToAuthEmail(loginId).toLowerCase();
    const loginIdChanged = nextEmail !== user.email.toLowerCase();

    const { error } = await serviceDb().auth.admin.updateUserById(user.id, {
      user_metadata: { display_name: displayName },
      ...(loginIdChanged ? { email: nextEmail, email_confirm: true } : {}),
    });

    if (error) {
      if (loginIdChanged && isTakenEmail(error)) {
        auditError("PROFILE_UPDATE", "이미 있는 로그인 ID 라 변경 거부", {
          actor,
          details: { login_id: loginId },
        });
        return refuse("이미 사용 중인 로그인 ID입니다.", 409);
      }
      auditError("PROFILE_UPDATE", "프로필 변경 실패", {
        actor,
        details: { reason: error.message, status: error.status ?? null },
      });
      return refuse("정보를 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요.", 500);
    }

    // 4) 성공. loginIdChanged 가 true 면 화면이 "다음 로그인부터 새 ID" 라고 알린다.
    auditInfo("PROFILE_UPDATE", "프로필 변경", {
      actor: { ...actor, name: displayName },
      details: { login_id_changed: loginIdChanged },
    });
    return NextResponse.json({ success: true, loginIdChanged });
  } catch (error) {
    console.error("[account/profile]", error instanceof Error ? error.message : error);
    return refuse("서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.", 500);
  }
}
