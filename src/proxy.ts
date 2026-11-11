// 요청 문지기 — 화면 요청이 들어올 때마다 세션을 검증하고 갱신된 쿠키를 응답에 싣는다.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isAuthOutage } from "@/lib/account/outage";
import { publicDbEnv } from "@/lib/backend/env";
import {
  PRIVACY_COOKIE,
  PRIVACY_COOKIE_ON,
  PRIVACY_WRITE_BLOCKED_MESSAGE,
  asksPrivacy,
  isApiWrite,
  withoutPrivacyParam,
} from "@/lib/privacy/demo-link";

const LOGIN_PATH = "/login";
const HOME_PATH = "/dashboard";

export async function proxy(request: NextRequest) {
  const { pathname: path, searchParams } = request.nextUrl;
  const isApi = path.startsWith("/api/");

  // 가림 모드 ① 주소로 켜기 — `?mask=on` 이 붙은 화면 요청은 쿠키를 심고, 그 표시를 뗀 같은 주소로 다시 보낸다.
  //   그 뒤의 로그인·첫 화면 넘김은 쿠키만 보면 되므로 주소에 표시를 들고 다닐 필요가 없다.
  if (!isApi && asksPrivacy(searchParams)) {
    const clean = request.nextUrl.clone();
    clean.search = withoutPrivacyParam(searchParams).toString();
    const redirect = NextResponse.redirect(clean);
    redirect.cookies.set(PRIVACY_COOKIE, PRIVACY_COOKIE_ON, {
      path: "/",
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      httpOnly: false, // 화면의 끄기 버튼이 지울 수 있어야 한다
    });
    return redirect;
  }

  // 가림 모드 ② 쓰기 차단 — 가림 쿠키가 켜진 브라우저가 보낸 저장 요청은 받지 않는다.
  //   휴대폰이 토큰으로 보내는 수집 요청·로그인·기록은 예외다(demo-link.ts 의 isApiWrite).
  if (isApi && request.cookies.get(PRIVACY_COOKIE)?.value === PRIVACY_COOKIE_ON && isApiWrite(request.method, path)) {
    return NextResponse.json({ success: false, error: PRIVACY_WRITE_BLOCKED_MESSAGE }, { status: 403 });
  }

  const { url, anonKey } = publicDbEnv();
  let response = NextResponse.next({ request });

  const db = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(updated) {
        // 갱신된 쿠키를 뒤따르는 서버 코드(요청)와 브라우저(응답) 양쪽에 알린다.
        for (const { name, value } of updated) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of updated) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // 쿠키가 있다는 사실만으로 통과시키지 않는다. Supabase 가 검증한 사용자로만 판단한다.
  let signedIn = false;
  let outage = false;
  try {
    const { data, error } = await db.auth.getUser();
    signedIn = Boolean(data.user);
    outage = !signedIn && Boolean(error) && isAuthOutage(error);
  } catch (error) {
    if (!isAuthOutage(error)) throw error;
    outage = true;
  }

  const { pathname } = request.nextUrl;

  // API 는 쿠키 갱신만 한다. 각 API 가 스스로 401 을 낸다.
  if (pathname.startsWith("/api/")) return response;

  // 인증 서버 장애: 쓰던 사람을 내쫓지 않도록 막지 않고 통과시킨다.
  if (outage) return response;

  const onLogin = pathname === LOGIN_PATH;
  if (!signedIn && !onLogin) return moveTo(LOGIN_PATH, request, response);
  if (signedIn && onLogin) return moveTo(HOME_PATH, request, response);
  return response;
}

// 다른 주소로 보내되, 방금 갱신된 쿠키는 그대로 들고 간다.
function moveTo(path: string, request: NextRequest, carried: NextResponse) {
  const target = request.nextUrl.clone();
  target.pathname = path;
  target.search = "";
  const redirect = NextResponse.redirect(target);
  for (const cookie of carried.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

export const config = {
  matcher: [
    // 정적 파일·이미지 최적화·파비콘·매니페스트·robots·sitemap·그림 파일은 검사하지 않는다.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
