// 가림(마스킹) 모드의 글자 치환 검증 — 사용자가 지은 이름(대출명·정기지출 제목) 속 사람 이름, 계좌·카드 번호.
//
// 실행: npm run test:privacy-names   (DB·브라우저 불필요 — 순수 함수 + 화면 파일 정적 검사)
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const { mask, maskNamesIn } = await import("../src/lib/privacy/mask");

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

const FAMILY = ["김하늘", "이바다"];
const fakeOf = (name: string) => mask("name", name, true);

console.log("\n글 속의 등록된 이름 바꾸기 (maskNamesIn)");
test("괄호 없이 하이픈 뒤에 붙은 이름도 바뀐다", () => {
  const out = maskNamesIn("주택담보대출-김하늘", FAMILY, true);
  assert.equal(out, `주택담보대출-${fakeOf("김하늘")}`);
  assert.ok(!out.includes("김하늘"));
});
test("앞·가운데·괄호 안 어디에 있어도 바뀐다", () => {
  for (const text of ["김하늘 실손보험", "보험 김하늘 몫", "국민은행(김하늘)", "김하늘"]) {
    assert.ok(!maskNamesIn(text, FAMILY, true).includes("김하늘"), text);
  }
});
test("한 글에 두 사람이 있으면 둘 다 바뀐다", () => {
  const out = maskNamesIn("김하늘→이바다 용돈", FAMILY, true);
  assert.equal(out, `${fakeOf("김하늘")}→${fakeOf("이바다")} 용돈`);
});
test("같은 이름이 여러 번 나와도 모두 바뀐다", () => {
  assert.ok(!maskNamesIn("김하늘 적금 / 김하늘 보험", FAMILY, true).includes("김하늘"));
});
test("같은 사람은 mask(\"name\") 과 같은 가짜 이름이 된다 — 화면마다 다른 이름으로 보이지 않는다", () => {
  assert.equal(maskNamesIn("김하늘", FAMILY, true), fakeOf("김하늘"));
});
test("이름이 없는 글은 그대로다", () => {
  assert.equal(maskNamesIn("관리비(아파트)", FAMILY, true), "관리비(아파트)");
});
test("가림이 꺼져 있으면 아무것도 바꾸지 않는다", () => {
  assert.equal(maskNamesIn("주택담보대출-김하늘", FAMILY, false), "주택담보대출-김하늘");
});
test("null·undefined 는 빈 글자, 빈 이름·null 이름은 무시한다", () => {
  assert.equal(maskNamesIn(null, FAMILY, true), "");
  assert.equal(maskNamesIn(undefined, FAMILY, true), "");
  assert.equal(maskNamesIn("통신비", ["", "  ", null, undefined], true), "통신비");
  assert.equal(maskNamesIn("통신비", [], true), "통신비");
});
test("긴 이름을 먼저 맞춘다 — '하늘'과 '김하늘'이 함께 등록돼도 '김'이 남지 않는다", () => {
  const out = maskNamesIn("전세대출-김하늘", ["하늘", "김하늘"], true);
  assert.equal(out, `전세대출-${fakeOf("김하늘")}`);
});
test("한 번 바꾼 자리는 다시 바꾸지 않는다 — 가짜 이름이 다른 등록 이름을 품어도 안전", () => {
  // 가짜 이름 자체를 등록 이름으로 넣어도 결과가 한 번만 바뀐 값이어야 한다.
  const fake = fakeOf("김하늘");
  assert.equal(maskNamesIn("대출-김하늘", ["김하늘", fake], true), `대출-${fake}`);
});
test("이름에 정규식 기호가 있어도 글자 그대로 맞춘다", () => {
  const out = maskNamesIn("적금 J.Kim(가족)", ["J.Kim"], true);
  assert.ok(!out.includes("J.Kim"));
  assert.equal(maskNamesIn("적금 JxKim", ["J.Kim"], true), "적금 JxKim");
});
test("괄호 규칙(owner_name)과 겹쳐 써도 등록 이름은 같은 가짜 이름으로 나온다", () => {
  const viaBoth = maskNamesIn(mask("owner_name", "신용대출(김하늘)", true), FAMILY, true);
  assert.equal(viaBoth, `신용대출(${fakeOf("김하늘")})`);
  const noParen = maskNamesIn(mask("owner_name", "신용대출-이바다", true), FAMILY, true);
  assert.equal(noParen, `신용대출-${fakeOf("이바다")}`);
});

