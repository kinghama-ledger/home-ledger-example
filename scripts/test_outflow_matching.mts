// 설계 131 검증: '출금금액' 자동매칭이 **안 나간 돈을 나갔다고 하지 않는다**.
//
// 실행: npm run test:outflow-match   (DB 불필요 — 순수 함수)
//
// 막으려는 오표시(아직 안 나간 금액이 '출금됨'으로 표시되는 네 가지 꼴):
//   ⓐ 용돈 항목 300,000  ← 지갑 충전(내부 이체) 300,000
//   ⓑ 카드대금 항목 81,677 ← 통장 간 이체 100,000 (근사매칭)
//   ⓒ 현금 항목 350,000 ← 신용카드로 낸 다른 항목의 거래 350,000
//   ⓓ 10일 예정 항목 100,000 ← 월초 거래 100,000 (예정일 한참 전)
// 아래 4묶음이 각각을 막는다. [5]는 "막다가 진짜 실적까지 잃지 않는다"를 지킨다.
const { matchOutflowActuals, outflowsForMatching } = await import("../src/lib/household/calc");
const { computeCashMatches, toOutflowMatchItem } = await import("../src/lib/household/cashflow-snapshot");

let fail = 0;
const eq = (name: string, a: unknown, b: unknown) => {
  if (Object.is(a, b)) console.log(`  ✅ ${name}`);
  else {
    fail++;
    console.log(`  ❌ ${name} — 기대 ${JSON.stringify(b)}, 실제 ${JSON.stringify(a)}`);
  }
};

const ACC = ["acc-kb", "acc-toss", "acc-pay"]; // 등록 계좌(한빛페이 포함)
const CARD = ["pm-samsung"]; // 신용카드 결제수단
const TOL = { earlyDayTolerance: 5 };

console.log("\n[0] 스냅샷·전월 열 공용 매칭 item — 대출만 계좌 게이트를 면제한다(설계 185 후속)");
{
  const base = { key: "item:1", sourceId: "src-1", amount: 100_000, label: "예정 지출", day: 10, accountId: "acc-current" };
  eq("★대출은 현재 계좌를 매칭 게이트에 넘기지 않는다", toOutflowMatchItem({ ...base, sourceKind: "loan" }).accountId, null);
  eq("고정비는 계좌 게이트를 유지한다", toOutflowMatchItem({ ...base, sourceKind: "fixed" }).accountId, "acc-current");
  eq("할부도 계좌 게이트를 유지한다", toOutflowMatchItem({ ...base, sourceKind: "installment" }).accountId, "acc-current");
  // ★설계 188 후속(리뷰 High): 대출은 '계좌를 모르는 항목'임을 매처에 알린다 — 같은 금액 경쟁에서
  //   계좌일치 우선패스가 대출 몫을 가로채지 않게 하는 근거.
  eq("★대출은 accountBlind 표식을 단다", toOutflowMatchItem({ ...base, sourceKind: "loan" }).accountBlind, true);
  eq("고정비는 accountBlind 가 아니다", toOutflowMatchItem({ ...base, sourceKind: "fixed" }).accountBlind, false);
  // 설계 216: 대출 항목만 원천 id 를 loanId 로 싣는다 — 0패스가 장부 loan_id 와 대조한다.
  eq("★대출은 원천 id 를 loanId 로 싣는다", toOutflowMatchItem({ ...base, sourceKind: "loan" }).loanId, "src-1");
  eq("고정비는 loanId 가 없다", toOutflowMatchItem({ ...base, sourceKind: "fixed" }).loanId, null);
}

console.log("\n[0-1] 전월 열 종단 — 현재 대출계좌와 다른 과거 계좌의 상환도 잡는다(설계 185 후속)");
{
  const loan = {
    key: "loan:1", sourceKind: "loan", sourceId: "1", kind: "loan", label: "대출상환-합성저축은행",
    categoryId: null, day: 10, naturalDay: 10, dayOverridden: false, amount: 100_000,
    accountId: "acc-current", paymentMethodId: null, cardCharge: false,
    baseCardCharge: false, baseAccountId: "acc-current", methodOverridden: false, released: false,
    paidOverride: null, paidAmount: null, reason: null, amountOverridden: false, remainingAmount: 100_000, paidPartial: false,
  } as const;
  const oldAccountPayment = {
    amount: 100_000, counterparty: "합성저축은행", txn_date: "2026-07-10", type: "payment" as const,
    account_id: null, from_account_id: "acc-old", to_account_id: null, payment_method_id: null,
  };
  const result = computeCashMatches({
    month: "2026-08", classified: [loan], paidThisMonth: new Map(), recentOutflows: [oldAccountPayment],
    accounts: [{ id: "acc-current" }, { id: "acc-old" }], methods: [],
  });
  eq("★계좌 A 등록 대출이 계좌 B의 전월 동일금액 상환과 매칭", result.prevPaidByKey.get("loan:1")?.amount, 100_000);

  // 계좌 게이트는 payment 의 금액 불일치(score 30 미만)에만 작동한다. 동일금액(score 30 이상)은 옛 호출부도
  // 통과하므로, 실제 회귀(변동금리·원리금 변동)를 RED 로 증명하는 근사금액 짝도 함께 둔다.
  const changedPayment = { ...oldAccountPayment, amount: 78_200 };
  const changedResult = computeCashMatches({
    month: "2026-08", classified: [loan], paidThisMonth: new Map(), recentOutflows: [changedPayment],
    accounts: [{ id: "acc-current" }, { id: "acc-old" }], methods: [],
  });
  eq("★계좌가 바뀐 대출의 전월 변동 상환액도 매칭", changedResult.prevPaidByKey.get("loan:1")?.amount, 78_200);
}

console.log("\n[1] 내부 이체(지갑 충전·통장 자리바꿈)는 매칭 풀에서 빠진다");
{
  const txns = [
    { amount: 300000, counterparty: "코나아이(주)(지역화폐)", txn_date: "2026-08-03", type: "transfer", from_account_id: "acc-kb", to_account_id: "acc-pay" },
    { amount: 500000, counterparty: "외부 송금", txn_date: "2026-08-03", type: "transfer", from_account_id: "acc-kb", to_account_id: null },
  ];
  const pool = outflowsForMatching(txns, ACC, CARD);
  eq("내부 이체 제외 후 1건", pool.length, 1);
  eq("남은 것은 외부 송금", pool[0].counterparty, "외부 송금");
  const m = matchOutflowActuals([{ key: "fixed:1", amount: 300000, label: "용돈-한별", day: 25 }], pool, TOL);
  eq("★충전이 용돈 항목에 안 붙는다", m.has("fixed:1"), false);
}

console.log("\n[2] 신용카드로 낸 지출은 매칭 풀에서 빠진다(그날 통장에서 안 나간다 — 설계 108 과 대칭)");
{
  const txns = [
    { amount: 350000, counterparty: "새싹수학학원", txn_date: "2026-08-03", type: "expense", payment_method_id: "pm-samsung" },
    { amount: 350000, counterparty: "영어 과외비(선생님)", txn_date: "2026-08-08", type: "expense", payment_method_id: null },
  ];
  const pool = outflowsForMatching(txns, ACC, CARD);
  eq("카드 결제 제외 후 1건", pool.length, 1);
  const m = matchOutflowActuals([{ key: "fixed:2", amount: 350000, label: "학원비-한별(영어과외-선생님)", day: 8 }], pool, TOL);
  eq("★카드로 낸 학원비 거래를 다른 항목이 못 가져간다", m.get("fixed:2")?.counterparty, "영어 과외비(선생님)");
}

console.log("\n[3] 2패스 — 상호가 맞는 항목이 먼저 가져간다(가로채기 방지)");
{
  const txns = [{ amount: 350000, counterparty: "새싹수학학원", txn_date: "2026-08-05", type: "expense" }];
  // 배열 순서상 '영어과외'가 앞이라 예전 규칙이면 이쪽이 가져갔다.
  const items = [
    { key: "fixed:eng", amount: 350000, label: "학원비-한별(영어과외-선생님)", day: 8 },
    { key: "fixed:math", amount: 350000, label: "학원비-새싹수학-한별", day: 5 },
  ];
  const m = matchOutflowActuals(items, txns, TOL);
  eq("★상호가 맞는 새싹수학이 가져간다", m.get("fixed:math")?.counterparty, "새싹수학학원");
  eq("영어과외는 빈칸", m.has("fixed:eng"), false);
}

console.log("\n[4] 날짜 가드 — 예정일보다 한참 이른 거래는 그 항목의 것이 아니다");
{
  const txns = [{ amount: 100000, counterparty: "1111111111111", txn_date: "2026-08-03", type: "expense" }];
  const m = matchOutflowActuals([{ key: "fixed:save", amount: 100000, label: "한별/한솔(적금)", day: 10 }], txns, TOL);
  eq("★10일 예정 항목이 3일 거래를 안 가져간다", m.has("fixed:save"), false);
  const m2 = matchOutflowActuals([{ key: "fixed:save", amount: 100000, label: "한별/한솔(적금)", day: 10 }], txns);
  eq("가드를 안 주면 종전대로 매칭(옵션이다)", m2.has("fixed:save"), true);
}

console.log("\n[5] 막다가 진짜 실적을 잃지 않는다");
{
  // ⓐ 상호까지 맞으면 날짜가 일러도 인정(선납)
  const early = [{ amount: 71939, counterparty: "KT", txn_date: "2026-08-02", type: "expense" }];
  const m1 = matchOutflowActuals([{ key: "fixed:kt", amount: 71939, label: "KT(2025.10)", day: 20 }], early, TOL);
  eq("★상호일치는 날짜 가드 면제", m1.get("fixed:kt")?.counterparty, "KT");
  // ⓑ 늦게 나간 것(주말 밀림)은 막지 않는다
  const late = [{ amount: 64830, counterparty: "국민건강보험", txn_date: "2026-08-13", type: "expense" }];
  const m2 = matchOutflowActuals([{ key: "fixed:nhis", amount: 64830, label: "국민연금보험공단(건강보험)", day: 10 }], late, TOL);
  eq("늦은 출금은 그대로 매칭", m2.has("fixed:nhis"), true);
  // ⓒ 날짜를 모르는 항목(day=null)은 가드가 걸리지 않는다
  const undated = [{ amount: 12000, counterparty: "주간고정비", txn_date: "2026-08-01", type: "expense" }];
  const m3 = matchOutflowActuals([{ key: "fixed:wk", amount: 12000, label: "주간고정비", day: null }], undated, TOL);
  eq("day 미정 항목은 종전대로", m3.has("fixed:wk"), true);
  // ⓓ 체크·선불 카드 결제는 즉시 출금이라 풀에 남는다
  const check = [{ amount: 50000, counterparty: "이마트", txn_date: "2026-08-10", type: "expense", payment_method_id: "pm-check" }];
  eq("체크카드 결제는 안 거른다", outflowsForMatching(check, ACC, CARD).length, 1);
}

