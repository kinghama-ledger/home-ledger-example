/**
 * 부호가 있는 원 단위 금액 — 통장 '시작 잔액' 칸이 쓴다.
 *
 * 다른 금액 칸(지출·수입·이체)은 0 이상만 받지만, 시작 잔액은 마이너스 통장이면 0 보다 작다.
 * DB 의 hh_account.opening_balance 는 제약 없는 integer 이고, 잔액 계산(hh_account_balance 뷰·통장내역)은
 * 시작 잔액에 거래를 더하고 빼기만 하므로 음수를 그대로 받아도 계산이 달라지지 않는다.
 */

/** PostgreSQL integer 의 한계. 넘는 값을 보내면 저장이 DB 오류로 실패한다. */
export const OPENING_BALANCE_LIMIT = 2_147_483_647;

/**
 * 입력칸 글자 → 금액.
 * - 처음 나오는 숫자 덩어리 하나만 읽는다(쉼표는 버린다). 숫자는 10자리까지. 뒤에 딸린 글자·다른 숫자(날짜 등)는 버린다.
 * - 그 숫자 바로 앞에 빼기표가 있으면 음수다. 앞에 다른 글자가 붙어 있어도("잔액 -1,500,000원", "₩-1,500,000") 부호를 잃지 않는다.
 * - `pendingMinus`: 빼기표만 있고 숫자가 아직 없다(값 0). 입력칸이 그 빼기표를 지우지 않고 보여 줘야 이어서 칠 수 있다.
 */
export function parseSignedAmountText(text: string): { value: number; pendingMinus: boolean } {
  const t = text.trim();
  const run = /\d[\d,]*/.exec(t);
  // 숫자 앞 글자에서 공백과 통화 기호를 걷어 내고, 그 끝이 빼기표인지 본다.
  const before = (run ? t.slice(0, run.index) : t).replace(/[\s₩\\]/g, "");
  const negative = before.endsWith("-") || before.endsWith("−");
  const digits = (run ? run[0] : "").replace(/\D/g, "").slice(0, 10);
  const abs = digits ? parseInt(digits, 10) : 0;
  if (abs === 0) return { value: 0, pendingMinus: negative };
  return { value: negative ? -abs : abs, pendingMinus: false };
}

/** 저장해도 되는 시작 잔액인지. 되면 null, 안 되면 화면에 보일 말. */
export function openingBalanceError(n: number): string | null {
  if (!Number.isInteger(n)) return "시작 잔액은 원 단위 숫자로 넣어 주세요.";
  if (Math.abs(n) > OPENING_BALANCE_LIMIT) {
    return `시작 잔액은 ${OPENING_BALANCE_LIMIT.toLocaleString("ko-KR")}원을 넘을 수 없습니다.`;
  }
  return null;
}

/**
 * 수정 창 도움말 — 시작 잔액을 바꾸면 현재 잔액이 얼마나 움직이는지.
 * 현재 잔액 = 시작 잔액 + 거래 합계이므로 바꾼 만큼 그대로 움직인다. 안 바꿨으면 null.
 */
export function openingBalanceChangeNote(before: number, after: number): string | null {
  const diff = after - before;
  if (diff === 0) return null;
  const amount = Math.abs(diff).toLocaleString("ko-KR");
  return diff > 0 ? `저장하면 현재 잔액이 ${amount}원 늘어납니다.` : `저장하면 현재 잔액이 ${amount}원 줄어듭니다.`;
}
