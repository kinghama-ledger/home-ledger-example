// 가림(마스킹) 모드 규칙 검증 — 주소로 켜기(?mask=on), 쓰기 차단, 가리지 못하는 화면 목록. (설계 223)
//
// 실행: npm run test:privacy-link   (DB·브라우저 불필요 — 순수 함수 + 화면 파일 정적 검사)
import { strict as assert } from "node:assert";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const {
  PRIVACY_COOKIE,
  PRIVACY_LANDING_PATH,
  asksPrivacy,
  withoutPrivacyParam,
  cookieSaysPrivacy,
  isDbWrite,
  isApiWrite,
  isUnmaskedScreen,
} = await import("../src/lib/privacy/demo-link");

let passed = 0;
let failed = 0;
const test = (name: string, fn: () => void) => {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (error) {
    failed++;
    console.log(`  ❌ ${name}\n     ${(error as Error).message}`);
  }
};

console.log("\n[1] 주소로 켜기");
test("?mask=on 을 알아본다", () => assert.equal(asksPrivacy("?mask=on"), true));
test("이름·값의 대소문자와 공백은 따지지 않는다", () => assert.equal(asksPrivacy("?MASK=%20On%20"), true));
test("다른 쿼리와 섞여 있어도 알아본다", () => assert.equal(asksPrivacy("?month=2026-10&mask=on"), true));
test("★끄는 값은 모른 척한다(mask=off)", () => assert.equal(asksPrivacy("?mask=off"), false));
test("값이 없으면 켜지 않는다", () => assert.equal(asksPrivacy("?mask"), false));
test("비슷한 이름은 켜지 않는다(masking=on)", () => assert.equal(asksPrivacy("?masking=on"), false));
test("쿼리가 없으면 켜지 않는다", () => assert.equal(asksPrivacy(""), false));

console.log("\n[2] 주소에서 표시 떼기");
test("mask=on 만 떼고 나머지는 순서대로 남긴다", () =>
  assert.equal(withoutPrivacyParam("?month=2026-10&mask=on&tab=stats").toString(), "month=2026-10&tab=stats"));
test("mask=on 하나뿐이면 빈 쿼리가 된다", () => assert.equal(withoutPrivacyParam("?mask=on").toString(), ""));
test("모르는 값(mask=off)은 건드리지 않는다", () => assert.equal(withoutPrivacyParam("?mask=off").toString(), "mask=off"));

console.log("\n[3] 쿠키 읽기");
test("가림 쿠키가 켜져 있으면 true", () => assert.equal(cookieSaysPrivacy(`a=1; ${PRIVACY_COOKIE}=on; b=2`), true));
test("값이 다르면 false", () => assert.equal(cookieSaysPrivacy(`${PRIVACY_COOKIE}=off`), false));
test("이름이 앞부분만 같은 다른 쿠키는 false", () => assert.equal(cookieSaysPrivacy(`${PRIVACY_COOKIE}-x=on`), false));
test("쿠키가 없으면 false", () => {
  assert.equal(cookieSaysPrivacy(""), false);
  assert.equal(cookieSaysPrivacy(null), false);
});

console.log("\n[4] DB 쓰기 판정 — 가림 모드에서 브라우저가 보내지 않을 요청");
const DB = "https://example.supabase.co";
test("표 조회(GET)는 쓰기가 아니다", () => assert.equal(isDbWrite("GET", `${DB}/rest/v1/hh_transaction?select=*`), false));
test("표 추가(POST)는 쓰기다", () => assert.equal(isDbWrite("POST", `${DB}/rest/v1/hh_transaction`), true));
test("표 수정(PATCH)·삭제(DELETE)는 쓰기다", () => {
  assert.equal(isDbWrite("PATCH", `${DB}/rest/v1/hh_transaction?id=eq.1`), true);
  assert.equal(isDbWrite("DELETE", `${DB}/rest/v1/hh_transaction?id=eq.1`), true);
});
test("함수 호출(rpc)은 쓰기로 본다 — 수집함 확정·되돌리기", () => assert.equal(isDbWrite("POST", `${DB}/rest/v1/rpc/hh_confirm_inbox`), true));
test("소문자 메서드도 같다", () => assert.equal(isDbWrite("post", `${DB}/rest/v1/hh_budget`), true));
test("★로그인·토큰 갱신·로그아웃(/auth/v1/)은 막지 않는다", () => {
  assert.equal(isDbWrite("POST", `${DB}/auth/v1/token?grant_type=refresh_token`), false);
  assert.equal(isDbWrite("POST", `${DB}/auth/v1/logout`), false);
});
test("메서드를 모르면 조회로 본다", () => assert.equal(isDbWrite(undefined, `${DB}/rest/v1/hh_account`), false));

