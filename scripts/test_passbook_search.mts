// 통장내역 검색 회귀 테스트 — DB 없이 순수 함수만 본다.
//   npx tsx scripts/test_passbook_search.mts
const { matchesPassbookSearch, normalizeSearchText } = await import("../src/lib/household/passbook-search");

let pass = 0;
let fail = 0;
function check(label: string, actual: unknown, expected: unknown) {
  if (Object.is(actual, expected)) {
    pass += 1;
    console.log(`  OK ${label}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// 가상의 출금 한 줄
const row = {
  text: "한빛아파트 101동 · SKT+ 통신비",
  amount: -123450,
  date: "2026-09-17",
};
const match = (query: string, target = row) => matchesPassbookSearch(target, query);

console.log("\n[1] 글자");
check("빈 검색어는 전부 통과", match(""), true);
check("공백뿐이어도 전부 통과", match("   \t "), true);
check("부분 일치", match("아파트"), true);
check("대소문자 무시", match("skt+"), true);
check("전각 문자도 같은 글자로", match("ＳＫＴ＋"), true);
check("띄어쓰기 무시", match("한빛아파트101동"), true);
check("낱말 둘 다 맞으면 통과", match("한빛 통신비"), true);
check("낱말 하나라도 안 맞으면 탈락", match("한빛 해봄식당"), false);
check("정규화: 전각·대문자·공백", normalizeSearchText(" ＡＢ ｃ　１２ "), "abc12");

console.log("\n[2] 금액");
check("쉼표 금액", match("123,450"), true);
check("숫자 금액", match("123450"), true);
check("'원' 붙은 금액", match("123450원"), true);
check("금액 부분 일치", match("345"), true);
check("없는 금액은 탈락", match("777"), false);
check("입금(양수) 거래도 금액으로", match("123,450", { ...row, amount: 123450 }), true);
check("앞에 - 를 붙인 금액", match("-123450"), true);
check("화면에서 복사한 −123,450원", match("−123,450원"), true);
check("₩ 붙은 금액", match("₩123,450"), true);
check("글자+금액 둘 다 맞음", match("아파트 123450"), true);
check("글자는 맞고 금액이 틀림", match("아파트 777"), false);

console.log("\n[3] 날짜");
check("연-월", match("2026-09"), true);
check("월-일 하이픈", match("09-17"), true);
check("월.일 점", match("09.17"), true);
check("월/일 슬래시", match("09/17"), true);
check("다른 연월은 탈락", match("2025-01"), false);
check("한 자리 월 2026-9", match("2026-9"), true);
check("한 자리 월·일 9/7", match("9/7", { ...row, date: "2026-09-07" }), true);
check("9/7 은 09-17 에 맞지 않음", match("9/7"), false);

console.log("\n[4] 어느 쪽도 아님");
check("없는 말", match("없는내역"), false);
check("'원' 한 글자는 금액으로 새지 않음", match("원", { ...row, text: "관리비" }), false);
check("'원' 한 글자는 글자로는 찾음", match("원", { ...row, text: "지원금" }), true);
check("구분자만 있는 낱말은 날짜가 아님", match("-"), false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail === 0 ? 0 : 1;
