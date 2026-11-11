// 가림 모드의 켜짐 상태 — 화면(React)과 DB 연결(browser.ts)이 같은 값을 본다.
// 두 곳에 적는다:
//   · sessionStorage — 이 탭이 열려 있는 동안.
//   · 쿠키 — 새 탭과 서버(요청 문지기)가 알 수 있게. 브라우저를 닫으면 사라진다.
// 둘 중 하나라도 켜져 있으면 켜진 것으로 본다(가리는 쪽으로 기운다).
import { PRIVACY_COOKIE, PRIVACY_COOKIE_ON, cookieSaysPrivacy } from "./demo-link";

const STORAGE_KEY = "ledger:privacy-mode";

const listeners = new Set<() => void>();
// 저장소를 못 쓰는 브라우저(사생활 보호 창 등)에서도 탭 안에서는 동작하도록 메모리에도 둔다.
let memoryValue = false;

function readStorage(): boolean {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}

function readCookie(): boolean {
  try {
    return cookieSaysPrivacy(document.cookie);
  } catch {
    return false;
  }
}

function writeCookie(next: boolean) {
  try {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = next
      ? `${PRIVACY_COOKIE}=${PRIVACY_COOKIE_ON}; Path=/; SameSite=Lax${secure}`
      : `${PRIVACY_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
  } catch {
    // 쿠키를 못 쓰면 이 탭에서만 유지된다.
  }
}

/** 지금 가림 모드인가. 서버에서 부르면 늘 false 다. */
export function isPrivacyOn(): boolean {
  if (typeof window === "undefined") return false;
  return memoryValue || readStorage() || readCookie();
}

export function setPrivacyOn(next: boolean) {
  if (typeof window === "undefined") return;
  memoryValue = next;
  try {
    if (next) window.sessionStorage.setItem(STORAGE_KEY, "on");
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // 저장 실패는 무시한다 — 메모리 값과 쿠키로 계속 동작한다.
  }
  writeCookie(next);
  listeners.forEach((notify) => notify());
}

/**
 * 켜져 있는 탭이 쿠키를 다시 적는다. 다른 탭에서 꺼서 쿠키가 지워졌어도
 * 이 탭이 켜져 있는 동안에는 서버가 저장 요청을 계속 막게 한다. 꺼진 탭은 아무것도 하지 않는다.
 */
export function reassertPrivacyCookie() {
  if (typeof window === "undefined") return;
  if ((memoryValue || readStorage()) && !readCookie()) writeCookie(true);
}

export function subscribePrivacy(notify: () => void) {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}