console.log("\n[5] API 쓰기 판정 — 가림 쿠키가 켜진 브라우저의 요청 중 문지기가 막을 것");
test("비밀번호 변경은 막는다", () => assert.equal(isApiWrite("POST", "/api/account/password"), true));
test("수집함 원문 지우기는 막는다", () => assert.equal(isApiWrite("POST", "/api/household/inbox/purge-raw"), true));
test("★로그인은 막지 않는다(가림 모드로 로그인 화면에 온 사람)", () => assert.equal(isApiWrite("POST", "/api/auth/login"), false));
test("★휴대폰 수집 요청은 막지 않는다", () => {
  assert.equal(isApiWrite("POST", "/api/household/inbox"), false);
  assert.equal(isApiWrite("POST", "/api/household/inbox/sms"), false);
  assert.equal(isApiWrite("POST", "/api/household/sms"), false);
});
test("기록 전송은 막지 않는다", () => assert.equal(isApiWrite("POST", "/api/audit"), false));
test("조회(GET)는 막지 않는다", () => assert.equal(isApiWrite("GET", "/api/account/profile"), false));
test("★GET 이지만 자료를 지우는 원문 정리는 막는다", () => {
  assert.equal(isApiWrite("GET", "/api/household/inbox/purge-raw"), true);
  assert.equal(isApiWrite("GET", "/api/household/inbox/purge-raw/"), true);
  assert.equal(isApiWrite("HEAD", "/api/household/inbox/purge-raw"), true);
  assert.equal(isApiWrite(undefined, "/api/household/inbox/purge-raw"), true);
});
test("원문 정리와 주소가 비슷할 뿐인 조회는 막지 않는다(완전일치)", () => {
  assert.equal(isApiWrite("GET", "/api/household/inbox/purge-raw-status"), false);
  assert.equal(isApiWrite("GET", "/api/household/inbox/purge-raw/log"), false);
  assert.equal(isApiWrite("GET", "/api/household/inbox"), false);
});
test("처음 보는 API 의 쓰기는 기본이 '막음'", () => assert.equal(isApiWrite("PUT", "/api/household/something-new"), true));
test("API 가 아닌 주소는 대상이 아니다", () => assert.equal(isApiWrite("POST", "/login"), false));

console.log("\n[6] 가리지 못하는 화면");
test("수집함은 막는다", () => assert.equal(isUnmaskedScreen("/dashboard/household/inbox"), true));
test("시스템개선·설치 안내는 막는다", () => {
  assert.equal(isUnmaskedScreen("/dashboard/household/system"), true);
  assert.equal(isUnmaskedScreen("/dashboard/household/claude-setup"), true);
});
test("새로 쓰기·고치기 화면은 막는다", () => {
  assert.equal(isUnmaskedScreen("/dashboard/household/expenses/new"), true);
  assert.equal(isUnmaskedScreen("/dashboard/household/loans/abc-123/edit"), true);
});
test("현금흐름·통계·상세는 막지 않는다", () => {
  assert.equal(isUnmaskedScreen("/dashboard/household/cash"), false);
  assert.equal(isUnmaskedScreen("/dashboard/household/stats"), false);
  assert.equal(isUnmaskedScreen("/dashboard/household/expenses/abc-123"), false);
});
test("끝의 / 는 무시한다", () => assert.equal(isUnmaskedScreen("/dashboard/household/inbox/"), true));
test("가림 모드 첫 화면은 막힌 화면이 아니다", () => assert.equal(isUnmaskedScreen(PRIVACY_LANDING_PATH), false));

console.log("\n[7] 정적 검사 — 대시보드의 모든 화면은 '가림 사용 / 막힌 화면 / 넘기기만 하는 화면' 중 하나다");
// 새 화면을 만들고 가림 처리도 막는 목록 등록도 잊으면 여기서 걸린다.
// 한계: 가림 모듈을 한 번이라도 쓰는지만 본다. 일부 칸만 가린 화면의 빠진 칸은 못 잡는다.
{
  const root = join(process.cwd(), "src", "app", "dashboard");
  const pages: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "page.tsx") pages.push(full);
    }
  };
  walk(root);
  test("화면 파일을 찾았다", () => assert.ok(pages.length > 10, `page.tsx ${pages.length}개`));
  for (const file of pages) {
    const route =
      "/dashboard" +
      relative(root, file)
        .split(sep)
        .slice(0, -1)
        .map((seg) => `/${seg.startsWith("[") ? "sample-id" : seg}`)
        .join("");
    const source = readFileSync(file, "utf8");
    const usesMask = /usePrivacyMode|MaskedText/.test(source);
    const onlyRedirects = /\bredirect\(/.test(source) && !/"use client"/.test(source);
    test(`${route}`, () =>
      assert.ok(
        usesMask || onlyRedirects || isUnmaskedScreen(route),
        "가림 모듈을 쓰지 않는 화면이다 — 금액·이름을 가리거나 demo-link.ts 의 UNMASKED_SCREENS 에 넣을 것"
      ));
  }
}

console.log(`\nResult: ${passed} passed / ${failed} failed`);
if (failed) process.exitCode = 1;
