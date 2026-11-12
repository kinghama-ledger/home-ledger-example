// 변동 지출(생활비) 표본 조회 — 현금흐름 화면과 통계 요약이 같은 값을 쓰도록 한 곳에 둔다. (설계 173·79)
// 요약이 이 보정을 빼면 '이번 달 잔액'이 두 화면에서 이번 달 남은 생활비만큼 달라진다.
import type { browserDb } from "@/lib/backend/browser";
import { outflowsForMatching, type ActualOutflow } from "@/lib/household/calc";
import { fixedCategoryIdsOf, variableSpendOfMonth, type VariableSpendSample } from "@/lib/household/variable-spend";
import { monthRange, shiftMonth } from "@/lib/household/month";
import type { HhPaymentMethod, HhScheduledPayment, HhTransaction } from "@/lib/household/types";

/**
 * 변동 지출 표본 + 전월 실적 — **완료된 직전 3개월**. (설계 173)
 *
 * ★변동 지출은 **정기지출이 쓰지 않는 카테고리의 통장 지출**로 센다.
 *   `실제 유출 − 그 달 정기 예정`으로는 못 잡는다 —
 *   정기지출·대출은 "현재" 상태만 저장돼 있어 **과거 달의 예정을 재현할 수 없기** 때문이다
 *   (차액이 실제 유출 전액이 된다). 자세한 근거는 `variableSpendOfMonth` 주석.
 * ★실제 유출은 `outflowsForMatching` 으로 **내부 이체·카드 지출을 뺀** 뒤 센다 — 화면 합계와 같은 기준.
 */
export async function fetchVariableSpendSamples(
  supabase: ReturnType<typeof browserDb>,
  month: string,
  base: { scheduled: HhScheduledPayment[]; methods: HhPaymentMethod[]; accountIds: string[] },
): Promise<{ samples: VariableSpendSample[]; prev: { ym: string; income: number; outflow: number } | null }> {
  const months = [3, 2, 1].map((k) => shiftMonth(month, -k)); // 완료된 직전 3개월(당월 제외)
  const prevYm = shiftMonth(month, -1);
  const from = `${months[0]}-01`;
  const to = monthRange(month).start; // 당월 시작 = 표본 구간의 끝
  // ★페이징 — 3개월치 전 유형이면 상한 1,000행을 넘길 수 있고, 잘리면 **조용히 과소 집계**된다
  //   (설계 128 후속에서 같은 함정을 밟았다). 실패는 null 로 알려 '0원'과 구분한다.
  const txns: HhTransaction[] = [];
  for (let off = 0; off < 50_000; off += 1000) {
    const { data, error } = await supabase
      .from("hh_transaction")
      .select("*")
      .in("type", ["expense", "income", "payment", "transfer"])
      .gte("txn_date", from)
      .lt("txn_date", to)
      .order("txn_date", { ascending: true })
      .order("id", { ascending: true })
      .range(off, off + 999);
    if (error) {
      console.error("변동지출 표본 조회 실패:", error);
      return { samples: [], prev: null };
    }
    const rows = (data ?? []) as HhTransaction[];
    txns.push(...rows);
    if (rows.length < 1000) break;
  }
  const fixedCats = fixedCategoryIdsOf(base.scheduled);
  const cardIds = base.methods.filter((m) => m.kind === "credit" || m.kind === "installment").map((m) => m.id);
  // ★수입을 먼저 뺀다 — outflowsForMatching 은 내부이체·카드지출만 거르고 income 은 그대로 통과시킨다.
  //   안 빼면 전월 '출금'에 수입이 더해져 실제보다 크게 나온다.
  const outTxns = txns.filter((t) => t.type !== "income") as unknown as ActualOutflow[];
  const pool = outflowsForMatching(outTxns, base.accountIds, cardIds);

  // ★표본도 **pool**(내부이체·신용/할부 카드지출 제외)로 센다 — 원본 txns 로 세면 카드 지출이 섞여
  //   카드대금 예정과 **이중계상**된다(교차리뷰 2026-08-14).
  // ★거래가 아예 없는 달은 표본에서 뺀다 — 0원 표본이 섞이면 중앙값이 0 쪽으로 끌려가
  //   진짜 실적 월이 '이상치'로 제외되고 월평균이 0이 된다(같은 리뷰).
  const poolAll = pool as unknown as HhTransaction[];
  const samples = months
    .filter((ym) => txns.some((t) => t.txn_date.slice(0, 7) === ym))
    .map((ym) => ({ ym, amount: variableSpendOfMonth(poolAll, ym, fixedCats) }));
  // 전월 실적(확정) — 최상단 요약에서 이번 달 예상과 나란히 놓는다. (설계 173 ③)
  // ★출금 기준을 이번 달과 **같게** 맞춘다: 내부 이체·카드 지출을 뺀 실제 통장유출.
  const prev = {
    ym: prevYm,
    income: txns.filter((t) => t.type === "income" && t.txn_date.slice(0, 7) === prevYm).reduce((s2, t) => s2 + Number(t.amount), 0),
    outflow: pool.filter((t) => t.txn_date.slice(0, 7) === prevYm).reduce((s2, t) => s2 + Number(t.amount), 0),
  };
  return { samples, prev };
}
