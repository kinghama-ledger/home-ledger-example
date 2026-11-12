// 통장내역 검색 — 화면에 보이는 한 줄(내역 글자·금액·날짜)을 검색어와 맞춰 본다. DB 를 읽지 않는 순수 함수.
// 검색어를 띄어 쓰면 낱말마다 모두 맞아야 한다(AND). 낱말 하나는 글자·금액·날짜 중 어느 쪽으로 맞아도 된다.

export interface PassbookSearchTarget {
  /** 내역 칸에 보이는 글자(상대처·분류·메모·유형을 이어 붙인 것) */
  text: string;
  /** 이 계좌 기준 증감. 출금은 음수 */
  amount: number;
  /** YYYY-MM-DD */
  date: string;
}

// 전각/반각, 대소문자, 띄어쓰기 차이는 같은 글자로 본다.
export function normalizeSearchText(s: string): string {
  return s.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
}

// 금액처럼 생긴 낱말에서 통화 표기만 걷어 낸다 — 앞의 부호·₩, 쉼표, 끝의 '원'.
// 화면의 '−12,300원' 을 그대로 복사해 붙여도 찾아야 한다. 숫자만 남지 않으면 금액이 아니다.
function amountDigits(token: string): string | null {
  const digits = token.replace(/^[-−+₩]+/, "").replace(/,/g, "").replace(/원$/, "");
  return /^\d+$/.test(digits) ? digits : null;
}

// 날짜처럼 생긴 낱말(숫자와 . / - 만)의 구분자를 '-' 로 통일한다.
// 구분자가 있을 때만 한 자리 월·일을 두 자리로 채운다(9/7 → 09-07). 구분자 없는 숫자는 채우면 뜻이 바뀐다.
function dateFragment(token: string): string | null {
  if (!/\d/.test(token) || !/^[\d./-]+$/.test(token)) return null;
  const unified = token.replace(/[./]/g, "-");
  if (!unified.includes("-")) return unified;
  return unified
    .split("-")
    .map((part) => (part.length === 1 ? `0${part}` : part))
    .join("-");
}

export function matchesPassbookSearch(target: PassbookSearchTarget, query: string): boolean {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;

  const text = normalizeSearchText(target.text);
  const amount = String(Math.abs(target.amount));

  return tokens.every((raw) => {
    const token = normalizeSearchText(raw);
    if (text.includes(token)) return true;

    const digits = amountDigits(token);
    if (digits !== null && amount.includes(digits)) return true;

    const fragment = dateFragment(token);
    return fragment !== null && target.date.includes(fragment);
  });
}
