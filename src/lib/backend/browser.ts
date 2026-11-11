// 브라우저용 Supabase 연결.
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { PRIVACY_WRITE_BLOCKED_MESSAGE, isDbWrite } from "@/lib/privacy/demo-link";
import { isPrivacyOn, setPrivacyOn } from "@/lib/privacy/mode-store";

import { publicDbEnv, readPublicDbEnv } from "./env";

// 한 탭에서는 연결을 하나만 만들어 계속 돌려쓴다.
// 여러 개가 생기면 토큰 갱신이 서로 끝나기를 기다려 화면 로딩이 길어진다.
let tabClient: SupabaseClient | undefined;

// 가림 모드가 켜져 있으면 자료를 바꾸는 요청을 보내지 않고 거절 응답을 대신 돌려준다.
// 화면마다 따로 막지 않아도 되도록 연결 한곳에서 막는다 — 화면은 평소의 "저장 실패" 안내로 이 말을 보여 준다.
// 읽기와 로그인·토큰 갱신·로그아웃은 그대로 지나간다(src/lib/privacy/demo-link.ts 의 isDbWrite).
const guardedFetch: typeof fetch = (input, init) => {
  const method = init?.method ?? (input instanceof Request ? input.method : "GET");
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (isPrivacyOn() && isDbWrite(method, url)) {
    const body = JSON.stringify({ code: "PRIVACY_MODE", message: PRIVACY_WRITE_BLOCKED_MESSAGE, details: null, hint: null });
    return Promise.resolve(new Response(body, { status: 403, headers: { "content-type": "application/json" } }));
  }
  return fetch(input, init);
};

function connect(): SupabaseClient {
  const { url, anonKey } = publicDbEnv();
  return createBrowserClient(url, anonKey, { global: { fetch: guardedFetch } });
}

// 접속 값 없이 서버에서 미리 그릴 때 쓰는 대역.
// 화면 컴포넌트는 그리는 동안 연결을 "만들기만" 하고 실제 조회는 브라우저에서 한다.
// 그래서 만들 때는 넘어가고, 정말 쓰려는 순간에 안내 오류를 낸다.
function unusableOnServer(): SupabaseClient {
  return new Proxy({} as SupabaseClient, {
    get(_target, key) {
      if (typeof key === "symbol" || key === "then") return undefined;
      publicDbEnv(); // 값이 없으므로 여기서 안내 오류를 던진다
      return undefined;
    },
  });
}

export function browserDb(): SupabaseClient {
  if (typeof window === "undefined") {
    // 서버 렌더 중에는 요청끼리 섞이지 않게 매번 새로 만든다.
    return readPublicDbEnv() ? connect() : unusableOnServer();
  }
  tabClient ??= connect();
  return tabClient;
}

// 이 브라우저에서 로그아웃한다. 실패하면 Supabase 가 준 오류를 그대로 던진다.
export async function signOutHere(): Promise<void> {
  try {
    const { error } = await browserDb().auth.signOut();
    if (error) throw error;
  } finally {
    // 다음 사람이 가림 모드가 켜진 채로 시작하지 않게 끈다(로그아웃이 실패해도).
    setPrivacyOn(false);
  }
}