console.log("\n[6] 직접 제외(released)한 항목은 당월 매칭에서 후순위다");
{
  // 증상: 등록한 실거래(240,000)가 현금흐름의 제 항목에 안 잡힌다.
  // 원인은 다른 항목(5일 예정)이 금액 오버라이드로 240,000 이 되고 released(직접 제외)
  // 상태인데도 매칭 풀에 남아, 진짜 주인(7일 예정, 240,000)의 실거래를 먼저 가져가는 것.
  // 금액이 같으면 배열 순서(예정일 오름차순)가 앞선 쪽이 이긴다 — 5일이 7일보다 앞이다.
  // 거르는 주체는 호출부(cashflow-snapshot 의 matchItems, cash/page.tsx 의 prevPaidByKey)이므로
  // 여기서는 **거르지 않으면 훔친다**와 **거르면 진짜 주인이 받는다**를 나란히 고정한다.
  const txns = [{ amount: 240000, counterparty: "관리사무소(은행나무아파트)", txn_date: "2026-08-07", type: "expense" }];
  const excluded = { key: "fixed:excl", amount: 240000, label: "학원비-수학학원-한솔", day: 5 };
  const owner = { key: "fixed:apt", amount: 240000, label: "관리비-은행나무아파트", day: 7 };

  // ⓐ 제외 항목이 앞에 있으면 훔친다 — 고치기 전의 순서(회귀 증거)
  const before = matchOutflowActuals([excluded, owner], txns, TOL);
  eq("★제외 항목이 앞에 있으면 남의 거래를 가져간다(회귀 증거)", before.get("fixed:excl")?.amount, 240000);
  eq("  그래서 진짜 주인은 미출금으로 남는다", before.has("fixed:apt"), false);

  // ⓑ 제외 항목을 맨 뒤로 밀면 진짜 주인이 가져간다 — 호출부가 이 순서를 만든다
  const after = matchOutflowActuals([owner, excluded], txns, TOL);
  eq("★제외 항목을 뒤로 밀면 진짜 주인이 가져간다", after.get("fixed:apt")?.amount, 240000);
  eq("  제외 항목은 남은 거래가 없어 비게 된다", after.has("fixed:excl"), false);

  // ⓒ ★그렇다고 제외 항목을 매칭에서 **빼면 안 된다** — 경쟁자가 없을 땐 자기 거래를 가져가야
  //   익월 기본값(설계 81 §E)과 '최근 3개월 실적' 판정이 유지된다. 뒤로 밀기만 하면 이게 지켜진다.
  const rentTxn = [{ amount: 480000, counterparty: "월세", txn_date: "2026-08-05", type: "expense" }];
  const alone = matchOutflowActuals([{ key: "fixed:rent", amount: 500000, label: "월세", day: 5 }], rentTxn, TOL);
  eq("★경쟁자가 없으면 제외 항목도 자기 거래를 가져간다", alone.get("fixed:rent")?.amount, 480000);
}

// ★위 [6]은 matchOutflowActuals 의 성질만 본다 — **운영 코드를 되돌려도 통과한다**(교차리뷰 지적).
//   그래서 실제 회귀는 여기서 cashflowSnapshot 을 통째로 돌려 잡는다. 순서를 만드는 주체가
//   cashflow-snapshot.ts 의 monthMatchItems 이므로, 그 정렬을 지우면 이 묶음이 빨갛게 된다.
console.log("\n[7] cashflowSnapshot 종단 — 제외 항목이 진짜 주인의 거래를 못 가져간다");
{
  const { cashflowSnapshot } = await import("../src/lib/household/cashflow-snapshot");
  const MONTH = "2026-08";
  const OWNER = "owner-1";
  const sp = (id: string, title: string, amount: number, day: number) =>
    ({
      id, owner_auth_uid: OWNER, title, direction: "out", amount, frequency: "monthly", pay_day: day,
      account_id: "acc-1", category_id: "cat-1", is_active: true, start_date: null, end_date: null,
      person_id: null, memo: null, sort_order: 0, created_at: "", updated_at: "",
    }) as never;

  // 수학학원(5일)은 '직접 제외', 은행나무아파트(7일)가 진짜 주인. 둘 다 240,000.
  const scheduled = [sp("sp-excl", "학원비-수학학원-한솔", 240_000, 5), sp("sp-apt", "관리비-은행나무아파트", 240_000, 7)];
  const actual = { amount: 240_000, counterparty: "관리사무소(은행나무아파트)", txn_date: "2026-08-07" };
  // 두 항목 모두 '최근 실적 있음'이어야 표에 남는다 — 지난달 실적을 하나씩 준다.
  const recentOutflows = [
    actual,
    { amount: 240_000, counterparty: "새싹수학학원", txn_date: "2026-07-27" },
  ];
  const released = {
    id: "ov-excl", owner_auth_uid: OWNER, year_month: MONTH, source_kind: "fixed", source_id: "sp-excl",
    amount_override: null, account_id: null, released: true, day_override: null, paid_override: null,
    created_at: "", updated_at: "",
  } as never;

  const base = {
    scheduled, loans: [], installments: [], txns: [], methods: [],
    recentOutflows, totalCash: 10_000_000, horizon: 3, accountIds: ["acc-1"],
    overrides: [released], nextOverrides: [],
  };
  const snap = cashflowSnapshot(MONTH, base as never);
  const byKey = (k: string) => snap.classified.find((i: { key: string }) => i.key === k);

  eq("★진짜 주인(은행나무아파트)이 그 거래를 가져간다", byKey("fixed:sp-apt")?.paidAmount, 240_000);
  eq("  제외한 수학학원은 그 거래를 못 가져간다", byKey("fixed:sp-excl")?.paidAmount ?? null, null);
  // released 항목이 '최근 실적 없음'으로 표에서 사라지지 않아야 한다(빼면 안 되는 이유).
  // classified 에서 사라지면 다음 달 예측에서도 빠진다 — released 를 아예 빼면 안 되는 이유.
  eq("★제외 항목도 표에 남아 있다(최근 실적 판정은 살아 있다)", byKey("fixed:sp-excl") != null, true);
}

console.log("\n[8] payment 3패스(설계 166) — 카드대금·대출납부는 금액이 달라도 상호·계좌로 잡는다");
{
  // 배경: 전월 payment 가 어느 행에도 안 붙어 전월 출금에서 빠지는 경우가 있다
  // — 카드대금은 달마다 금액이 크게 변해 ±30% 근사가 깨진다.
  // ⓐ 상호 일치 + 금액 무관(예: 예상 1,221,461 vs 실납부 2,037,608)
  // 명의는 '명의A/명의B'로 적는다 — 사람 이름을 코드에 넣지 않는다(설계 원칙).
  const hyundai = [{ amount: 2037608, counterparty: "현대카드대금", txn_date: "2026-07-01", type: "payment", from_account_id: "acc-kb" }];
  const m1 = matchOutflowActuals([{ key: "fixed:hd", amount: 1221461, label: "카드대금-현대카드-명의A", day: 1, accountId: "acc-kb" }], hyundai, TOL);
  eq("★카드대금은 금액이 ±30% 넘게 달라도 상호로 잡는다", m1.get("fixed:hd")?.amount, 2037608);

  // ⓑ 같은 상호("삼성카드")의 두 명의 — 출금계좌가 다른 항목엔 안 붙는다(오귀속 방지 계좌 게이트)
  const samsung = [{ amount: 1023968, counterparty: "삼성카드", txn_date: "2026-07-27", type: "payment", from_account_id: "acc-toss" }];
  const items2 = [
    { key: "fixed:ownerA", amount: 1_200_000, label: "카드대금-삼성카드-명의A", day: 27, accountId: "acc-kb" },   // 계좌 불일치
    { key: "fixed:ownerB", amount: 500_034, label: "카드대금-삼성카드-명의B", day: 26, accountId: "acc-toss" }, // 계좌 일치
  ];
  const m2 = matchOutflowActuals(items2, samsung, TOL);
  eq("★계좌가 다른 명의A는 못 가져간다", m2.has("fixed:ownerA"), false);
  eq("★계좌가 맞는 명의B가 가져간다", m2.get("fixed:ownerB")?.amount, 1023968);

  // ⓒ 근사-정밀 — 변동금리 대출은 상호가 아예 달라도 몇십 원 차이면 잡는다(예: 90원 차이)
  const varLoan = [{ amount: 76_447, counterparty: "토스 대출 원금·이자 자동이체(0000)", txn_date: "2026-07-06", type: "payment", from_account_id: "acc-toss" }];
  // 계산 근거: 실납부 76,447 − 예정 76,357 = 90원 ≤ max(1,000원, 0.5%) → 근사-정밀로 잡힌다.
  const m3 = matchOutflowActuals([{ key: "loan:var", amount: 76357, label: "한빛_변동금리대출", day: 4, accountId: "acc-toss" }], varLoan, TOL);
  eq("★90원 차이 변동금리 대출납부를 잡는다(근사-정밀)", m3.get("loan:var")?.amount, 76_447);

  // ⓓ kb→국민 별칭 — 은행 원문 "KB카드" 가 "국민카드" 행에 닿는다
  const kb = [{ amount: 355516, counterparty: "KB카드 카드 (", txn_date: "2026-07-10", type: "payment", from_account_id: "acc-kb" }];
  const m4 = matchOutflowActuals([{ key: "fixed:kb", amount: 221734, label: "카드대금-국민카드-이바다", day: 10, accountId: "acc-kb" }], kb, TOL);
  eq("★'KB카드' 원문이 '국민카드' 행에 붙는다(별칭)", m4.get("fixed:kb")?.amount, 355516);

  // ⓔ ★expense 는 3패스 대상이 아니다 — 상호가 부분일치하는 항목이 남의 거래를 가져가는 오매칭(설계 108 후속)의 재발 방지.
  //   금액이 ±30% 넘게 다른 expense 는 상호가 부분일치해도 종전대로 안 붙는다.
  const kt = [{ amount: 40_000, counterparty: "KT", txn_date: "2026-07-21", type: "expense" }];
  const m5 = matchOutflowActuals([{ key: "fixed:skt", amount: 86232, label: "통신비-SKT", day: 26 }], kt, TOL);
  eq("★expense 는 금액 ±30% 초과면 종전대로 안 붙는다", m5.has("fixed:skt"), false);

  // ⓕ 날짜 가드는 3패스에도 걸린다 — 월초 payment 가 월말 예정 항목에 붙지 않는다
  const early = [{ amount: 500_000, counterparty: "몰라카드대금", txn_date: "2026-07-02", type: "payment", from_account_id: "acc-kb" }];
  const m6 = matchOutflowActuals([{ key: "fixed:late", amount: 499_000, label: "다른카드대금", day: 26, accountId: "acc-kb" }], early, TOL);
  eq("★월초 payment 가 월말 예정 항목에 안 붙는다(날짜 가드)", m6.has("fixed:late"), false);

  // ⓖ 계좌를 모르는 쪽이 있으면 게이트를 판정하지 않는다(등록 계좌가 낡은 경우 보호)
  const unknownAcc = [{ amount: 301487, counterparty: "한빛저축은행", txn_date: "2026-07-10", type: "payment", from_account_id: "acc-sb" }];
  const m7 = matchOutflowActuals([{ key: "loan:sb", amount: 298532, label: "대출상환-한빛저축은행", day: 10, accountId: null }], unknownAcc, TOL);
  eq("★항목 계좌 미지정이면 게이트 없이 종전대로 잡는다", m7.get("loan:sb")?.amount, 301487);

  // ⓗ 계좌를 **아는** 쪽끼리 다르면 안 붙는다 — ⓖ 의 짝(면제 아닌 쪽)을 함께 고정한다.
  //   ★대출이 이 게이트를 타는지는 여기서 정하지 않는다. 호출부(cashflow-snapshot)가 대출에는
  //   계좌를 아예 안 넘긴다 — 대출 원장의 계좌는 현재값 하나뿐이라 과거 달에 대면 시대착오라서다
  //   (설계 185 후속, 2026-08-19 결정). 그 종단 동작은 test_next_month_outflow §[16] 이 지킨다.
  //   여기 단위 테스트에 계좌를 손으로 먹이면 그 결정을 못 잡는다(2026-08-19 리뷰가 잡은 실수).
  const otherAcc = [{ amount: 301487, counterparty: "한빛저축은행", txn_date: "2026-07-10", type: "payment", from_account_id: "acc-sb-old" }];
  const m8 = matchOutflowActuals([{ key: "fixed:sb", amount: 298532, label: "대출상환-한빛저축은행", day: 10, accountId: "acc-sb" }], otherAcc, TOL);
  eq("★양쪽 계좌를 다 아는데 다르면 안 붙는다(게이트 본래 동작)", m8.has("fixed:sb"), false);
  const sameAcc = [{ amount: 301487, counterparty: "한빛저축은행", txn_date: "2026-07-10", type: "payment", from_account_id: "acc-sb" }];
  const m9 = matchOutflowActuals([{ key: "fixed:sb", amount: 298532, label: "대출상환-한빛저축은행", day: 10, accountId: "acc-sb" }], sameAcc, TOL);
  eq("계좌가 같으면 종전대로 잡는다", m9.get("fixed:sb")?.amount, 301487);
}

