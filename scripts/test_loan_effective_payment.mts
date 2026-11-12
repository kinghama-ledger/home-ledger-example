// 설계 219 — 대출 예정금액은 직전 실제 상환액으로 잡는다(변동금리 대응). DB 불필요. 값은 전부 가상.
//   npm run test:loan-effective
//
// 변동금리 대출은 월납이 매달 조금씩 달라진다(예: 월상환 512,300 인데 실출금 506,800).
// 대출 원장을 매번 손으로 고치게 하지 않고 화면 계산에서 직전 실제액을 쓴다.
const { effectiveLoanPayments } = await import("../src/lib/household/calc");
const { cashflowSnapshot } = await import("../src/lib/household/cashflow-snapshot");
import type { ActualOutflow } from "../src/lib/household/calc";
import type {
  HhCashflowOverride, HhInstallment, HhLoan, HhPaymentMethod, HhScheduledPayment, HhTransaction,
} from "../src/lib/household/types";

let fail = 0;
const eq = (name: string, a: unknown, b: unknown) => {
  if (Object.is(a, b)) console.log(`  ✅ ${name}`);
  else { fail++; console.log(`  ❌ ${name} — 기대 ${JSON.stringify(b)}, 실제 ${JSON.stringify(a)}`); }
};

const loan = (over: Partial<HhLoan> = {}): HhLoan => ({
  id: "loan-ga", owner_auth_uid: "o", name: "주택담보대출", origin_date: "2021-03-10", principal: 80_000_000,
  current_balance: 74_000_000, maturity_date: "2051-03-10", interest_rate: 4.2, monthly_payment: 512_300, payment_day: 5,
  account_id: "acc-a", repayment_type: null, source: "manual", status: "active", created_at: "", updated_at: "",
  ...over,
});
const pay = (amount: number, date: string, over: Partial<ActualOutflow> = {}): ActualOutflow => ({
  amount, counterparty: "대출원리금납입", txn_date: date, type: "payment", from_account_id: "acc-a", loan_id: "loan-ga", ...over,
});
const sched = (over: Partial<HhScheduledPayment> = {}): HhScheduledPayment => ({
  id: "sp-1", owner_auth_uid: "o", title: "t", kind: "autopay", amount: 100_000, frequency: "monthly", pay_day: 5,
  account_id: "acc-kb", payment_method_id: null, category_id: null, person_id: null, payee: null, direction: "out",
  is_active: true, permanent_hold: false, start_date: null, end_date: null, created_at: "", updated_at: "",
  ...over,
} as HhScheduledPayment);
const one = (loans: HhLoan[], outs: ActualOutflow[], ref: string, sps: HhScheduledPayment[] = []) =>
  effectiveLoanPayments(loans, outs, ref, sps)[0].monthly_payment;

console.log("\n[1] 기준 달의 연결 상환 1건이면 그 금액");
eq("★4월 506,800 → 506,800", one([loan()], [pay(506_800, "2026-04-06")], "2026-04"), 506_800);
eq("  상환이 없으면 원값", one([loan()], [], "2026-04"), 512_300);
eq("★ref 이후 달 거래는 무시(당월 표는 전월 기준)", one([loan()], [pay(506_800, "2026-05-06")], "2026-04"), 512_300);
eq("★여러 달이면 가장 최근 달", one([loan()], [pay(503_000, "2026-03-05"), pay(506_800, "2026-04-06")], "2026-04"), 506_800);
eq("  최근 달이 ref 밖이면 그 앞 달", one([loan()], [pay(503_000, "2026-03-05"), pay(506_800, "2026-05-06")], "2026-04"), 503_000);
eq("  입력이 역순이어도 가장 최근 달", one([loan()], [pay(506_800, "2026-04-06"), pay(503_000, "2026-03-05")], "2026-04"), 506_800);
eq("  지출(expense)로 기록된 상환도 기준이 된다", one([loan()], [pay(506_800, "2026-04-06", { type: "expense" })], "2026-04"), 506_800);
eq("  이체(transfer)로 기록된 상환도 기준이 된다", one([loan()], [pay(506_800, "2026-04-06", { type: "transfer" })], "2026-04"), 506_800);

