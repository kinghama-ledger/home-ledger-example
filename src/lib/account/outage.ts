// "인증 서버 장애인가, 그냥 로그인이 안 된 것인가" 를 가르는 한곳.
// 장애로 판정되면 사용자를 내쫓지 않는다(요청 문지기·세션 지킴이·API 가 모두 이 함수만 본다).

const NETWORK_WORDS = [
  "fetch failed",
  "failed to fetch",
  "networkerror",
  "network request failed",
  "load failed",
  "timeout",
  "timed out",
  "econnrefused",
  "econnreset",
  "enotfound",
  "eai_again",
  "etimedout",
  "socket hang up",
];

const NETWORK_ERROR_NAMES = new Set(["AuthRetryableFetchError", "AbortError", "TimeoutError"]);

export function isAuthOutage(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { status, name, message } = error as {
    status?: unknown;
    name?: unknown;
    message?: unknown;
  };

  if (typeof status === "number") {
    // 0 = 응답 자체를 못 받음, 429 = 너무 잦은 요청, 500 이상 = 서버 쪽 문제
    if (status === 0 || status === 429 || status >= 500) return true;
  }
  if (typeof name === "string" && NETWORK_ERROR_NAMES.has(name)) return true;
  if (typeof message === "string") {
    const text = message.toLowerCase();
    return NETWORK_WORDS.some((word) => text.includes(word));
  }
  return false;
}