console.log("\n[9] 금액 단독 일치는 계좌가 맞는 항목이 우선한다 (설계 188)");
{
  // 막으려는 오매칭: 계좌 A 에서 나간 출금 100,000
  // (상대=계좌번호 원문이라 상호 대조 불가 — 픽스처는 합성 번호)이 계좌 B 에서 나갈
  // 같은 금액 항목(25일 예정)에 '출금됨'으로 붙는다. 같은 금액·같은 계좌(A)의
  // 진짜 주인은 당월보류라 배열 뒤에 있다.
  // ★하드 게이트(계좌 다르면 차단)는 기각 — 출금계좌를 바꾸기 전 달의 납부 실적이
  //   미출금으로 뒤집힌다(설계 185 와 같은 시대착오).
  //   대신 **정확금액 매칭 안에서 계좌 일치 짝을 먼저 확정**한다 — 경쟁자가 없으면 종전대로.
  const woori = [{ amount: 100_000, counterparty: "9990011122233", txn_date: "2026-08-24", type: "expense", account_id: "acc-woori" }];
  const items = [
    { key: "fixed:sec", amount: 100_000, label: "적금-한솔(증권)", day: 25, accountId: "acc-toss" },   // 계좌 불일치, 배열 앞
    { key: "fixed:chung", amount: 100_000, label: "적금-청약저축-합성", day: 25, accountId: "acc-woori" }, // 계좌 일치, 배열 뒤(보류)
  ];
  const m1 = matchOutflowActuals(items, woori, TOL);
  eq("★계좌가 맞는 항목이 배열 뒤(보류)여도 가져간다", m1.get("fixed:chung")?.amount, 100_000);
  eq("★계좌가 다른 항목은 빈칸으로 남는다", m1.has("fixed:sec"), false);

  // 경쟁자가 없으면 계좌가 달라도 종전대로 잡는다 — 계좌 전환 전 과거 달 실적 보호(설계 185 정신).
  const m2 = matchOutflowActuals([items[0]], woori, TOL);
  eq("★경쟁자가 없으면 계좌가 달라도 종전대로 잡는다(과거 실적 보호)", m2.get("fixed:sec")?.amount, 100_000);

  const noAcc = [{ amount: 100_000, counterparty: "9990011122233", txn_date: "2026-08-24", type: "expense" }];
  const m3 = matchOutflowActuals(items, noAcc, TOL);
  eq("거래 계좌 미상이면 우선순위 없이 종전대로(배열 앞이 가져감)", m3.get("fixed:sec")?.amount, 100_000);

  // 상호까지 맞으면(score 40) 계좌 우선순위보다 세다 — 낡은 등록계좌의 진짜 실적을 잃지 않는다.
  const named = [{ amount: 100_000, counterparty: "한솔 증권통장", txn_date: "2026-08-24", type: "expense", account_id: "acc-woori" }];
  const m4 = matchOutflowActuals(items, named, TOL);
  eq("★상호일치는 계좌 일치보다 우선한다", m4.get("fixed:sec")?.amount, 100_000);

  // 한 항목이 계좌 일치·불일치 거래를 다 볼 수 있으면 일치 쪽을 고른다.
  const two = [
    { amount: 100_000, counterparty: "1111111111111", txn_date: "2026-08-24", type: "expense", account_id: "acc-woori" },
    { amount: 100_000, counterparty: "2222222222222", txn_date: "2026-08-24", type: "expense", account_id: "acc-toss" },
  ];
  const m5 = matchOutflowActuals([items[0]], two, TOL);
  eq("★같은 금액이 여럿이면 자기 계좌 거래를 고른다", m5.get("fixed:sec")?.counterparty, "2222222222222");

  // ★payment 거래는 계좌 우선패스를 타지 않는다(적대적 리뷰 M1) — 대출은 호출부가 계좌를 안 넘겨
  //   정확금액 상한이 '미상'이라, 계좌일치 항목이 대출의 상환 거래(payment)를 가로채면 설계 185 의
  //   대출 실적 보호가 깨진다. payment 는 옛 동작(배열 순서) 그대로 둔다 — 막으려는 오귀속
  //   거래는 expense 라 수정 효과에는 지장이 없다.
  const loanPay = [{ amount: 300_000, counterparty: "1234567890123", txn_date: "2026-08-25", type: "payment", from_account_id: "acc-woori" }];
  const loanItems = [
    { key: "loan:a", amount: 300_000, label: "대출상환-합성", day: 25, accountId: null },      // 대출: 계좌 미상, 배열 앞
    { key: "fixed:b", amount: 300_000, label: "적금-합성", day: 25, accountId: "acc-woori" }, // 계좌 일치, 배열 뒤
  ];
  const m6 = matchOutflowActuals(loanItems, loanPay, TOL);
  eq("★payment 거래는 계좌일치 항목이 가로채지 못한다 — 대출(배열 앞)이 종전대로 가져간다", m6.get("loan:a")?.amount, 300_000);
  eq("  계좌일치 항목은 빈칸", m6.has("fixed:b"), false);

  // ★대출 상환이 expense 로 기록돼도 보호된다(교차검토 High) — 발급사명이 없는 계좌이체
  //   상환·약관대출 이자는 payment 가 아니라 expense 로 들어온다. 거래 타입이 아니라 **항목의
  //   accountBlind(대출)** 로 판정: 같은 금액의 대출이 경쟁에 있으면 그 금액은 세분하지 않는다
  //   (= 옛 배열 순서). 대출이 없는 금액에서만 계좌일치 우선패스가 작동한다.
  const loanExp = [{ amount: 300_000, counterparty: "1234567890123", txn_date: "2026-08-25", type: "expense", account_id: "acc-woori" }];
  const blindItems = [
    { key: "loan:a", amount: 300_000, label: "대출상환-합성", day: 25, accountId: null, accountBlind: true }, // 대출, 배열 앞
    { key: "fixed:b", amount: 300_000, label: "적금-합성", day: 25, accountId: "acc-woori" },               // 계좌 일치, 배열 뒤
  ];
  const m7 = matchOutflowActuals(blindItems, loanExp, TOL);
  eq("★expense 상환도 대출(배열 앞)이 종전대로 가져간다 — 계좌일치가 가로채지 못한다", m7.get("loan:a")?.amount, 300_000);
  eq("  계좌일치 항목은 빈칸으로 남는다", m7.has("fixed:b"), false);

  // 의도 고정(리뷰 M4): 활성 항목이 계좌 미상이고 보류 항목이 계좌 일치면 — **계좌 증거가 이긴다.**
  //   (설계 188 문서의 '남는 한계' 절에 공개된 트레이드오프. 대출은 위 accountBlind 로 별도 보호.)
  const pinItems = [
    { key: "fixed:unknown", amount: 100_000, label: "계좌미상-활성", day: 25, accountId: null },        // 배열 앞
    { key: "fixed:match", amount: 100_000, label: "계좌일치-보류", day: 25, accountId: "acc-woori" },  // 배열 뒤(보류)
  ];
  const m8 = matchOutflowActuals(pinItems, woori, TOL);
  eq("★계좌 미상 활성보다 계좌 일치 보류가 먼저다(의도 고정)", m8.get("fixed:match")?.amount, 100_000);

  // 의도 고정(리뷰 M5): 상호+근사(20)뿐인 항목은 정확금액+계좌일치(36) 항목에게 그 거래를 내준다.
  //   총 매칭 수가 줄 수 있는 공개된 트레이드오프 — 금액 우연(다른 항목 예정액 == 실거래액)이 필요해 드묾.
  const starveTxn = [{ amount: 500_000, counterparty: "BBB카드대금", txn_date: "2026-08-25", type: "expense", account_id: "acc-woori" }];
  const starveItems = [
    { key: "fixed:bbb", amount: 460_000, label: "BBB카드", day: 25, accountId: "acc-woori" },   // 상호+근사(20), 배열 앞
    { key: "fixed:ex", amount: 500_000, label: "무관항목", day: 25, accountId: "acc-woori" },   // 정확+계좌일치(36), 배열 뒤
  ];
  const m9 = matchOutflowActuals(starveItems, starveTxn, TOL);
  eq("★정확금액+계좌일치가 상호+근사보다 먼저다(의도 고정)", m9.get("fixed:ex")?.amount, 500_000);
  eq("  상호+근사 항목은 빈칸(공개된 트레이드오프)", m9.has("fixed:bbb"), false);
}

