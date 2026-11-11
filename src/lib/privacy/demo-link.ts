// 가림(마스킹) 모드의 규칙 모음 — 주소로 켜기, 켜진 동안 막을 요청과 화면.
// 여기 있는 것은 전부 입력만 보고 답하는 함수라 서버·브라우저·시험 어디서나 쓴다.
//
// 흐름: `…/dashboard?mask=on` 으로 들어오면 요청 문지기(src/proxy.ts)가 쿠키를 심고 주소에서 mask 를 뗀다.
//       브라우저는 그 쿠키를 보고 가림 모드로 시작한다(src/lib/privacy/mode-store.ts).
//       켜져 있는 동안에는 저장 요청을 보내지 않고, 가리지 못하는 화면은 안내문으로 바꾼다.

/** 주소에 붙이는 이름. `?mask=on` */
export const PRIVACY_PARAM = "mask";
/** 가림 모드가 켜져 있음을 서버와 다른 탭에 알리는 쿠키. 브라우저를 닫으면 사라진다. */
export const PRIVACY_COOKIE = "ledger-privacy";
export const PRIVACY_COOKIE_ON = "on";

/** 가림 모드에서 저장을 막았을 때 화면에 보이는 말. */
export const PRIVACY_WRITE_BLOCKED_MESSAGE =
  "마스킹 모드에서는 저장하지 않습니다. 왼쪽 아래 '마스킹 ON' 버튼(Ctrl/⌘ + Shift + M)으로 끄고 다시 해 주세요.";

/** 가림 모드로 시작했을 때 처음 보여 줄 화면(금액이 전부 가려지는 현금흐름). */
export const PRIVACY_LANDING_PATH = "/dashboard/household/cash";

function toParams(search: string | URLSearchParams): URLSearchParams {
  return typeof search === "string" ? new URLSearchParams(search) : search;
}

/**
 * 주소가 가림 모드를 켜라고 하는가. 이름·값의 대소문자와 앞뒤 공백은 따지지 않는다.
 * 켜는 길만 있다 — `mask=off` 같은 값은 모른 척한다(주소 하나로 가림이 풀리면 안 된다).
 */
export function asksPrivacy(search: string | URLSearchParams): boolean {
  for (const [key, value] of toParams(search)) {
    if (key.trim().toLowerCase() === PRIVACY_PARAM && value.trim().toLowerCase() === "on") return true;
  }
  return false;
}

/** 쿼리에서 켜기 표시(mask=on)만 떼어 낸다. 다른 쿼리와 `mask=off` 같은 모르는 값은 그대로 둔다. */
export function withoutPrivacyParam(search: string | URLSearchParams): URLSearchParams {
  const kept = new URLSearchParams();
  for (const [key, value] of toParams(search)) {
    const isSwitch = key.trim().toLowerCase() === PRIVACY_PARAM && value.trim().toLowerCase() === "on";
    if (!isSwitch) kept.append(key, value);
  }
  return kept;
}

/** `document.cookie` 나 Cookie 헤더 글자열에 가림 쿠키가 켜져 있는가. */
export function cookieSaysPrivacy(cookieText: string | null | undefined): boolean {
  if (!cookieText) return false;
  return cookieText.split(";").some((part) => {
    const at = part.indexOf("=");
    if (at < 0) return false;
    return part.slice(0, at).trim() === PRIVACY_COOKIE && part.slice(at + 1).trim() === PRIVACY_COOKIE_ON;
  });
}

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * 브라우저가 DB(Supabase)로 보내는 요청 가운데 **자료를 바꾸는 것**인가.
 * 표 쓰기(POST·PATCH·PUT·DELETE)와 함수 호출(rpc — 이 앱의 브라우저 쪽 rpc 는 전부 확정·되돌리기 같은 쓰기다),
 * 파일 올리기가 해당한다. 로그인·토큰 갱신·로그아웃(/auth/v1/)은 자료를 바꾸지 않으므로 막지 않는다.
 */
export function isDbWrite(method: string | null | undefined, url: string): boolean {
  if (READ_METHODS.has((method ?? "GET").toUpperCase())) return false;
  let path: string;
  try {
    path = new URL(url, "http://local.invalid").pathname;
  } catch {
    return false;
  }
  return path.includes("/rest/v1/") || path.includes("/storage/v1/");
}

// 가림 모드에서도 받아야 하는 API. 그 밖의 `/api/` 쓰기 요청은 막는다(새 API 는 기본이 '막음').
//   로그인 — 가림 모드로 로그인 화면에 온 사람이 들어올 수 있어야 한다.
//   기록 — 화면 오류·접속 기록은 가계부 자료가 아니다.
//   수집 — 휴대폰이 토큰으로 보내는 문자·알림. 화면을 가리고 있다고 수집이 빠지면 안 된다.
const API_WRITES_ALLOWED = new Set([
  "/api/auth/login",
  "/api/audit",
  "/api/household/inbox",
  "/api/household/inbox/sms",
  "/api/household/sms",
]);

// 조회 메서드(GET)로 부르지만 자료를 바꾸는 API. 주소가 정확히 같을 때만 쓰기로 친다.
//   원문 정리 — 예약 실행이 GET 으로 부르는데, 보존기간이 지난 수집함 원문을 지운다.
//   예약 실행에는 가림 쿠키가 없으므로 정해진 시각의 정리는 그대로 돈다.
// GET 으로 자료를 바꾸는 API 를 새로 만들면 여기에 적는다.
const API_READS_THAT_WRITE = new Set(["/api/household/inbox/purge-raw"]);

/** 요청 문지기용: 가림 쿠키가 켜진 브라우저의 이 API 요청을 막아야 하는가(쿠키 확인은 호출하는 쪽이 한다). */
export function isApiWrite(method: string | null | undefined, pathname: string): boolean {
  if (!pathname.startsWith("/api/")) return false;
  const path = pathname.replace(/\/+$/, "");
  if (API_READS_THAT_WRITE.has(path)) return true;
  if (READ_METHODS.has((method ?? "GET").toUpperCase())) return false;
  return !API_WRITES_ALLOWED.has(path);
}

// 금액·상호를 가리지 않고 그대로 보여 주는 화면. 가림 모드에서는 내용 대신 안내문을 보인다.
//   수집함 — 문자 원문·금액·가맹점이 그대로 나온다.
//   시스템개선·설치 안내 — 가림 처리를 하지 않은 화면이다.
//   새로 쓰기·고치기 — 입력칸에 실제 값이 채워지고, 가림 중에는 어차피 저장하지 않는다.
const UNMASKED_SCREENS = [
  "/dashboard/household/inbox",
  "/dashboard/household/system",
  "/dashboard/household/claude-setup",
];

/** 가림 모드에서 보여 주면 안 되는 화면인가. */
export function isUnmaskedScreen(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "");
  if (UNMASKED_SCREENS.some((base) => path === base || path.startsWith(`${base}/`))) return true;
  return path.startsWith("/dashboard/") && /\/(?:new|edit)$/.test(path);
}
