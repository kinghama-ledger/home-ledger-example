// 설정 > 문자수집 화면 검증 — 폰 연결의 첫 걸음이 깨지지 않았는지 본다.
//  ① 수집함의 '문자 자동수집 설정' 단추(없으면 주소 ?tab=ingest)로 문자수집 탭이 바로 열린다
//  ② 토큰을 발급해도 문자수집 탭에 머문다(예전엔 자료를 다시 읽으며 첫 탭으로 돌아가 방금 받은 토큰이 안 보였다)
//  ③ 'MacroDroid 용 한 번에 복사'가 이 주소·방금 받은 토큰으로 된 한 줄을 복사한다
//  ④ 노란 상자를 닫으면 '전체 복사'가 잠긴다(자리표시 글자를 복사하지 않게)
// 토큰 하나를 만들고 끝에 폐기한다(이름 '시험-탭유지-<실행 시각>'). 중간에 실패해도 이번에 만든 것은 폐기한다. 다른 자료는 건드리지 않는다.
// 토큰을 만들었다 지우므로 내 PC 의 dev 서버에서만 돈다(다른 주소면 멈춘다. 정말 필요하면 ALLOW_REMOTE=1).
//
// 실행: BASE_URL=http://localhost:3000 node scripts/test_ingest_tab.mjs   (dev 서버가 떠 있어야 한다)
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; })
);
const LABEL = `시험-탭유지-${Date.now()}`; // 실행마다 다른 이름 — 예전 실행이 남긴 토큰을 잘못 지우지 않는다
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE) && process.env.ALLOW_REMOTE !== "1") {
  console.log(`BASE_URL 이 내 PC 가 아닙니다(${BASE}). 토큰을 만들었다 지우는 시험이라 멈춥니다.`);
  process.exit(1);
}

const step = (m) => console.log(`\n▶ ${m}`);
let fail = 0;
const check = (ok, msg) => { console.log(`  ${ok ? "✅" : "❌"} ${msg}`); if (!ok) fail++; };

let browser;
let page;
let issued = false; // 이번 실행이 토큰을 만들었는가(정리 대상)
try {
  step("로그인");
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 412, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] });
  page = await context.newPage();
  // 토큰 이름을 묻는 창에는 시험용 이름을, 폐기 확인 창에는 확인을 누른다.
  page.on("dialog", (d) => void d.accept(d.type() === "prompt" ? LABEL : undefined));
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.waitForSelector('button[type="submit"]:not([disabled])', { timeout: 20000 });
  await page.waitForTimeout(1200);
  await page.fill("#loginId", env.E2E_LOGIN_ID || "admin");
  if (!env.E2E_LOGIN_PASSWORD) throw new Error(".env.local 에 E2E_LOGIN_PASSWORD 가 없습니다.");
  await page.fill("#password", env.E2E_LOGIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/, { timeout: 30000 });

  const ingestTab = page.getByRole("tab", { name: "문자수집" });
  const issue = page.getByRole("button", { name: "토큰 발급" });

  step("① 문자수집 탭이 바로 열린다");
  await page.goto(`${BASE}/dashboard/household/inbox`, { waitUntil: "networkidle" });
  const shortcut = page.getByRole("link", { name: "문자 자동수집 설정" });
  if (await shortcut.isVisible().catch(() => false)) {
    await shortcut.click(); // 화면 전환으로 넘어가는 길(주소가 늦게 바뀌는 쪽)
    console.log("    수집함의 단추로 이동");
  } else {
    await page.goto(`${BASE}/dashboard/household/settings?tab=ingest`, { waitUntil: "networkidle" });
    console.log("    검토대기에 줄이 있어 단추가 없다 → 주소로 이동");
  }
  await issue.waitFor({ timeout: 30000 });
  check((await ingestTab.getAttribute("data-state")) === "active", "문자수집 탭이 켜져 있다");

  step("② 토큰을 발급해도 문자수집 탭에 머문다");
  await issue.click();
  issued = true;
  const copyAll = page.getByRole("button", { name: "MacroDroid 용 한 번에 복사" });
  await copyAll.waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500); // 자료를 다시 읽고 화면이 다시 그려질 틈
  check((await ingestTab.getAttribute("data-state")) === "active", "발급 뒤에도 문자수집 탭이 켜져 있다");
  check(await copyAll.isVisible(), "방금 받은 토큰의 '한 번에 복사' 단추가 보인다");

  step("③ 한 번에 복사 — 이 주소와 방금 받은 토큰");
  const codes = await page.locator("code").allInnerTexts();
  const token = codes.map((c) => c.trim()).find((c) => /^[0-9a-f]{48}$/.test(c));
  check(Boolean(token), "화면에 48자 토큰이 보인다");
  await copyAll.click();
  await page.getByText("MacroDroid 용으로 복사했습니다.").waitFor({ timeout: 10000 });
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  check(copied === `curl -X POST '${BASE}/api/household/inbox/sms' -H 'Content-Type: text/plain' -H 'X-Ingest-Token: ${token}' -d '[sms_message]'`,
    "복사된 한 줄이 이 주소·방금 받은 토큰으로 되어 있다");

  step("④ 노란 상자를 닫으면 '전체 복사'가 잠긴다");
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await page.getByText("결제문자 자동수집 설정 방법").click();
  const plainCopy = page.getByRole("button", { name: "전체 복사" }).first();
  await plainCopy.waitFor({ timeout: 10000 });
  check(await plainCopy.isDisabled(), "토큰이 화면에 없으면 '전체 복사'를 누를 수 없다");
  check(!(await page.locator("code").allInnerTexts()).some((c) => c.includes(token)), "닫은 뒤에는 토큰이 화면에 남지 않는다");

  step("정리 — 시험용 토큰 폐기");
  const row = page.locator("tr").filter({ hasText: LABEL }).first();
  await row.getByTitle("폐기").click();
  await row.waitFor({ state: "detached", timeout: 15000 });
  issued = false;
  check((await page.locator("tr").filter({ hasText: LABEL }).count()) === 0, "시험용 토큰이 표에서 사라졌다");
  check((await ingestTab.getAttribute("data-state")) === "active", "폐기 뒤에도 문자수집 탭에 머문다");
} catch (e) {
  fail++;
  console.log(`  ❌ 중단: ${String(e).slice(0, 400)}`);
} finally {
  // 중간에 멈췄어도 이번 실행이 만든 토큰은 남기지 않는다.
  if (issued && page) {
    try {
      await page.goto(`${BASE}/dashboard/household/settings?tab=ingest`, { waitUntil: "networkidle" });
      const left = page.locator("tr").filter({ hasText: LABEL }).first();
      await left.waitFor({ timeout: 15000 });
      await left.getByTitle("폐기").click();
      await left.waitFor({ state: "detached", timeout: 15000 });
      console.log(`  정리: 남아 있던 시험용 토큰(${LABEL})을 폐기했습니다.`);
    } catch {
      fail++;
      console.log(`  ❌ 정리 실패: 설정 ▸ 문자수집에서 '${LABEL}' 토큰을 직접 폐기하세요.`);
    }
  }
  await browser?.close();
}
console.log(fail ? `\n실패 ${fail}건` : "\n전부 통과 ✅");
process.exit(fail ? 1 : 0);