// ★[9]는 matchOutflowActuals 의 성질만 본다 — 호출부가 계좌를 안 넘기면 옛 코드로 되돌려도
//   통과한다(개발 규칙). 그래서 cashflowSnapshot 을 통째로 돌려 종단으로도 고정한다.
console.log("\n[10] cashflowSnapshot 종단 — 보류 중인 진짜 주인(계좌 일치)이 거래를 가져간다 (설계 188)");
{
  const { cashflowSnapshot } = await import("../src/lib/household/cashflow-snapshot");
  const MONTH = "2026-08";
  const OWNER = "owner-1";
  const sp = (id: string, title: string, amount: number, day: number, accountId: string) =>
    ({
      id, owner_auth_uid: OWNER, title, direction: "out", amount, frequency: "monthly", pay_day: day,
      account_id: accountId, category_id: "cat-1", is_active: true, start_date: null, end_date: null,
      person_id: null, memo: null, sort_order: 0, created_at: "", updated_at: "",
    }) as never;
  // 축약 재현: 활성 항목(acc-toss)과 당월보류 항목(acc-woori)이 같은 금액·같은 날.
  const scheduled = [
    sp("sp-sec", "적금-한솔(증권)", 100_000, 25, "acc-toss"),
    sp("sp-chung", "적금-청약저축-합성", 100_000, 25, "acc-woori"),
  ];
  const released = {
    id: "ov-chung", owner_auth_uid: OWNER, year_month: MONTH, source_kind: "fixed", source_id: "sp-chung",
    amount_override: null, account_id: null, released: true, day_override: null, paid_override: null,
    created_at: "", updated_at: "",
  } as never;
  const wooriTxn = { amount: 100_000, counterparty: "9990011122233", txn_date: "2026-08-24", type: "expense", account_id: "acc-woori" };
  const base = {
    scheduled, loans: [], installments: [], txns: [], methods: [],
    recentOutflows: [
      // 전월 실적(두 항목 다 표에 남도록) + 이번 달 acc-woori 출금 1건.
      { amount: 100_000, counterparty: "한솔 증권통장", txn_date: "2026-07-26", type: "expense", account_id: "acc-toss" },
      { amount: 100_000, counterparty: "청약저축", txn_date: "2026-07-25", type: "expense", account_id: "acc-woori" },
      wooriTxn,
    ],
    totalCash: 10_000_000, horizon: 3, accountIds: ["acc-toss", "acc-woori"],
    overrides: [released], nextOverrides: [],
  };
  const snap = cashflowSnapshot(MONTH, base as never);
  const byKey = (k: string) => snap.classified.find((i: { key: string }) => i.key === k);
  eq("★활성 항목(다른 계좌)에 '출금됨'이 안 붙는다(빈칸)", byKey("fixed:sp-sec")?.paidAmount ?? null, null);
  eq("★보류 중인 같은 계좌 항목이 그 거래를 가져간다", byKey("fixed:sp-chung")?.paidAmount, 100_000);
}

console.log("\n[229] 변동금액 카테고리(통신비) — 같은 카테고리·같은 결제 경로면 금액이 달라도 붙는다 (값은 가상)");
{
  const CAT_TEL = "cat-tel";
  const CAT_FOOD = "cat-food";
  // 통신비 항목: 등록액 55,000, 국민은행 통장(acc-kb)에서 자동이체.
  const tel = { key: "fixed:tel", amount: 55_000, label: "통신비-김하늘", day: 20, accountId: "acc-kb", flexCategoryId: CAT_TEL, paymentMethodId: null };
  const bill = (over: Record<string, unknown>) => ({ amount: 121_300, counterparty: "한빛통신료(000000)", txn_date: "2026-10-20", type: "expense", account_id: "acc-kb", category_id: CAT_TEL, ...over });

  eq("★소액결제가 합산된 청구(등록액의 2.2배)도 같은 카테고리·계좌면 붙는다", matchOutflowActuals([tel], [bill({})], TOL).get("fixed:tel")?.amount, 121_300);
  eq("카테고리가 다르면 안 붙는다", matchOutflowActuals([tel], [bill({ category_id: CAT_FOOD })], TOL).has("fixed:tel"), false);
  eq("거래에 카테고리가 없으면 안 붙는다", matchOutflowActuals([tel], [bill({ category_id: null })], TOL).has("fixed:tel"), false);
  eq("★출금계좌가 다르면 안 붙는다(같은 결제 경로만)", matchOutflowActuals([tel], [bill({ account_id: "acc-toss" })], TOL).has("fixed:tel"), false);
  eq("등록액의 4배를 넘으면 안 붙는다", matchOutflowActuals([tel], [bill({ amount: 230_000 })], TOL).has("fixed:tel"), false);
  eq("등록액의 1/4 미만이면 안 붙는다", matchOutflowActuals([tel], [bill({ amount: 13_000 })], TOL).has("fixed:tel"), false);
  eq("변동금액 표식이 없는 항목은 종전대로 안 붙는다", matchOutflowActuals([{ ...tel, flexCategoryId: null }], [bill({})], TOL).has("fixed:tel"), false);
  eq("payment 거래는 이 패스로 받지 않는다", matchOutflowActuals([tel], [bill({ type: "payment" })], TOL).has("fixed:tel"), false);

  // 같은 카테고리·같은 경로 항목이 둘이면 어느 항목의 거래인지 증명하지 못한다 → 둘 다 빈칸.
  const tel2 = { ...tel, key: "fixed:tel2", amount: 33_000, label: "통신비-이바다" };
  const both = matchOutflowActuals([tel, tel2], [bill({})], TOL);
  eq("★같은 경로의 통신비 항목이 둘이면 변동금액 패스를 쓰지 않는다", both.size, 0);
  // 경로가 다르면(다른 계좌) 각자 자기 거래를 받는다.
  const tel3 = { ...tel2, accountId: "acc-toss" };
  const each = matchOutflowActuals([tel, tel3], [bill({}), bill({ amount: 70_000, account_id: "acc-toss" })], TOL);
  eq("경로가 다른 두 항목은 각자 자기 계좌 거래를 받는다(김하늘)", each.get("fixed:tel")?.amount, 121_300);
  eq("경로가 다른 두 항목은 각자 자기 계좌 거래를 받는다(이바다)", each.get("fixed:tel2")?.amount, 70_000);

  // 카드로 내는 통신비 항목은 결제수단으로 경로를 본다.
  const telCard = { key: "fixed:telc", amount: 55_000, label: "통신비-김하늘", day: 20, flexCategoryId: CAT_TEL, paymentMethodId: "pm-samsung" };
  const cardBill = bill({ account_id: null, payment_method_id: "pm-samsung" });
  eq("카드 항목은 같은 카드 결제를 받는다", matchOutflowActuals([telCard], [cardBill], TOL).get("fixed:telc")?.amount, 121_300);
  eq("★카드 항목은 다른 수단으로 나간 통신비를 가져가지 않는다", matchOutflowActuals([telCard], [bill({ account_id: null, payment_method_id: "pm-other" })], TOL).has("fixed:telc"), false);

  // 정확금액·상호 일치가 먼저다 — 변동금액 패스(15)는 2패스(20) 뒤에 돈다.
  const exactFirst = matchOutflowActuals([tel], [bill({}), bill({ amount: 55_000 })], TOL);
  eq("정확금액 거래가 있으면 그쪽이 이긴다", exactFirst.get("fixed:tel")?.amount, 55_000);

  // 공용 헬퍼: 변동금액 카테고리 집합에 든 항목만 표식을 단다. 대출은 달지 않는다.
  const flex = new Set([CAT_TEL]);
  const base = { key: "k", sourceId: "k", amount: 55_000, label: "통신비", day: 20, accountId: "acc-kb" };
  eq("헬퍼: 통신비 고정비는 표식을 단다", toOutflowMatchItem({ ...base, sourceKind: "fixed", categoryId: CAT_TEL }, flex).flexCategoryId, CAT_TEL);
  eq("헬퍼: 다른 카테고리는 달지 않는다", toOutflowMatchItem({ ...base, sourceKind: "fixed", categoryId: CAT_FOOD }, flex).flexCategoryId, null);
  eq("헬퍼: 집합을 안 주면 종전 동작", toOutflowMatchItem({ ...base, sourceKind: "fixed", categoryId: CAT_TEL }).flexCategoryId, null);
  eq("헬퍼: 대출은 달지 않는다", toOutflowMatchItem({ ...base, sourceKind: "loan", categoryId: CAT_TEL }, flex).flexCategoryId, null);

  const { variableAmountCategoryIds } = await import("../src/lib/household/calc");
  eq("카테고리 이름 '통신비'만 고른다", variableAmountCategoryIds([{ id: "a", name: "통신비" }, { id: "b", name: "식비" }]).join(","), "a");
}

console.log("\n[12] 예정일 전 항목은 상호까지 맞는 거래만 '출금됨'(설계 212) (값은 가상)");
{
  // 24일 예정 용돈 70,000 에, 나흘 앞서 나간 같은 금액의 주유비가 붙으면 안 된다.
  const allowance = { key: "fixed:yd", amount: 70_000, label: "용돈-이바다", day: 24 };
  const fuel = [{ amount: 70_000, counterparty: "한빛주유소", txn_date: "2026-06-20", type: "expense" }];
  eq("★예정일(24) 전, 금액만 같은 주유비 = 안 붙는다", matchOutflowActuals([allowance], fuel, { ...TOL, todayDay: 20 }).has("fixed:yd"), false);
  eq("  todayDay 를 안 주면 종전대로 붙는다(과거 달 호환)", matchOutflowActuals([allowance], fuel, TOL).has("fixed:yd"), true);
  eq("  예정일 당일부터는 금액만으로도 붙는다", matchOutflowActuals([allowance], fuel, { ...TOL, todayDay: 24 }).has("fixed:yd"), true);
  const early = [{ amount: 70_000, counterparty: "이바다", txn_date: "2026-06-20", type: "expense" }];
  eq("  예정일 전이라도 상호까지 맞으면(선납) 붙는다", matchOutflowActuals([allowance], early, { ...TOL, todayDay: 20 }).has("fixed:yd"), true);

  // 동점이면 예정일에 가까운 거래 — 예정일이 지나는 순간 며칠 앞선 남의 동일금액 거래가 먼저 붙지 않게.
  const save = { key: "fixed:sv", amount: 150_000, label: "적금-이바다(청약)", day: 27 };
  const two = [
    { amount: 150_000, counterparty: "0000111122223", txn_date: "2026-06-22", type: "expense" },
    { amount: 150_000, counterparty: "0000111122224", txn_date: "2026-06-27", type: "expense" },
  ];
  eq("★동점이면 예정일(27)에 가까운 6/27 거래", matchOutflowActuals([save], two, { ...TOL, todayDay: 28 }).get("fixed:sv")?.txn_date, "2026-06-27");

  const { todayDayIn } = await import("../src/lib/household/cashflow-snapshot");
  eq("todayDayIn: 이번 달이면 오늘 일자", todayDayIn("2026-06", "2026-06-20"), 20);
  eq("todayDayIn: 다른 달이면 걸지 않는다", todayDayIn("2026-05", "2026-06-20"), undefined);
  eq("todayDayIn: today 미지정이면 걸지 않는다", todayDayIn("2026-06"), undefined);
  eq("★todayDayIn: 30일 달 말일이면 31(청구일 31일 항목도 도래)", todayDayIn("2026-06", "2026-06-30"), 31);
  eq("  todayDayIn: 2월 말일(28)도 31", todayDayIn("2026-02", "2026-02-28"), 31);
  eq("  todayDayIn: 말일 전날은 그대로", todayDayIn("2026-06", "2026-06-29"), 29);
  eq("  day 31 항목 + 30일 말일 → 금액만으로도 붙는다", matchOutflowActuals([{ ...allowance, day: 31 }], fuel.map((t) => ({ ...t, txn_date: "2026-06-30" })), { ...TOL, todayDay: todayDayIn("2026-06", "2026-06-30") }).has("fixed:yd"), true);

  // 종단 — cashflowSnapshot 이 today 를 매칭까지 넘기는지(배선을 지우면 빨갛게 된다).
  const { cashflowSnapshot } = await import("../src/lib/household/cashflow-snapshot");
  const sp = {
    id: "sp-yd", owner_auth_uid: "o", title: "용돈-이바다", direction: "out", amount: 70_000, frequency: "monthly", pay_day: 24,
    account_id: "acc-w", category_id: "cat-1", is_active: true, start_date: null, end_date: null,
    person_id: null, memo: null, sort_order: 0, created_at: "", updated_at: "",
  };
  const base = {
    scheduled: [sp], loans: [], installments: [], txns: [], methods: [], overrides: [], nextOverrides: [],
    recentOutflows: [
      { amount: 70_000, counterparty: "한빛주유소", txn_date: "2026-06-20", type: "expense", account_id: "acc-w" },
      { amount: 70_000, counterparty: "이바다", txn_date: "2026-05-24", type: "expense", account_id: "acc-w" },
    ],
    totalCash: 1_000_000, horizon: 1, accountIds: ["acc-w"],
  };
  const paidOf = (today?: string) =>
    cashflowSnapshot("2026-06", { ...base, today } as never).classified.find((i: { key: string }) => i.key === "fixed:sp-yd")?.paidAmount ?? null;
  eq("★스냅샷 종단: 오늘 6/20 이면 용돈 미출금", paidOf("2026-06-20"), null);
  eq("  스냅샷 종단: today 미지정이면 종전대로 출금됨", paidOf(), 70_000);

  // 카드 결제분 행(cardPaidByKey)에도 today 가 걸리는지 — 배선을 지우면 빨갛게 된다.
  const cardItem = {
    key: "fixed:card", sourceKind: "fixed", sourceId: "card", kind: "fixed", label: "학원비-한빛수학-이바다",
    categoryId: null, day: 24, naturalDay: 24, dayOverridden: false, amount: 280_000,
    accountId: null, paymentMethodId: "pm-credit", cardCharge: true,
    baseCardCharge: true, baseAccountId: null, methodOverridden: false, released: false,
    paidOverride: null, paidAmount: null, reason: null, amountOverridden: false, remainingAmount: 280_000, paidPartial: false,
  } as const;
  const cardTxn = {
    amount: 280_000, counterparty: "다른가맹점", txn_date: "2026-06-20", type: "expense" as const,
    account_id: null, from_account_id: null, to_account_id: null, payment_method_id: "pm-credit",
  };
  const cardOf = (today?: string) =>
    computeCashMatches({
      month: "2026-06", classified: [cardItem], paidThisMonth: new Map(), recentOutflows: [cardTxn],
      accounts: [], methods: [{ id: "pm-credit", kind: "credit" }], today,
    }).cardPaidByKey.get("fixed:card")?.amount ?? null;
  eq("★카드 행: 예정일(24) 전, 상호 안 맞는 카드 결제 = 결제금액 안 붙음", cardOf("2026-06-20"), null);
  eq("  카드 행: today 미지정이면 종전대로 붙음", cardOf(), 280_000);
}