console.log("\n[2] 바꾸지 않는 경우");
eq("★기준 달 연결 상환이 2건이면 원값(어느 것이 이 대출 몫인지 모른다)", one([loan()], [pay(506_800, "2026-04-06"), pay(2_500, "2026-04-06")], "2026-04"), 512_300);
eq("  앞 달에 1건이 있어도 최근 달이 2건이면 원값", one([loan()], [pay(506_800, "2026-03-06"), pay(1, "2026-04-06"), pay(2, "2026-04-07")], "2026-04"), 512_300);
eq("★+3% 밖(528,000)이면 원값", one([loan()], [pay(528_000, "2026-04-06")], "2026-04"), 512_300);
eq("★−3% 밖(496,930)이면 원값", one([loan()], [pay(496_930, "2026-04-06")], "2026-04"), 512_300);
eq("  ±3% 경계 안(496,931)은 바꾼다", one([loan()], [pay(496_931, "2026-04-06")], "2026-04"), 496_931);
// 일부상환 달(월상환 420,000 에 390,000, −7.1%)이 다음 달 예정이 되면 정상 상환이 예정과 크게 어긋나
//   '출금 없음'이 된다 — ±3% 밖이라 원값으로 둔다.
eq("★일부상환 390,000(−7.1%)은 다음 달 예정이 되지 않는다", one([loan({ monthly_payment: 420_000 })], [pay(390_000, "2026-04-10")], "2026-04"), 420_000);
eq("★월상환 0 이면 원값", one([loan({ monthly_payment: 0 })], [pay(400_000, "2026-04-06")], "2026-04"), 0);
eq("  월상환 null 이면 원값", one([loan({ monthly_payment: null })], [pay(400_000, "2026-04-06")], "2026-04"), null);
eq("  상환 끝난 대출은 원값", one([loan({ status: "closed" })], [pay(506_800, "2026-04-06")], "2026-04"), 512_300);
eq("  수입(대출 실행 입금)은 무시", one([loan()], [pay(506_800, "2026-04-06", { type: "income" })], "2026-04"), 512_300);
eq("  다른 대출의 상환은 무시", one([loan()], [pay(506_800, "2026-04-06", { loan_id: "loan-x" })], "2026-04"), 512_300);
eq("  loan_id 없는 거래는 무시", one([loan()], [pay(506_800, "2026-04-06", { loan_id: null })], "2026-04"), 512_300);
// ★정기지출과 겹친 대출 — 대출 원장(21,400)에 정기지출 몫 20,900(2.3%) 한 건만 연결된 달.
//   금액 가드 안이지만 정기지출이 자기 것으로 주장하는 거래라 바꾸지 않는다(구조 방어).
{
  const db = loan({ id: "loan-db", name: "보험계약대출-김", monthly_payment: 21_400 });
  const dbPay = (amount: number, date: string) => pay(amount, date, { loan_id: "loan-db", counterparty: "한빛손보약대 공동CMS" });
  const yak = sched({ id: "sp-yak", title: "대출상환-한빛손보 약대-김하", amount: 20_900 });
  eq("★정기지출이 정확금액으로 주장하는 연결 상환이면 원값", one([db], [dbPay(20_900, "2026-04-07")], "2026-04", [yak]), 21_400);
  eq("★상호+근사로 주장해도 원값(정기지출 20,000 · 실제 20,900)", one([db], [dbPay(20_900, "2026-04-07")], "2026-04", [sched({ title: "대출상환-한빛손보 약대-김하", amount: 20_000 })]), 21_400);
  eq("  다른 달의 연결 상환을 정기지출이 주장해도 원값(겹친 대출)", one([db], [dbPay(20_900, "2026-03-07"), dbPay(21_000, "2026-04-07")], "2026-04", [yak]), 21_400);
  eq("  꺼진 정기지출은 주장하지 않는다", one([db], [dbPay(20_900, "2026-04-07")], "2026-04", [{ ...yak, is_active: false }]), 20_900);
  eq("  정기지출이 없으면 바꾼다", one([db], [dbPay(20_900, "2026-04-07")], "2026-04"), 20_900);
}

console.log("\n[3] 입력 불변 · 길이·순서 유지");
{
  const loans = [loan(), loan({ id: "loan-b", name: "B", monthly_payment: 100_000 })];
  const out = effectiveLoanPayments(loans, [pay(506_800, "2026-04-06")], "2026-04", []);
  eq("원장 객체는 그대로 512,300", loans[0].monthly_payment, 512_300);
  eq("바뀐 것만 사본", out[0] !== loans[0], true);
  eq("안 바뀐 것은 같은 객체", out[1], loans[1]);
  eq("길이 유지", out.length, 2);
  eq("금액 외 필드 유지", out[0].name, "주택담보대출");
}

