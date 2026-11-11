// 로그인 계정에서 화면에 쓸 값을 꺼낸다. 서버·브라우저 공용 순수 함수.

export const FALLBACK_DISPLAY_NAME = "관리자";

type AccountLike = {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

// 표시 이름: 계정 사용자 정보의 display_name. 비어 있으면 "관리자".
export function displayNameOf(account: AccountLike | null | undefined): string {
  const raw = account?.user_metadata?.display_name;
  const name = typeof raw === "string" ? raw.trim() : "";
  return name || FALLBACK_DISPLAY_NAME;
}

// 로그인 ID: 로그인 이메일의 @ 앞부분.
export function loginIdOf(account: AccountLike | null | undefined): string {
  const email = account?.email ?? "";
  const at = email.indexOf("@");
  return at === -1 ? email : email.slice(0, at);
}
