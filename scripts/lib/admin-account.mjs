// 관리자 계정 스크립트들이 함께 쓰는 규칙. 앱(src/app/api/account/profile, src/lib/auth-email.ts)과 같게 둔다.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export const DEFAULT_ADMIN_ID = "admin";
export const LOGIN_ID_RULE = /^[A-Za-z0-9._-]{1,64}$/;
export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 200;

// 문제가 있으면 사유(글자), 없으면 null.
export function loginIdProblem(loginId) {
  if (!loginId) return "로그인 ID는 비워 둘 수 없습니다.";
  if (loginId.includes("@")) {
    return "로그인 ID에는 @ 를 쓸 수 없습니다. 이메일이 아니라 ID만 적어 주세요(예: admin).";
  }
  if (!LOGIN_ID_RULE.test(loginId)) {
    return "로그인 ID는 영문, 숫자, 마침표(.), 밑줄(_), 붙임표(-)만 쓸 수 있고 64자까지입니다.";
  }
  return null;
}

export function passwordProblem(password) {
  if (password.length < PASSWORD_MIN) return `비밀번호는 ${PASSWORD_MIN}자 이상이어야 합니다.`;
  if (password.length > PASSWORD_MAX) return `비밀번호는 ${PASSWORD_MAX}자 이하여야 합니다.`;
  return null;
}

// 로그인 ID → Supabase 계정 이메일. 앱의 loginIdToAuthEmail 과 같은 결과를 낸다.
export function accountEmail(loginId, env = process.env) {
  const id = loginId.trim();
  if (id.includes("@")) return id;
  const host = env.NEXT_PUBLIC_AUTH_EMAIL_DOMAIN?.trim() || "example.com";
  return [id, host].join("@");
}

// 마지막으로 만든 관리자 ID 를 적어 두는 작은 파일. 비밀이 아니고 git 에는 올리지 않는다.
// 개발 서버를 켤 때 안내(dev-banner)가 이 값을 읽는다.
const NOTE_FILE = ".admin-login-id";

function notePath() {
  return resolve(process.cwd(), NOTE_FILE);
}

export function rememberAdminId(loginId) {
  try {
    writeFileSync(notePath(), `${loginId}\n`, "utf8");
    return true;
  } catch {
    return false;
  }
}

export function recallAdminId() {
  try {
    if (!existsSync(notePath())) return null;
    const noted = readFileSync(notePath(), "utf8").trim();
    return loginIdProblem(noted) ? null : noted;
  } catch {
    return null;
  }
}