console.log("\n[216] 대출 항목은 자기 대출에 연결된(loan_id) 상환을 먼저 받는다(설계 216) (값은 가상)");
{
  // 대출 이름과 거래 상호가 달라 자기 상환(3,985, loan_id 연결)을 못 받고 금액만 같은 소액 거래(4,000)를 가져가는 경우.
  const loanItem = { key: "loan:hd", amount: 4_000, label: "약관대출-한빛생명-김하늘", day: 24, accountId: null, accountBlind: true, loanId: "loan-hd" };
  const other = { amount: 4_000, counterparty: "별빛 코인노래방", txn_date: "2026-06-22", type: "expense", account_id: "acc-kb" };
  const repay = { amount: 3_985, counterparty: "한빛약대이자", txn_date: "2026-06-27", type: "payment", from_account_id: "acc-toss", loan_id: "loan-hd" };
  const at28 = { ...TOL, todayDay: 28 };
  eq("★loan_id 연결 상환 3,985 가 정확금액 남의 거래 4,000 을 이긴다", matchOutflowActuals([loanItem], [other, repay], at28).get("loan:hd")?.counterparty, "한빛약대이자");
  eq("  loan_id 가 없으면 종전대로 정확금액", matchOutflowActuals([loanItem], [other, { ...repay, loan_id: null }], at28).get("loan:hd")?.counterparty, "별빛 코인노래방");
  eq("  다른 대출의 loan_id 는 우선권이 없다", matchOutflowActuals([loanItem], [other, { ...repay, loan_id: "loan-x" }], at28).get("loan:hd")?.counterparty, "별빛 코인노래방");

  // ★같은 대출을 대출 원장(21,400)과 정기지출 두 줄(19,700·3,100)에 함께 등록한 경우 — 같은 loan_id 상환을 두고 겹친다.
  //   대출 항목이 가져가면 정기지출이 미출금이 되고 두 번 계산된다.
  const master = { key: "loan:db", amount: 21_400, label: "보험계약대출-김", day: 5, accountId: null, accountBlind: true, loanId: "loan-db" };
  const fx1 = { key: "fixed:db1", amount: 19_700, label: "대출상환-한빛손보 약대-김하", day: 5, accountId: "acc-kb" };
  const fx2 = { key: "fixed:db2", amount: 3_100, label: "대출상환-한빛손보 약대2-김하", day: 5, accountId: "acc-kb" };
  const t1 = { amount: 19_700, counterparty: "한빛손보약대 공동CMS", txn_date: "2026-06-07", type: "payment", from_account_id: "acc-kb", loan_id: "loan-db" };
  const t2 = { amount: 3_100, counterparty: "한빛손보약대 공동CMS", txn_date: "2026-06-07", type: "payment", from_account_id: "acc-kb", loan_id: "loan-db" };
  const db = matchOutflowActuals([master, fx1, fx2], [t1, t2], TOL);
  eq("★정기지출(19,700)은 자기 거래를 지킨다", db.get("fixed:db1")?.amount, 19_700);
  eq("★정기지출(3,100)은 자기 거래를 지킨다", db.get("fixed:db2")?.amount, 3_100);
  eq("★대출 항목은 허용폭 밖 loan_id 거래를 빼앗지 않는다", db.has("loan:db"), false);

  // ★월납이 올라 대출 항목의 허용폭 안(20,500~20,900)에 들어와도 정기지출이 지킨다 — 금액차가 아니라
  //   구조(정기지출이 상호+근사로 주장하는 거래는 0패스 후보에서 뺀다)로 막는다.
  for (const amt of [20_500, 20_510, 20_900]) {
    const drift = matchOutflowActuals([master, fx1, fx2], [{ ...t1, amount: amt }, t2], TOL);
    eq(`★월납 ${amt} 변동: 정기지출이 받는다`, drift.get("fixed:db1")?.amount, amt);
    eq(`  월납 ${amt} 변동: 대출 항목은 못 받는다`, drift.has("loan:db"), false);
  }
  // ★최근 3개월 풀에 같은 대출 상환이 여러 달 있으면, 정기지출이 한 달치를 받은 뒤 남은 달치를 대출 항목이
  //   payment 특례(10)로 가져가 둘 다 '최근 실적 있음' → 예측 이중계상. 특례도 막는다.
  const pool3 = ["2026-04-07", "2026-05-07", "2026-06-07"].map((d) => ({ ...t1, amount: 20_500, txn_date: d }));
  eq("★3개월 풀: 정기지출이 받고 남은 달치를 대출 항목이 payment 특례로 못 가져간다",
    matchOutflowActuals([master, fx1], pool3).has("loan:db"), false);
  // 소액: 대출 4,000 과 정기지출 3,100 이 같은 loan_id 거래(3,100, 정확금액)를 두고 겹칠 때 — 정기지출이 받는다.
  const small = matchOutflowActuals(
    [{ ...loanItem, key: "loan:s" }, { key: "fixed:s", amount: 3_100, label: "보험료 자동이체", day: 24, accountId: null }],
    [{ ...repay, amount: 3_100, loan_id: "loan-hd" }],
    at28,
  );
  eq("★소액 겹침: 정확금액 정기지출이 loan_id 거래를 지킨다", small.has("fixed:s"), true);
  eq("  소액 겹침: 대출 항목은 비어 있다", small.has("loan:s"), false);

  // 허용폭 조건: 같은 대출에 연결됐어도 금액이 크게 다른 중도상환(900,000)은 월납 280,000 항목의 '출금됨'이 아니다.
  const monthly = { key: "loan:m", amount: 280_000, label: "대출상환-예시", day: 24, accountId: null, accountBlind: true, loanId: "loan-m" };
  eq("★연결됐지만 금액이 크게 다른 중도상환은 0패스로 붙지 않는다",
    matchOutflowActuals([monthly], [{ amount: 900_000, counterparty: "중도상환", txn_date: "2026-06-26", type: "expense", loan_id: "loan-m" }], at28).has("loan:m"), false);

  // ★loan_id 는 '어느 달 몫'을 증명하지 못한다 — score 50 도 날짜 가드를 받는다.
  const late = { ...repay, txn_date: "2026-07-01" }; // 지난달분이 주말로 1일에 밀려 나감
  const endItem = { ...loanItem, day: 30 };
  eq("★월말 예정 대출: 전달분이 1일에 밀려 나간 상환은 오늘 5일에 '출금됨'이 안 된다(예정일 전 가드)",
    matchOutflowActuals([endItem], [late], { ...TOL, todayDay: 5 }).has("loan:hd"), false);
  eq("★월말 예정 대출: 오늘 미지정(과거 달)이어도 5일 넘게 이른 연결 상환은 안 붙는다(조기 가드)",
    matchOutflowActuals([endItem], [late], TOL).has("loan:hd"), false);
  eq("  예정일 지난 뒤의 연결 상환은 종전대로 붙는다",
    matchOutflowActuals([endItem], [{ ...repay, txn_date: "2026-07-30" }], { ...TOL, todayDay: 31 }).get("loan:hd")?.amount, 3_985);
}