console.log("\n계좌·카드 번호 가리기 (mask account_no)");
test("숫자가 바뀌고 자릿수·구분 기호는 그대로다", () => {
  const real = "110-234-567890";
  const out = mask("account_no", real, true);
  assert.notEqual(out, real);
  assert.equal(out.replace(/\d/g, "0"), real.replace(/\d/g, "0"));
});
test("같은 번호는 늘 같은 가짜 번호다", () => {
  assert.equal(mask("account_no", "1234-5678-9012-3456", true), mask("account_no", "1234-5678-9012-3456", true));
});
test("숫자가 없는 값('-')과 꺼진 상태는 그대로다", () => {
  assert.equal(mask("account_no", "-", true), "-");
  assert.equal(mask("account_no", "110-234-567890", false), "110-234-567890");
});

// 화면이 실제로 이 함수들을 거치는지 — 가림 없이 그대로 출력하던 자리가 되돌아오면 여기서 걸린다.
console.log("\n화면 정적 검사");
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const SETTINGS = read("src/app/dashboard/household/settings/page.tsx");
const CASH = read("src/app/dashboard/household/cash/page.tsx");
const LOANS = read("src/app/dashboard/household/loans/page.tsx");
const LOAN_DETAIL = read("src/app/dashboard/household/loans/[id]/page.tsx");

test("설정: 정기지출 제목·토큰 이름을 그대로 출력하지 않는다", () => {
  assert.ok(!/>\{sp\.title\}</.test(SETTINGS), "{sp.title} 을 가림 없이 출력한다");
  assert.ok(!/>\{t\.label \?\? /.test(SETTINGS), "{t.label} 을 가림 없이 출력한다");
});
test("설정: 계좌·카드 번호는 mask(\"account_no\") 를 거친다", () => {
  assert.ok(!/>\{maskAccountNo\(/.test(SETTINGS), "계좌번호를 가림 없이 출력한다");
  assert.ok(!/: maskCardNo\(m\.card_no\)\}</.test(SETTINGS), "카드번호를 가림 없이 출력한다");
});
test("설정: 가림 모드에서는 삭제·폐기 확인창을 띄우지 않는다", () => {
  for (const fn of ["deleteRow", "revokeToken"]) {
    const at = SETTINGS.indexOf(`const ${fn} = async`);
    assert.ok(at >= 0, `${fn} 를 찾지 못했다`);
    const body = SETTINGS.slice(at, at + 600);
    assert.ok(body.indexOf("privacyOn") >= 0 && body.indexOf("privacyOn") < body.indexOf("confirm("), `${fn}: confirm 앞에 가림 확인이 없다`);
  }
});
test("현금흐름: 계좌번호를 그대로 출력하지 않는다", () => {
  assert.ok(!/\{a\.account_no\}/.test(CASH), "{a.account_no} 를 가림 없이 출력한다");
  assert.ok(!/\? a\.account_no :/.test(CASH), "a.account_no 를 가림 없이 출력한다");
});
test("현금흐름: 금액 입력칸은 가림 모드에서 읽기 전용이다", () => {
  for (const shown of ["amountDisplay(i)", "paidDisplay(i)", "nextAmountDisplay(i)", "bufferInputValue"]) {
    const uses = CASH.split(`value={${shown}}`).length - 1;
    const guarded = CASH.split(new RegExp(`value=\\{${shown.replace(/[()]/g, "\\$&")}\\}\\s+readOnly=\\{maskEnabled\\}`)).length - 1;
    assert.ok(uses > 0, `${shown} 입력칸을 찾지 못했다`);
    assert.equal(guarded, uses, `${shown}: readOnly 가 없는 입력칸이 있다`);
  }
});
test("대출관리·대출 상세: 대출명에 등록 이름 치환(maskNamesIn)을 쓴다", () => {
  for (const [name, source] of [["목록", LOANS], ["상세", LOAN_DETAIL]] as const) {
    assert.ok(source.includes("maskNamesIn(mask(\"owner_name\","), `${name}: maskNamesIn 을 쓰지 않는다`);
    assert.ok(!/(title|label)[=:]\s*\{?\s*mask\("owner_name", (l|row)\.name\)/.test(source), `${name}: 괄호 규칙만 쓰는 자리가 남았다`);
  }
});

console.log(`\nResult: ${passed} passed / ${failed} failed`);
if (failed) process.exitCode = 1;
