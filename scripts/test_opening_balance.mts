// 통장 '시작 잔액' 칸: 입력 글자 → 저장 값, 저장 가능 범위, 수정 창 도움말.
const { parseSignedAmountText, openingBalanceError, openingBalanceChangeNote, OPENING_BALANCE_LIMIT } = await import(
  "../src/lib/household/signed-amount"
);

let pass = 0;
let fail = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    pass += 1;
    console.log(`  OK ${label}: ${a}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${label}: expected ${e}, got ${a}`);
  }
}

// 입력 글자 → 값
const parseCases: Array<[string, number, boolean, string]> = [
  ["", 0, false, "빈칸은 0"],
  ["3200000", 3_200_000, false, "숫자만"],
  ["3,200,000", 3_200_000, false, "쉼표가 든 값(화면이 보여 준 글자를 그대로 다시 받음)"],
  ["3,200,000원", 3_200_000, false, "통장 앱에서 복사한 '원' 붙은 값"],
  [" 850000 ", 850_000, false, "앞뒤 공백"],
  ["-", 0, true, "빼기표만 — 이어서 칠 수 있게 남긴다"],
  ["-0", 0, true, "빼기표와 0"],
  ["-1,500,000", -1_500_000, false, "마이너스 통장"],
  ["−1500000", -1_500_000, false, "빼기 기호(−)로 붙여 넣은 값"],
  ["12-34", 12, false, "가운데 빼기표는 부호가 아니다 — 첫 숫자 덩어리만 읽는다"],
  ["잔액 -1,500,000원", -1_500_000, false, "앞에 글자가 붙은 음수도 부호를 잃지 않는다"],
  ["₩-1,500,000", -1_500_000, false, "통화 기호 뒤의 빼기표"],
  ["- 1,500,000", -1_500_000, false, "빼기표와 숫자 사이 공백"],
  ["1,500,000원 2026.11.12", 1_500_000, false, "뒤에 딸린 날짜는 이어 붙이지 않는다"],
  ["잔액 1,500,000원", 1_500_000, false, "앞에 글자가 붙은 양수"],
  ["12345678901234", 1_234_567_890, false, "10자리까지만 읽는다"],
  ["abc", 0, false, "글자는 버린다"],
];
for (const [text, value, pendingMinus, label] of parseCases) {
  check(label, parseSignedAmountText(text), { value, pendingMinus });
}

// 화면이 보여 주는 글자를 다시 읽으면 같은 값 — 고칠 때 값이 변하지 않는다
for (const n of [0, 1, 110_000, 3_200_000, -1_500_000, OPENING_BALANCE_LIMIT, -OPENING_BALANCE_LIMIT]) {
  const shown = n === 0 ? "" : n.toLocaleString("ko-KR");
  check(`표시 → 다시 읽기 ${n}`, parseSignedAmountText(shown).value, n);
}

// 저장 가능 범위
check("0 은 저장 가능", openingBalanceError(0), null);
check("음수 저장 가능", openingBalanceError(-1_500_000), null);
check("한계값 저장 가능", openingBalanceError(OPENING_BALANCE_LIMIT), null);
check("음의 한계값 저장 가능", openingBalanceError(-OPENING_BALANCE_LIMIT), null);
check("한계를 넘으면 막는다", openingBalanceError(OPENING_BALANCE_LIMIT + 1) !== null, true);
check("음수 쪽 한계를 넘어도 막는다", openingBalanceError(-OPENING_BALANCE_LIMIT - 1) !== null, true);
check("10자리 최댓값은 막는다", openingBalanceError(parseSignedAmountText("9999999999").value) !== null, true);
check("소수는 막는다", openingBalanceError(1000.5) !== null, true);
check("숫자가 아니면 막는다", openingBalanceError(Number.NaN) !== null, true);

// 수정 창 도움말
check("안 바꾸면 말이 없다", openingBalanceChangeNote(500_000, 500_000), null);
check("늘리면", openingBalanceChangeNote(500_000, 800_000), "저장하면 현재 잔액이 300,000원 늘어납니다.");
check("줄이면", openingBalanceChangeNote(500_000, 100_000), "저장하면 현재 잔액이 400,000원 줄어듭니다.");
check("0 → 음수", openingBalanceChangeNote(0, -1_500_000), "저장하면 현재 잔액이 1,500,000원 줄어듭니다.");

console.log(`\nResult: ${pass} passed / ${fail} failed`);
process.exit(fail ? 1 : 0);