console.log("\n[218] 카드대금 부분 납부(선결제) — 낸 만큼만 출금, 남은 금액은 미지급으로 남는다 (값은 가상)");
{
  // 25일 예정 1,318,400(확정액) 중 5/4 에 700,000 을 미리 낸 경우 — 본 매칭은 날짜 가드로 못 붙인다.
  const { cashflowSnapshot } = await import("../src/lib/household/cashflow-snapshot");
  const MONTH = "2026-05";
  const OWNER = "owner-1";
  const sp = (id: string, title: string, amount: number, day: number, account: string) =>
    ({
      id, owner_auth_uid: OWNER, title, direction: "out", amount, frequency: "monthly", pay_day: day,
      account_id: account, category_id: "cat-bill", is_active: true, start_date: null, end_date: null,
      person_id: null, memo: null, sort_order: 0, created_at: "", updated_at: "",
    }) as never;
  const ov = (id: string, sourceId: string, extra: Record<string, unknown>) =>
    ({
      id, owner_auth_uid: OWNER, year_month: MONTH, source_kind: "fixed", source_id: sourceId,
      amount_override: null, account_id: null, released: false, day_override: null, paid_override: null,
      created_at: "", updated_at: "", ...extra,
    }) as never;
  const pay = (amount: number, counterparty: string, date: string, acc: string) =>
    ({ amount, counterparty, txn_date: date, type: "payment", account_id: null, from_account_id: acc, to_account_id: null, payment_method_id: null });

  const scheduled = [
    sp("sp-a", "카드대금-삼성카드-김하늘", 1_240_000, 25, "acc-a"),
    sp("sp-b", "카드대금-삼성카드-이바다", 610_000, 10, "acc-b"),
  ];
  const lastMonth = [pay(1_180_000, "삼성카드", "2026-04-27", "acc-a"), pay(590_000, "삼성카드", "2026-04-10", "acc-b")];
  const prepay = pay(700_000, "삼성카드", "2026-05-04", "acc-a");
  const confirmed = ov("ov-a", "sp-a", { amount_override: 1_318_400 });
  const snapOf = (outflows: unknown[], overrides: unknown[] = [confirmed], today = "2026-05-04") =>
    cashflowSnapshot(MONTH, {
      scheduled, loans: [], installments: [], txns: [], methods: [],
      recentOutflows: [...lastMonth, ...outflows], totalCash: 10_000_000, horizon: 3,
      accountIds: ["acc-a", "acc-b"], overrides, nextOverrides: [], today,
    } as never);
  type Row = { key: string; paidAmount: number | null; remainingAmount: number; paidPartial: boolean };
  const itemOf = (snap: { classified: unknown[] }, k: string) => (snap.classified as Row[]).find((i) => i.key === k);

  // (a) 선결제 1건 → 부분 납부
  const s1 = snapOf([prepay]);
  eq("★(a) 선결제가 붙는다: 출금 700,000", itemOf(s1, "fixed:sp-a")?.paidAmount, 700_000);
  eq("★(a) 남은 금액 618,400 은 미지급으로 남는다", itemOf(s1, "fixed:sp-a")?.remainingAmount, 618_400);
  eq("  (a) 부분 납부 표식", itemOf(s1, "fixed:sp-a")?.paidPartial, true);
  eq("★(a) 미지급 합계에 남은 금액만 든다(이바다 610,000 + 618,400)", s1.pendingOutAll, 610_000 + 618_400);
  eq("  (a) 지급 합계는 실제 낸 돈", s1.paidOutAll, 700_000);
  // (f) 익월 기본값은 낸 합계가 아니라 예정금액
  const nextA = (s1.nextItems as { key: string; amount: number }[]).find((i) => i.key === "fixed:sp-a");
  eq("★(f) 부분 납부면 익월 기본값 = 당월 예정금액(1,318,400), 낸 합계 아님", nextA?.amount, 1_318_400);

  // (b) 나머지 납부 → 완납
  const s2 = snapOf([prepay, pay(618_400, "삼성카드", "2026-05-25", "acc-a")], [confirmed], "2026-05-25");
  eq("★(b) 나머지까지 내면 합계 1,318,400 완납", itemOf(s2, "fixed:sp-a")?.paidAmount, 1_318_400);
  eq("★(b) 완납이면 남은 금액 0", itemOf(s2, "fixed:sp-a")?.remainingAmount, 0);
  eq("  (b) 완납은 부분 납부 아님", itemOf(s2, "fixed:sp-a")?.paidPartial, false);

  // (c) 수기 출금금액도 같은 뜻 — 0 은 미출금
  const s3 = snapOf([], [ov("ov-a", "sp-a", { amount_override: 1_318_400, paid_override: 700_000 })]);
  eq("★(c) 수기 출금금액 700,000 → 부분 납부, 남은 618,400", itemOf(s3, "fixed:sp-a")?.remainingAmount, 618_400);
  const s4 = snapOf([prepay], [ov("ov-a", "sp-a", { amount_override: 1_318_400, paid_override: 0 })]);
  eq("  (c) 수기 0 = 미출금(설계 65 2차) — 예정금액 전부 남음", itemOf(s4, "fixed:sp-a")?.remainingAmount, 1_318_400);

  // (d) 다른 명의 계좌의 같은 카드사 납부는 안 붙는다
  const s5 = snapOf([pay(400_000, "삼성카드", "2026-05-06", "acc-b")]);
  eq("★(d) 다른 계좌의 삼성카드 납부는 김하늘 항목에 안 붙는다", itemOf(s5, "fixed:sp-a")?.paidAmount ?? null, null);

  // (e) 다른 카드사 납부는 안 붙는다
  const s6 = snapOf([pay(400_000, "롯데카드", "2026-05-06", "acc-a")]);
  eq("★(e) 롯데카드 납부는 삼성카드 항목에 안 붙는다", itemOf(s6, "fixed:sp-a")?.paidAmount ?? null, null);

  // (g) 종전 완납(본 매칭 1건, 확정액과 같음)은 그대로
  const s7 = snapOf([pay(1_318_400, "삼성카드", "2026-05-25", "acc-a")], [confirmed], "2026-05-25");
  eq("★(g) 확정액 그대로 낸 달은 종전대로 완납", itemOf(s7, "fixed:sp-a")?.remainingAmount, 0);
  eq("  (g) 출금금액도 종전 그대로", itemOf(s7, "fixed:sp-a")?.paidAmount, 1_318_400);
  // (g2) 청구액 확정 전(추정액)이면 덜 낸 것처럼 보여도 부분 납부로 보지 않는다 — 추정은 "덜 냈다"의 근거가 못 된다
  const s8 = snapOf([pay(1_000_000, "삼성카드", "2026-05-25", "acc-a")], [], "2026-05-25");
  eq("★(g2) 추정액 1,240,000 · 1,000,000 납부(확정 전)는 완납", itemOf(s8, "fixed:sp-a")?.remainingAmount, 0);

  // (h) 지난달 납부가 없었으면 월초 거래는 지난달 몫일 수 있어 받지 않는다(설계 216 과 같은 논리)
  const noLast = cashflowSnapshot(MONTH, {
    scheduled, loans: [], installments: [], txns: [], methods: [],
    recentOutflows: [pay(1_180_000, "삼성카드", "2026-05-02", "acc-a")], totalCash: 10_000_000, horizon: 3,
    accountIds: ["acc-a", "acc-b"], overrides: [confirmed], nextOverrides: [], today: "2026-05-04",
  } as never);
  eq("★(h) 지난달 납부 없음 + 월초(5/2) 납부 → 이번 달 몫으로 안 본다", itemOf(noLast, "fixed:sp-a")?.paidAmount ?? null, null);
  // (h2) 지난달 납부가 있었으면 월초 거래는 선결제
  const s9 = snapOf([pay(250_000, "삼성카드", "2026-05-02", "acc-a")]);
  eq("  (h2) 지난달 납부가 있으면 월초 납부는 선결제로 붙는다", itemOf(s9, "fixed:sp-a")?.paidAmount, 250_000);

  // (i) 카드대금 아닌 항목은 부분 납부가 없다 — 수기 출금금액이 예정보다 적어도 종전대로 완납
  const misc = cashflowSnapshot(MONTH, {
    scheduled: [sp("sp-m", "관리비-한빛아파트", 240_000, 25, "acc-a")], loans: [], installments: [], txns: [], methods: [],
    recentOutflows: [{ amount: 240_000, counterparty: "한빛아파트", txn_date: "2026-04-25", type: "expense", from_account_id: "acc-a" }],
    totalCash: 10_000_000, horizon: 3, accountIds: ["acc-a"],
    overrides: [ov("ov-m", "sp-m", { amount_override: 240_000, paid_override: 90_000 })], nextOverrides: [], today: "2026-05-25",
  } as never);
  eq("★(i) 카드대금 아닌 항목은 수기 출금금액이 적어도 남은 금액 0(종전)", itemOf(misc, "fixed:sp-m")?.remainingAmount, 0);
}

console.log("\n[218-2] 안 붙여야 할 것을 붙이지 않는다 — 확정 전 추정액 · 카드론 상환 · 완납한 달의 소액 납부");
{
  const { cashflowSnapshot } = await import("../src/lib/household/cashflow-snapshot");
  const OWNER = "owner-1";
  const sp = (id: string, title: string, amount: number, day: number, account: string) =>
    ({
      id, owner_auth_uid: OWNER, title, direction: "out", amount, frequency: "monthly", pay_day: day,
      account_id: account, category_id: "cat-bill", is_active: true, start_date: null, end_date: null,
      person_id: null, memo: null, sort_order: 0, created_at: "", updated_at: "",
    }) as never;
  const ov = (month: string, sourceId: string, extra: Record<string, unknown>) =>
    ({
      id: `ov-${sourceId}`, owner_auth_uid: OWNER, year_month: month, source_kind: "fixed", source_id: sourceId,
      amount_override: null, account_id: null, released: false, day_override: null, paid_override: null,
      created_at: "", updated_at: "", ...extra,
    }) as never;
  const pay = (amount: number, counterparty: string, date: string, acc: string, loan_id: string | null = null) =>
    ({ amount, counterparty, txn_date: date, type: "payment", account_id: null, from_account_id: acc, to_account_id: null, payment_method_id: null, loan_id });
  type Row = { key: string; paidAmount: number | null; remainingAmount: number; paidPartial: boolean };
  const run = (month: string, scheduled: unknown[], outflows: unknown[], overrides: unknown[], today?: string) =>
    (cashflowSnapshot(month, {
      scheduled, loans: [], installments: [], txns: [], methods: [], recentOutflows: outflows,
      totalCash: 10_000_000, horizon: 3, accountIds: ["acc-a", "acc-b"], overrides, nextOverrides: [], today,
    } as never).classified as Row[]);

  // (j) 확정 전 추정액: 추정 1,520,000 · 실제 청구 960,000 완납 → 부분 납부 아님
  const j = run("2026-03", [sp("hd", "카드대금-현대카드-이바다", 1_520_000, 1, "acc-b")],
    [pay(1_090_000, "현대카드대금", "2026-02-03", "acc-b"), pay(960_000, "현대카드대금", "2026-03-02", "acc-b")], [], "2026-03-31");
  eq("★(j) 확정 전 추정액보다 적게 낸 달은 완납(남은 금액 0)", j.find((i) => i.key === "fixed:hd")?.remainingAmount, 0);
  eq("  (j) 출금금액은 종전 그대로 960,000", j.find((i) => i.key === "fixed:hd")?.paidAmount, 960_000);
  // (j2) 확정 전이면 선결제도 종전대로 안 붙는다(예정일 전 · 날짜 가드)
  const j2 = run("2026-05", [sp("sa", "카드대금-삼성카드-김하늘", 1_240_000, 25, "acc-a")],
    [pay(1_180_000, "삼성카드", "2026-04-27", "acc-a"), pay(700_000, "삼성카드", "2026-05-04", "acc-a")], [], "2026-05-04");
  eq("★(j2) 청구액 미확정이면 선결제는 종전대로 미출금", j2.find((i) => i.key === "fixed:sa")?.paidAmount ?? null, null);

  // (k) 카드론 상환(loan_id 연결)은 같은 상호·계좌여도 카드대금에 더하지 않는다
  const k = run("2026-03", [sp("sa", "카드대금-삼성카드-김하늘", 1_240_000, 25, "acc-a")],
    [pay(1_150_000, "삼성카드", "2026-02-25", "acc-a"), pay(480_000, "삼성카드", "2026-03-04", "acc-a", "loan-card"), pay(800_000, "삼성카드", "2026-03-19", "acc-a")],
    [ov("2026-03", "sa", { amount_override: 1_275_000 })], "2026-03-20");
  eq("★(k) 카드론 상환은 빼고 선결제 800,000 만 합산", k.find((i) => i.key === "fixed:sa")?.paidAmount, 800_000);

  // (l) 한 건으로 이미 완납한 달엔 같은 카드사 월초 소액 납부를 더하지 않는다
  const l = run("2026-03", [sp("kb", "카드대금-국민카드-이바다", 215_000, 10, "acc-b")],
    [pay(330_000, "KB카드", "2026-02-10", "acc-b"), pay(6_200, "KB카드", "2026-03-04", "acc-b"), pay(215_000, "KB카드", "2026-03-10", "acc-b")],
    [ov("2026-03", "kb", { amount_override: 215_000 })], "2026-03-31");
  eq("★(l) 완납한 달의 출금금액은 본 매칭 한 건 그대로(소액 납부 안 얹음)", l.find((i) => i.key === "fixed:kb")?.paidAmount, 215_000);
}

