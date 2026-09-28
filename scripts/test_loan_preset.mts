import { strict as assert } from "node:assert";

// ★정적 import 금지(.mts ESM ↔ CJS 컴파일 함정) — 동적 import
const { cardIssuerLabel, findRegisteredLoan, loanPresetFromInbox, ownerFromAccountName } = await import("../src/lib/household/loan-preset");

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

const terms = { rate: 14, term_months: 24, repayment_type: "equal_principal" as const, total_repayment: 17184320, maturity_date: "2028-08-04" };
const accounts = [{ id: "acc-1", name: "국민은행(이바다)" }, { id: "acc-2", name: "토스뱅크" }];

test("cardIssuerLabel: 정본 별칭표 — KB국민카드/KB카드 → 국민카드 · 은행명·빈값은 null", () => {
  assert.equal(cardIssuerLabel("KB국민카드"), "국민카드");
  assert.equal(cardIssuerLabel("KB카드"), "국민카드");
  assert.equal(cardIssuerLabel("삼성카드"), "삼성카드");
  assert.equal(cardIssuerLabel("국민은행"), null); // 카드사 아님
  assert.equal(cardIssuerLabel("  "), null);
  assert.equal(cardIssuerLabel(null), null);
});

test("ownerFromAccountName: 마지막 괄호 안 · 없으면 null", () => {
  assert.equal(ownerFromAccountName("국민은행(이바다)"), "이바다");
  assert.equal(ownerFromAccountName("토스뱅크"), null);
  assert.equal(ownerFromAccountName(undefined), null);
});

test("loanPresetFromInbox: 전부 있을 때 — 이름·원금·잔액·이자율·만기·상환방식·계좌", () => {
  const preset = loanPresetFromInbox(
    { guessed_institution: "KB국민카드", guessed_amount: 15_000_000, guessed_date: "2026-08-04", guessed_account_id: "acc-1", guessed_loan_terms: terms },
    accounts
  );
  assert.deepEqual(preset, {
    name: "국민카드-이바다-카드론(26.08)",
    origin_date: "2026-08-04",
    principal: 15_000_000,
    current_balance: 15_000_000,
    maturity_date: "2028-08-04",
    interest_rate: 14,
    repayment_type: "equal_principal",
    account_id: "", // 출금(결제)계좌는 채우지 않는다 — 입금계좌와 다를 수 있다
    status: "active",
  });
});

test("loanPresetFromInbox: 기관명이 카드사가 아니면(은행 입금 통지) 이름을 비운다 — 첫 마디는 현금흐름 모델이 읽는다", () => {
  const bank = loanPresetFromInbox(
    { guessed_institution: "국민은행", guessed_amount: 15_000_000, guessed_date: "2026-08-04", guessed_account_id: "acc-1", guessed_loan_terms: terms },
    accounts
  );
  assert.equal(bank.name, "");
  const noInst = loanPresetFromInbox(
    { guessed_institution: null, guessed_amount: 15_000_000, guessed_date: "2026-08-04", guessed_account_id: "acc-1", guessed_loan_terms: terms },
    accounts
  );
  assert.equal(noInst.name, ""); // '이바다-카드론(26.08)' 처럼 명의가 첫 마디로 당겨지면 안 된다
});

test("loanPresetFromInbox: monthly_payment·payment_day 키는 없다(설계 176 이중계상 방지)", () => {
  const preset = loanPresetFromInbox(
    { guessed_institution: "삼성카드", guessed_amount: 8_450_000, guessed_date: "2026-05-19", guessed_account_id: null, guessed_loan_terms: { ...terms, maturity_date: null, repayment_type: null } },
    accounts
  );
  assert.ok(!("monthly_payment" in preset) && !("payment_day" in preset));
  assert.equal(preset.name, "삼성카드-카드론(26.05)"); // 계좌 없음 → 명의 생략
  assert.equal(preset.maturity_date, "");
  assert.equal(preset.repayment_type, "");
});

test("loanPresetFromInbox: 명의 없는 계좌명 · 날짜 없음 → 괄호 생략 · 기관 없음", () => {
  const preset = loanPresetFromInbox(
    { guessed_institution: null, guessed_amount: null, guessed_date: null, guessed_account_id: "acc-2", guessed_loan_terms: null },
    accounts
  );
  assert.equal(preset.name, "");
  assert.equal(preset.principal, 0);
  assert.equal(preset.interest_rate, "");
  assert.equal(preset.origin_date, "");
});

const loans = [
  { id: "l1", name: "국민카드-이바다-카드론(26.08)", principal: 15_000_000, origin_date: "2026-08-04", status: "closed" }, // 닫힌 대출도 등록된 것으로 본다
  { id: "l2", name: "국민카드-이바다-카드론(26.08)", principal: 15_000_000, origin_date: "2026-08-06", status: "active" },
  { id: "l3", name: "삼성카드-카드론(26.05)", principal: 8_450_000, origin_date: "2026-05-19", status: "active" },
  { id: "l4", name: "전세대출-이바다", principal: 8_450_000, origin_date: "2026-05-19", status: "active" }, // 카드론 아님 — 같은 원금·날짜라도 무시
];

test("findRegisteredLoan: 원금 일치 + 실행일 정확 일치 · 닫힌 대출도 등록됨", () => {
  assert.equal(findRegisteredLoan({ guessed_amount: 15_000_000, guessed_date: "2026-08-04" }, loans)?.id, "l1");
});

test("findRegisteredLoan: ±3일 경계 양쪽 — 3일은 등록됨, 4일은 아님", () => {
  assert.equal(findRegisteredLoan({ guessed_amount: 8_450_000, guessed_date: "2026-05-22" }, loans)?.id, "l3");
  assert.equal(findRegisteredLoan({ guessed_amount: 8_450_000, guessed_date: "2026-05-23" }, loans), null);
  assert.equal(findRegisteredLoan({ guessed_amount: 8_450_000, guessed_date: "2026-05-16" }, loans)?.id, "l3");
  assert.equal(findRegisteredLoan({ guessed_amount: 8_450_000, guessed_date: "2026-05-15" }, loans), null);
});

test("findRegisteredLoan: 카드론이 아닌 대출은 같은 원금·날짜라도 무시한다", () => {
  const onlyOther = loans.filter((l) => l.id === "l4");
  assert.equal(findRegisteredLoan({ guessed_amount: 8_450_000, guessed_date: "2026-05-19" }, onlyOther), null);
});

test("findRegisteredLoan: 원금 다르면 아님 · 날짜/금액 없으면 null", () => {
  assert.equal(findRegisteredLoan({ guessed_amount: 15_000_001, guessed_date: "2026-08-04" }, loans), null);
  assert.equal(findRegisteredLoan({ guessed_amount: null, guessed_date: "2026-08-04" }, loans), null);
  assert.equal(findRegisteredLoan({ guessed_amount: 15_000_000, guessed_date: null }, loans), null);
});

test("findRegisteredLoan: 후보 둘이면 날짜가 가까운 것", () => {
  assert.equal(findRegisteredLoan({ guessed_amount: 15_000_000, guessed_date: "2026-08-05" }, loans)?.id, "l1"); // 8/4 (1일) vs 8/6 (1일) → 동률이면 먼저 만난 것
  assert.equal(findRegisteredLoan({ guessed_amount: 15_000_000, guessed_date: "2026-08-06" }, loans)?.id, "l2");
});

console.log(`\nResult: ${passed} passed / ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