console.log("\n[4] cashflowSnapshot — 당월 표는 전월 실제, 예측은 당월 포함 최근 실제");
{
  const base = {
    scheduled: [] as HhScheduledPayment[], installments: [] as HhInstallment[], txns: [] as HhTransaction[],
    methods: [] as HhPaymentMethod[], overrides: [] as HhCashflowOverride[], totalCash: 10_000_000, horizon: 3,
  };
  // 전월(4월) 506,800 만 있고 5월은 아직 안 나감
  const s1 = cashflowSnapshot("2026-05", { ...base, loans: [loan()], recentOutflows: [pay(506_800, "2026-04-06")], today: "2026-05-03" });
  eq("★당월 대출 항목 예정 = 전월 실제 506,800", s1.classified.find((i) => i.sourceKind === "loan")?.amount, 506_800);
  eq("★당월 미출금이면 익월 항목 = 당월 예정(전월 실제) 506,800", s1.nextItems.find((i) => i.sourceKind === "loan")?.amount, 506_800);
  eq("  익월 예측 출금(projection[1]) = 506,800", s1.projection[1]?.outflow, 506_800);
  // 5월에 509,500 이 이미 나감 → 당월 표는 4월 기준(506,800)으로 예정, 0.53% 차(0.5% 밖, 5% 안)라 loan_id 짝으로 출금됨.
  //   익월 항목은 '당월 매칭 실지급' 이월(설계 81)로, 셋째 달 예측은 당월 포함 최근 실제로 509,500.
  const s2 = cashflowSnapshot("2026-05", { ...base, loans: [loan()], recentOutflows: [pay(506_800, "2026-04-06"), pay(509_500, "2026-05-06")], today: "2026-05-06" });
  const cur = s2.classified.find((i) => i.sourceKind === "loan");
  eq("  당월 예정 = 전월 실제 506,800", cur?.amount, 506_800);
  eq("  당월 509,500 이 출금됨으로 붙는다", cur?.paidAmount, 509_500);
  eq("  익월 항목 = 당월 매칭 실지급 509,500(이월 규칙)", s2.nextItems.find((i) => i.sourceKind === "loan")?.amount, 509_500);
  eq("★셋째 달 예측 출금 = 당월 실제 509,500", s2.projection[2]?.outflow, 509_500);
  // 원장 월상환과 같으면 그대로
  const s3 = cashflowSnapshot("2026-05", { ...base, loans: [loan()], recentOutflows: [pay(512_300, "2026-04-06")], today: "2026-05-03" });
  eq("  전월 실제 = 월상환이면 그대로 512,300", s3.classified.find((i) => i.sourceKind === "loan")?.amount, 512_300);
}

console.log("\n[5] cashflowSnapshot — 정기지출과 겹친 대출은 예측에 이중계상되지 않는다");
{
  // 대출 원장 21,400 + 정기지출 20,900. 2·3·4월 20,900 이 한 건씩 loan_id 로 연결됨.
  //   예정이 20,900 으로 바뀌면 최근 실적 매칭에서 대출 항목이 남은 달치를 정확금액으로 가져가 예측에 20,900 이 두 번 든다.
  const db = loan({ id: "loan-db", name: "보험계약대출-김", monthly_payment: 21_400, payment_day: 5 });
  const yak = sched({ id: "sp-yak", title: "대출상환-한빛손보 약대-김하", amount: 20_900, pay_day: 5 });
  const outs = ["2026-02-07", "2026-03-07", "2026-04-07"].map((d) => pay(20_900, d, { loan_id: "loan-db", counterparty: "한빛손보약대 공동CMS", from_account_id: "acc-kb" }));
  const snap = cashflowSnapshot("2026-05", {
    scheduled: [yak], loans: [db], installments: [] as HhInstallment[], txns: [] as HhTransaction[], methods: [] as HhPaymentMethod[],
    overrides: [] as HhCashflowOverride[], recentOutflows: outs, totalCash: 10_000_000, horizon: 3, today: "2026-05-03",
  });
  const dbItem = snap.classified.find((i) => i.sourceKind === "loan");
  eq("★대출 항목 예정은 원값 21,400", dbItem?.amount, 21_400);
  eq("★셋째 달 예측 출금 = 정기지출 20,900 한 번", snap.projection[2]?.outflow, 20_900);
}

console.log(fail === 0 ? "\n전부 통과 ✅" : `\n실패 ${fail}건 ❌`);
process.exit(fail === 0 ? 0 : 1);