console.log("\n[218-3] 명의가 애매한 납부는 합산하지 않는다 · 예측·월말잔액도 남은 금액만");
{
  const { cashflowSnapshot } = await import("../src/lib/household/cashflow-snapshot");
  const OWNER = "owner-1";
  const MONTH = "2026-05";
  const sp = (id: string, title: string, amount: number, day: number, account: string | null) =>
    ({
      id, owner_auth_uid: OWNER, title, direction: "out", amount, frequency: "monthly", pay_day: day,
      account_id: account, category_id: "cat-bill", is_active: true, start_date: null, end_date: null,
      person_id: null, memo: null, sort_order: 0, created_at: "", updated_at: "",
    }) as never;
  const ov = (sourceId: string, extra: Record<string, unknown>) =>
    ({
      id: `ov-${sourceId}`, owner_auth_uid: OWNER, year_month: MONTH, source_kind: "fixed", source_id: sourceId,
      amount_override: null, account_id: null, released: false, day_override: null, paid_override: null,
      created_at: "", updated_at: "", ...extra,
    }) as never;
  const pay = (amount: number, counterparty: string, date: string, acc: string) =>
    ({ amount, counterparty, txn_date: date, type: "payment", account_id: null, from_account_id: acc, to_account_id: null, payment_method_id: null, loan_id: null });
  type Row = { key: string; paidAmount: number | null; remainingAmount: number };
  const snapOf = (scheduled: unknown[], outflows: unknown[], overrides: unknown[], today: string) =>
    cashflowSnapshot(MONTH, {
      scheduled, loans: [], installments: [], txns: [], methods: [], recentOutflows: outflows,
      totalCash: 10_000_000, horizon: 3, accountIds: ["acc-a", "acc-b"], overrides, nextOverrides: [], today,
    } as never);
  const row = (snap: { classified: unknown[] }, k: string) => (snap.classified as Row[]).find((i) => i.key === k);

  // (m) 같은 카드사 두 명의가 한 통장(acc-a)에서 빠진다 — 5/12 350,000 은 누구 몫인지 모른다
  const two = [sp("ma", "카드대금-삼성카드-김하늘", 1_240_000, 25, "acc-a"), sp("mb", "카드대금-삼성카드-이바다", 420_000, 20, "acc-a")];
  const lastBoth = [pay(1_100_000, "삼성카드", "2026-04-25", "acc-a"), pay(380_000, "삼성카드", "2026-04-20", "acc-a")];
  const m1 = snapOf(two, [...lastBoth, pay(350_000, "삼성카드", "2026-05-12", "acc-a")], [ov("ma", { amount_override: 1_318_400 })], "2026-05-21");
  eq("★(m) 같은 통장 두 명의면 확정 항목이 남의 납부를 합산하지 않는다", row(m1, "fixed:ma")?.paidAmount ?? null, null);
  // 상대 항목에 수기 350,000 을 넣어 바로잡아도 같은 돈이 두 번 차감되지 않는다
  const m2 = snapOf(two, [...lastBoth, pay(350_000, "삼성카드", "2026-05-12", "acc-a")],
    [ov("ma", { amount_override: 1_318_400 }), ov("mb", { paid_override: 350_000 })], "2026-05-21");
  eq("★(m) 수기로 바로잡은 뒤 미지급 = 김하늘 확정액 전부(1,318,400), 350,000 이중 차감 없음", m2.pendingOutAll, 1_318_400);

  // (p) 상대 명의 항목의 계좌가 비어 있고 수기로 바로잡아도 이중 차감 없음
  const pTwo = [sp("pa", "카드대금-삼성카드-김하늘", 1_240_000, 25, "acc-a"), sp("pb", "카드대금-삼성카드-이바다", 420_000, 20, null)];
  const p = snapOf(pTwo, [...lastBoth, pay(350_000, "삼성카드", "2026-05-12", "acc-a")],
    [ov("pa", { amount_override: 1_318_400 }), ov("pb", { paid_override: 350_000 })], "2026-05-21");
  eq("★(p) 상대 계좌 미지정 + 수기 수정 → 미지급 1,318,400(이중 차감 없음)", p.pendingOutAll, 1_318_400);
  // (q) 상대 명의가 본 매칭으로 이미 완납했으면 내 선결제는 정상으로 붙는다
  const q = snapOf(two, [...lastBoth, pay(800_000, "삼성카드", "2026-05-12", "acc-a"), pay(420_000, "삼성카드", "2026-05-20", "acc-a")],
    [ov("ma", { amount_override: 1_318_400 }), ov("mb", { amount_override: 420_000 })], "2026-05-21");
  eq("★(q) 상대가 완납한 달엔 내 선결제 800,000 이 붙는다", row(q, "fixed:ma")?.paidAmount, 800_000);
  eq("  (q) 상대는 자기 납부 420,000 그대로", row(q, "fixed:mb")?.paidAmount, 420_000);

  // (r) 상대가 본 매칭으로 완납이어도 수기 출금금액을 넣었으면 어느 거래를 썼는지 모른다 → 다투는 것으로 본다
  const r = snapOf(two, [...lastBoth, pay(350_000, "삼성카드", "2026-05-12", "acc-a"), pay(420_000, "삼성카드", "2026-05-20", "acc-a")],
    [ov("ma", { amount_override: 1_318_400 }), ov("mb", { paid_override: 770_000 })], "2026-05-21");
  eq("★(r) 수기 입력한 상대가 있으면 그 통장 납부를 합산하지 않는다", row(r, "fixed:ma")?.paidAmount ?? null, null);

  // (n) 계좌 미지정 항목은 합산하지 않는다(다른 명의 통장 납부 흡수 방지)
  const n = snapOf([sp("na", "카드대금-삼성카드-김하늘", 1_240_000, 25, null)],
    [pay(900_000, "삼성카드", "2026-04-25", "acc-b"), pay(250_000, "삼성카드", "2026-05-12", "acc-b")], [ov("na", { amount_override: 1_318_400 })], "2026-05-21");
  eq("★(n) 계좌 미지정 카드대금은 다른 통장 납부를 합산하지 않는다", row(n, "fixed:na")?.paidAmount ?? null, null);

  // (o) 당월 예측·월말 현금도 남은 금액만 뺀다
  const o = snapOf([sp("oa", "카드대금-삼성카드-김하늘", 1_240_000, 25, "acc-a")],
    [pay(1_180_000, "삼성카드", "2026-04-27", "acc-a"), pay(700_000, "삼성카드", "2026-05-04", "acc-a")], [ov("oa", { amount_override: 1_318_400 })], "2026-05-04");
  eq("★(o) 당월 예측 출금 = 남은 618,400", o.currentForecastOut, 618_400);
  eq("★(o) 월말 현금 = 현재 잔액 − 남은 618,400", o.monthEndCash, 10_000_000 - 618_400);
}

console.log("\n[218-4] 경계값 — 허용오차 · 월초 5일 · 지난달 판정 · 거래 종류");
{
  const { cashflowSnapshot, cardBillShortfall } = await import("../src/lib/household/cashflow-snapshot");
  // 허용오차 max(1,000원, 0.5%) — 확정액만 따진다
  const conf = (amount: number) => ({ amount, amountOverridden: true });
  eq("★허용오차: 1,318,400 중 남음 6,592(0.5% 이내) → 완납", cardBillShortfall(conf(1_318_400), 1_311_808), 0);
  eq("★허용오차: 남음 6,593(0.5% 초과) → 부분", cardBillShortfall(conf(1_318_400), 1_311_807), 6_593);
  eq("★허용오차 바닥 1,000원: 100,000 중 99,000 → 완납", cardBillShortfall(conf(100_000), 99_000), 0);
  eq("★허용오차 바닥 1,000원: 98,999 → 부분 1,001", cardBillShortfall(conf(100_000), 98_999), 1_001);
  eq("  허용오차 경계 정확히 1,000(200,000 의 0.5%) → 완납", cardBillShortfall(conf(200_000), 199_000), 0);
  eq("  초과 납부 → 0", cardBillShortfall(conf(1_318_400), 1_400_000), 0);
  eq("  확정 전 금액 → 0", cardBillShortfall({ amount: 1_318_400, amountOverridden: false }, 700_000), 0);
  eq("  납부 0 → 0", cardBillShortfall(conf(1_318_400), 0), 0);

  const OWNER = "owner-1", MONTH = "2026-05";
  const sched = [{
    id: "ba", owner_auth_uid: OWNER, title: "카드대금-삼성카드-김하늘", direction: "out", amount: 1_240_000, frequency: "monthly", pay_day: 25,
    account_id: "acc-a", category_id: "cat-bill", is_active: true, start_date: null, end_date: null, person_id: null, memo: null, sort_order: 0, created_at: "", updated_at: "",
  }] as never[];
  const ovA = [{
    id: "ov-ba", owner_auth_uid: OWNER, year_month: MONTH, source_kind: "fixed", source_id: "ba", amount_override: 1_318_400,
    account_id: null, released: false, day_override: null, paid_override: null, created_at: "", updated_at: "",
  }] as never[];
  const pay = (amount: number, date: string, acc = "acc-a", extra: Record<string, unknown> = {}) =>
    ({ amount, counterparty: "삼성카드", txn_date: date, type: "payment", account_id: null, from_account_id: acc, to_account_id: null, payment_method_id: null, loan_id: null, ...extra });
  type Row = { key: string; paidAmount: number | null; remainingAmount: number; paidPartial: boolean };
  const rowOf = (outflows: unknown[]) =>
    (cashflowSnapshot(MONTH, {
      scheduled: sched, loans: [], installments: [], txns: [], methods: [], recentOutflows: outflows,
      totalCash: 10_000_000, horizon: 3, accountIds: ["acc-a", "acc-b"], overrides: ovA, nextOverrides: [], today: "2026-05-21",
    } as never).classified as Row[]).find((i) => i.key === "fixed:ba")!;
  const notAttached = (name: string, r: Row) => {
    eq(`★${name} — 안 붙음`, r.paidAmount ?? null, null);
    eq(`  ${name} — 확정액 전부 미지급`, r.remainingAmount, 1_318_400);
  };

  // 월초 5일 경계(지난달 납부 없음): 5일은 지난달 몫일 수 있어 안 붙고, 6일부터 선결제
  notAttached("월초 경계 5/5(지난달 납부 없음)", rowOf([pay(400_000, "2026-05-05")]));
  eq("★월초 경계 5/6(지난달 납부 없음) — 선결제로 붙는다", rowOf([pay(400_000, "2026-05-06")]).paidAmount, 400_000);

  // 지난달 판정은 직전 달·같은 계좌·loan_id 없는 납부만
  notAttached("지난달 판정: 두 달 전(3월) 납부뿐", rowOf([pay(900_000, "2026-03-25"), pay(400_000, "2026-05-02")]));
  notAttached("지난달 판정: 4월 납부가 카드론 상환뿐", rowOf([pay(480_000, "2026-04-04", "acc-a", { loan_id: "loan-card" }), pay(400_000, "2026-05-02")]));
  notAttached("지난달 판정: 4월 납부가 다른 계좌뿐", rowOf([pay(900_000, "2026-04-25", "acc-b"), pay(400_000, "2026-05-02")]));

  // 거래 종류: payment 만 합산(같은 상호의 일반 지출은 아니다)
  const exp = rowOf([pay(900_000, "2026-04-25"), { ...pay(250_000, "2026-05-12"), type: "expense" }]);
  notAttached("거래 종류: 상호 '삼성카드' expense", exp);
  eq("  부분 납부 표식 없음", exp.paidPartial, false);
}

console.log("\n[218-5] 접두어 상호 · 선결제 뺀 확정액 · 월말 카드의 월초 밀림");
{
  const { cashflowSnapshot } = await import("../src/lib/household/cashflow-snapshot");
  const OWNER = "owner-1", MONTH = "2026-05";
  const sp = (id: string, title: string, amount: number, day: number, account: string) =>
    ({
      id, owner_auth_uid: OWNER, title, direction: "out", amount, frequency: "monthly", pay_day: day,
      account_id: account, category_id: "cat-bill", is_active: true, start_date: null, end_date: null,
      person_id: null, memo: null, sort_order: 0, created_at: "", updated_at: "",
    }) as never;
  const ov = (sourceId: string, amount: number) =>
    ({
      id: `ov-${sourceId}`, owner_auth_uid: OWNER, year_month: MONTH, source_kind: "fixed", source_id: sourceId,
      amount_override: amount, account_id: null, released: false, day_override: null, paid_override: null, created_at: "", updated_at: "",
    }) as never;
  const pay = (amount: number, counterparty: string, date: string, acc: string) =>
    ({ amount, counterparty, txn_date: date, type: "payment", account_id: null, from_account_id: acc, to_account_id: null, payment_method_id: null, loan_id: null });
  type Row = { key: string; paidAmount: number | null; remainingAmount: number };
  const run = (scheduled: unknown[], outflows: unknown[], overrides: unknown[], today: string) => {
    const snap = cashflowSnapshot(MONTH, {
      scheduled, loans: [], installments: [], txns: [], methods: [], recentOutflows: outflows,
      totalCash: 10_000_000, horizon: 3, accountIds: ["acc-a", "acc-b"], overrides, nextOverrides: [], today,
    } as never);
    return { snap, row: (k: string) => (snap.classified as Row[]).find((i) => i.key === k)! };
  };

  // (s) 상호 "현대카드대금" 은 삼성카드 항목의 납부가 아니다 — 항목명 접두어 "카드대금" 이 상호에 걸리면 안 된다
  const s = run(
    [sp("ss", "카드대금-삼성카드-김하늘", 1_240_000, 25, "acc-a"), sp("hd", "카드대금-현대카드-이바다", 640_000, 1, "acc-b")],
    [pay(1_180_000, "삼성카드", "2026-04-27", "acc-a"), pay(640_000, "현대카드대금", "2026-05-01", "acc-b"), pay(250_000, "현대카드대금", "2026-05-15", "acc-a")],
    [ov("ss", 1_318_400)], "2026-05-16");
  eq("★(s) '현대카드대금' 납부는 삼성카드 항목에 합산되지 않는다", s.row("fixed:ss").paidAmount ?? null, null);
  eq("  (s) 삼성 미지급은 확정액 전부", s.row("fixed:ss").remainingAmount, 1_318_400);
  // (s2) 같은 통장의 현대카드 항목은 자기 '현대카드대금' 선결제를 받는다(삼성과 다투지 않는다)
  const s2 = run(
    [sp("ss", "카드대금-삼성카드-김하늘", 1_240_000, 25, "acc-a"), sp("hd", "카드대금-현대카드-김하늘", 980_000, 24, "acc-a")],
    [pay(1_180_000, "삼성카드", "2026-04-27", "acc-a"), pay(940_000, "현대카드대금", "2026-04-24", "acc-a"), pay(380_000, "현대카드대금", "2026-05-08", "acc-a")],
    [ov("ss", 1_318_400), ov("hd", 980_000)], "2026-05-09");
  eq("★(s2) 같은 통장 현대카드 항목이 자기 선결제 380,000 을 받는다", s2.row("fixed:hd").paidAmount, 380_000);

  // (t) 선결제 뺀 '남은 청구액'을 확정액으로 넣은 경우 — 합산이 확정액을 넘으면 버리고 종전대로 둔다
  const t = run([sp("ss", "카드대금-삼성카드-김하늘", 1_240_000, 25, "acc-a")],
    [pay(1_180_000, "삼성카드", "2026-04-27", "acc-a"), pay(700_000, "삼성카드", "2026-05-04", "acc-a")], [ov("ss", 618_400)], "2026-05-15");
  eq("★(t) 확정액 618,400 < 선결제 700,000 → 완납으로 보지 않는다(미지급 618,400 유지)", t.row("fixed:ss").remainingAmount, 618_400);
  eq("  (t) 출금금액은 종전대로 비어 있다", t.row("fixed:ss").paidAmount ?? null, null);

  // (v) 선결제+잔액으로 완납한 달에 같은 카드사 소액 납부가 섞여도 완납(소액만 빠진다)
  const v1 = run([sp("ss", "카드대금-삼성카드-김하늘", 1_240_000, 25, "acc-a")],
    [pay(1_180_000, "삼성카드", "2026-04-25", "acc-a"), pay(700_000, "삼성카드", "2026-05-04", "acc-a"), pay(618_400, "삼성카드", "2026-05-20", "acc-a"), pay(8_300, "삼성카드", "2026-05-22", "acc-a")],
    [ov("ss", 1_318_400)], "2026-05-23");
  eq("★(v) 선결제+잔액 완납 + 소액 8,300 → 남은 금액 0", v1.row("fixed:ss").remainingAmount, 0);
  eq("  (v) 출금금액은 확정액만큼(소액 제외)", v1.row("fixed:ss").paidAmount, 1_318_400);
  const v2 = run([sp("kb", "카드대금-국민카드-이바다", 215_000, 10, "acc-b")],
    [pay(330_000, "KB카드", "2026-04-10", "acc-b"), pay(6_200, "KB카드", "2026-05-03", "acc-b"), pay(110_000, "KB카드", "2026-05-07", "acc-b"), pay(105_000, "KB카드", "2026-05-10", "acc-b")],
    [ov("kb", 215_000)], "2026-05-11");
  eq("★(v2) 국민카드 선결제 110,000 + 잔액 105,000 완납 + 월초 6,200 → 남은 금액 0", v2.row("fixed:kb").remainingAmount, 0);

  // (u) 30일 예정 카드가 매달 다음 달 초에 빠지는 패턴 — 5/2 의 4월 몫을 5월 선결제로 보지 않는다
  const u = run([sp("lt", "카드대금-롯데카드-김하늘", 720_000, 30, "acc-a")],
    [pay(690_000, "롯데카드", "2026-04-01", "acc-a"), pay(705_000, "롯데카드", "2026-05-02", "acc-a")], [ov("lt", 760_000)], "2026-05-10");
  eq("★(u) 월말 카드의 월초 밀림 납부는 이번 달 선결제가 아니다", u.row("fixed:lt").paidAmount ?? null, null);
  eq("  (u) 미지급은 확정액 전부", u.snap.pendingOutAll, 760_000);
}

console.log("\n[219] loan_id 짝은 max(1,000원, 5%) 까지 받는다 — 변동금리로 월납이 바뀐 첫 달(설계 219) (값은 가상)");
{
  // 예정 512,300 · 실제 506,800(1.1%, loan_id 연결) — 근사-정밀(0.5%) 밖이라 종전에는 '출금 없음'이었다.
  const item = { key: "loan:ga", amount: 512_300, label: "주택담보대출", day: 5, accountId: null, accountBlind: true, loanId: "loan-ga" };
  const t = { amount: 506_800, counterparty: "대출원리금납입", txn_date: "2026-05-06", type: "payment", from_account_id: "acc-a", loan_id: "loan-ga" };
  eq("★1.1% 다른 loan_id 상환이 붙는다", matchOutflowActuals([item], [t], { ...TOL, todayDay: 6 }).get("loan:ga")?.amount, 506_800);
  eq("  loan_id 가 없으면 종전대로 안 붙는다(허용폭은 loan_id 짝만)", matchOutflowActuals([item], [{ ...t, loan_id: null }], { ...TOL, todayDay: 6 }).has("loan:ga"), false);
  eq("  5% 경계 안(486,700)은 붙는다", matchOutflowActuals([item], [{ ...t, amount: 486_700 }], { ...TOL, todayDay: 6 }).has("loan:ga"), true);
  eq("★5% 경계 밖(486,600)은 안 붙는다", matchOutflowActuals([item], [{ ...t, amount: 486_600 }], { ...TOL, todayDay: 6 }).has("loan:ga"), false);
  // 넓힌 허용폭에도 날짜 가드는 그대로(설계 216) — 30일 예정 상환이 2% 다른 금액으로 한참 일찍 나간 것은 이번 달 몫이 아니다.
  const item30 = { ...item, day: 30 };
  const early = { ...t, amount: 501_000, txn_date: "2026-05-01" };
  eq("★허용폭 안(2.2%)이어도 조기 가드를 받는다", matchOutflowActuals([item30], [early], TOL).has("loan:ga"), false);
  eq("★허용폭 안이어도 예정일 전 가드를 받는다", matchOutflowActuals([item30], [{ ...early, txn_date: "2026-05-27" }], { ...TOL, todayDay: 28 }).has("loan:ga"), false);
  eq("  예정일이 지나면 붙는다", matchOutflowActuals([item30], [{ ...early, txn_date: "2026-05-27" }], { ...TOL, todayDay: 30 }).has("loan:ga"), true);
  // 정기지출과 겹친 대출: 20,900 은 대출 21,400 과 500원 차 — 1,000원 하한 안이라 금액으로는 못 막는다.
  //   정기지출이 정확금액으로 주장하므로 구조 방어(claimedByNonLoan)가 막는다.
  const master = { key: "loan:db", amount: 21_400, label: "보험계약대출-김", day: 5, accountId: null, accountBlind: true, loanId: "loan-db" };
  const fx1 = { key: "fixed:db1", amount: 20_900, label: "대출상환-한빛손보 약대-김하", day: 5, accountId: "acc-kb" };
  const tdb = { amount: 20_900, counterparty: "한빛손보약대 공동CMS", txn_date: "2026-05-07", type: "payment", from_account_id: "acc-kb", loan_id: "loan-db" };
  const db = matchOutflowActuals([master, fx1], [tdb], TOL);
  eq("★허용폭 안이어도 정기지출이 주장하는 거래는 대출 항목이 못 가져간다", db.get("fixed:db1")?.amount, 20_900);
  eq("  대출 항목은 비어 있다", db.has("loan:db"), false);
}

console.log(fail === 0 ? "\n전부 통과 ✅" : `\n실패 ${fail}건 ❌`);
process.exit(fail === 0 ? 0 : 1);
