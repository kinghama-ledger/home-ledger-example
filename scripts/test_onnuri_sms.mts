// 설계 213·224: 디지털온누리 결제수단 권위, 두 문자 꼴의 1:1 중복 판정, 체크카드에 연결한 온누리 결제의 계좌 구분.
// 실행: npx tsx scripts/test_onnuri_sms.mts   (DB 불필요 — 순수 함수 + 가짜 supabase 스텁)
// 값은 전부 가상이다(김하늘 가족). 문자 꼴만 디지털온누리 앱의 두 형식을 따른다.
const { isOnnuriPairedSmsDuplicate, resolveOnnuriPaymentMethod } = await import("../src/lib/household/sms-ingest");

let fail = 0;
const eq = (name: string, actual: unknown, expected: unknown) => {
  if (Object.is(actual, expected)) console.log(`  ✅ ${name}`);
  else {
    fail += 1;
    console.log(`  ❌ ${name} — 기대 ${JSON.stringify(expected)}, 실제 ${JSON.stringify(actual)}`);
  }
};

const DONE = "결제되었어요 김하늘님, 주식회사 한빛마트에서 6,400원이 결제되었어요.";
const APPROVAL = "결제 온누리(2*4*)김*늘님 09/05 18:02/일시불/승인/6,400원/(주)한빛마트";
const APPROVAL_AGAIN = "결제 온누리(2*4*)김*늘님 09/05 19:02/일시불/승인/6,400원/(주)한빛마트";
const CANCEL = "결제 온누리(2*4*)김*늘님 09/05 18:03/일시불/취소/6,400원/(주)한빛마트";

// 문자에 디지털온누리가 명시되면 가맹점 학습 카드보다 유일한 활성 온누리 수단이 우선한다.
{
  const unique = resolveOnnuriPaymentMethod(
    "디지털온누리",
    "approve",
    [
      { id: "pm-onnuri", name: "디지털온누리(김하늘)", is_active: true },
      { id: "pm-old", name: "디지털온누리(해지)", is_active: false },
    ],
    "pm-learned-card"
  );
  eq("유일 활성 온누리 수단이 학습 카드보다 우선", unique.paymentMethodId, "pm-onnuri");
  eq("온누리 권위 규칙 발동", unique.applies, true);

  const none = resolveOnnuriPaymentMethod("디지털온누리", "approve", [], "pm-learned-card");
  eq("후보 0개면 학습 카드 대신 빈칸", none.paymentMethodId, null);

  const ambiguous = resolveOnnuriPaymentMethod(
    "디지털온누리",
    "cancel",
    [
      { id: "pm-1", name: "디지털온누리(김하늘)", is_active: true },
      { id: "pm-2", name: "디지털온누리(가족)", is_active: true },
    ],
    "pm-learned-card"
  );
  eq("후보 2개면 학습 카드 대신 빈칸", ambiguous.paymentMethodId, null);

  const ordinary = resolveOnnuriPaymentMethod("국민카드", "approve", [], "pm-learned-card");
  eq("일반 카드 문자는 기존 학습값 유지", ordinary.paymentMethodId, "pm-learned-card");
  eq("일반 카드에는 온누리 권위 규칙 미발동", ordinary.applies, false);
}

// 반대 꼴 수 > 같은 꼴 수일 때만 duplicate: 같은 날·금액 결제가 두 번이어도 각 꼴 하나씩은 살아남는다.
eq("첫 반대 꼴 1개와 짝지어 duplicate", isOnnuriPairedSmsDuplicate(APPROVAL, [DONE]), true);
eq("반대 1·같은 1이면 새 결제이므로 pending", isOnnuriPairedSmsDuplicate(APPROVAL_AGAIN, [DONE, APPROVAL]), false);
eq("반대 2·같은 1이면 두 번째 짝이라 duplicate", isOnnuriPairedSmsDuplicate(APPROVAL_AGAIN, [DONE, DONE, APPROVAL]), true);
eq("같은 꼴만 있으면 duplicate 아님", isOnnuriPairedSmsDuplicate(APPROVAL_AGAIN, [APPROVAL]), false);
eq("kind가 다른 취소는 승인과 짝짓지 않음", isOnnuriPairedSmsDuplicate(CANCEL, [DONE]), false);
eq("온누리 아닌 문자는 규칙 미발동", isOnnuriPairedSmsDuplicate("국민카드 승인 6,400원 한빛마트", [DONE]), false);

// ── 배선 검증: 순수 함수만이 아니라 enrichParsed·중복 조회가 실제로 규칙을 쓰는지 가짜 supabase 로 고정한다.
const { enrichParsed, hasOnnuriPairedSmsDuplicate } = await import("../src/lib/household/sms-ingest");
type Row = Record<string, unknown>;
/** enrichParsed 가 쓰는 만큼만 구현한 스텁(test_unmatched_card_fallback 과 같은 꼴). 행에 그 컬럼이 있을 때만 거른다. */
function stub(tables: Record<string, Row[]>) {
  const build = (rows: Row[]) => {
    let cur = rows;
    const api: Record<string, unknown> = {
      select: () => api,
      order: () => api,
      limit: (n: number) => { cur = cur.slice(0, n); return api; },
      not: () => api,
      gte: (col: string, val: unknown) => { cur = cur.filter((r) => !(col in r) || String(r[col]) >= String(val)); return api; },
      lte: (col: string, val: unknown) => { cur = cur.filter((r) => !(col in r) || String(r[col]) <= String(val)); return api; },
      ilike: (col: string, pat: string) => { const needle = String(pat).replace(/%/g, ""); cur = cur.filter((r) => !(col in r) || String(r[col] ?? "").includes(needle)); return api; },
      eq: (col: string, val: unknown) => { cur = cur.filter((r) => !(col in r) || r[col] === val); return api; },
      in: (col: string, vals: unknown[]) => { cur = cur.filter((r) => !(col in r) || vals.includes(r[col])); return api; },
      maybeSingle: async () => ({ data: cur[0] ?? null, error: null }),
      then: (resolve: (v: { data: Row[]; error: null }) => unknown) => resolve({ data: cur, error: null }),
    };
    return api;
  };
  return { from: (t: string) => build(structuredClone(tables[t] ?? [])) } as never;
}
const OWNER = "owner-1";
const PM_ONNURI: Row = { owner_auth_uid: OWNER, id: "pm-onnuri", name: "디지털온누리(김하늘)", kind: "cash", card_no: null, linked_account_id: "acc-onnuri", is_active: true };
const PM_KB_CREDIT: Row = { owner_auth_uid: OWNER, id: "pm-kb-credit", name: "국민카드(김하늘)", kind: "credit", card_no: "0000-0000-0000-9012", linked_account_id: null, is_active: true };
const tables = (methods: Row[]): Record<string, Row[]> => ({
  // 한빛마트는 국민카드로도 결제해 학습값이 국민카드(신용) + 국민은행(김하늘) 계좌로 남아 있는 상황
  hh_merchant_map: [{ owner_auth_uid: OWNER, merchant_key: "한빛마트", category_id: "cat-food", payment_method_id: "pm-kb-credit", account_id: "acc-kb" }],
  hh_account: [
    { owner_auth_uid: OWNER, id: "acc-onnuri", name: "디지털온누리(김하늘)", account_no: null, person_id: "p-khn", is_active: true },
    { owner_auth_uid: OWNER, id: "acc-kb", name: "국민은행(김하늘)", account_no: "110-22-0456-789", person_id: "p-khn", is_active: true },
  ],
  hh_payment_method: methods,
  hh_person: [{ owner_auth_uid: OWNER, id: "p-khn", name: "김하늘" }, { owner_auth_uid: OWNER, id: "p-lbd", name: "이바다" }],
  hh_category: [], hh_loan: [], hh_scheduled_payment: [],
});
for (const [label, text] of [["승인 꼴", APPROVAL], ["결제되었어요 꼴", DONE], ["[Web발신] 머리말 승인 꼴", `[Web발신]\n${APPROVAL}`]] as const) {
  const { fields } = await enrichParsed(stub(tables([PM_ONNURI, PM_KB_CREDIT])), OWNER, text, null);
  eq(`${label}: 결제수단 = 디지털온누리(학습된 국민카드 아님)`, fields.guessed_payment_method_id, "pm-onnuri");
  eq(`${label}: 계좌 = 온누리 연결계좌(학습된 국민은행 아님)`, fields.guessed_account_id, "acc-onnuri");
  eq(`${label}: 카테고리 학습값 유지`, fields.guessed_category_id, "cat-food");
}
{
  const { fields } = await enrichParsed(stub(tables([PM_KB_CREDIT])), OWNER, APPROVAL, null);
  eq("온누리 결제수단 미등록: 결제수단 빈칸(학습 카드로 안 돌아감)", fields.guessed_payment_method_id, null);
  eq("온누리 결제수단 미등록: 계좌 빈칸(학습 국민은행 안 씀)", fields.guessed_account_id, null);
}
{
  const inbox = (status: string, raw_text: string): Row => ({ owner_auth_uid: OWNER, guessed_date: "2026-09-05", guessed_amount: 6400, guessed_kind: "approve", status, raw_text });
  const dupCheck = (rows: Row[]) => hasOnnuriPairedSmsDuplicate(stub({ hh_transaction_inbox: rows }), OWNER, APPROVAL, "approve", "2026-09-05", 6400);
  eq("조회 배선: pending 결제되었어요 뒤 승인 꼴 → duplicate", await dupCheck([inbox("pending", DONE)]), true);
  eq("조회 배선: ignored 행은 세지 않음", await dupCheck([inbox("ignored", DONE)]), false);
  eq("조회 배선: 다른 날짜 행은 세지 않음", await dupCheck([{ ...inbox("pending", DONE), guessed_date: "2026-09-04" }]), false);
}

// ── 설계 224: 체크카드에 연결한 온누리 — 카드 알림 + "결제되었어요" 짝이면 카드 행 계좌를 온누리로.
{
  const { pickOnnuriCardRelabels, onnuriPairMerchantMatches, relabelOnnuriLinkedCardPayment } = await import("../src/lib/household/sms-ingest");
  const T0 = "2026-10-06T09:39:20.447Z";
  const at = (ms: number) => new Date(Date.parse(T0) + ms).toISOString();
  const card = (o: Row = {}) => ({ id: "card", status: "pending", raw_text: "23,700원 결제 우리체크 | （주）한빛마트(일시불)", guessed_merchant: "한빛마트", guessed_account_id: "acc-check-linked", guessed_kind: "approve", collected_at: T0, ...o }) as never;
  const done = (o: Row = {}) => ({ id: "done", status: "duplicate", raw_text: "결제되었어요 김하늘님, 주식회사 한빛마트에서 23,700원이 결제되었어요.", guessed_merchant: "주식회사 한빛마트", guessed_account_id: "acc-onnuri", guessed_kind: "approve", collected_at: at(92), ...o }) as never;
  const pick = (rows: never[]) => Object.fromEntries(pickOnnuriCardRelabels(rows)) as Record<string, string>;

  eq("상호: （주）한빛마트 ~ 주식회사 한빛마트", onnuriPairMerchantMatches("（주）한빛마트", "주식회사 한빛마트"), true);
  eq("상호: 잘린 해오름커피한빛（ ~ 해오름커피한빛", onnuriPairMerchantMatches("해오름커피한빛（", "해오름커피한빛"), true);
  eq("상호: 다른 가게는 짝 아님", onnuriPairMerchantMatches("GS25한빛중앙점", "새봄약국"), false);
  eq("짝: pending 체크카드 행 → 온누리 계좌", pick([card(), done()]).card, "acc-onnuri");
  eq("짝: 결제되었어요가 먼저 와도 같은 답", pick([done({ collected_at: at(-500) }), card()]).card, "acc-onnuri");
  eq("일반결제되었어요는 신호가 아님(통장 결제)", pick([card(), done({ raw_text: "결제되었어요 김하늘님, 주식회사 한빛마트에서 41500원이 일반결제되었어요." })]).card, undefined);
  eq("온누리 승인 꼴도 신호", pick([card(), done({ raw_text: "결제 온누리(2*4*)김*늘님 10/06 18:39/일시불/승인/23,700원/(주)한빛마트", guessed_merchant: "(주)한빛마트" })]).card, "acc-onnuri");
  eq("다른 가게 카드 행은 안 바꿈", pick([card({ guessed_merchant: "GS25한빛중앙점", raw_text: "23,700원 결제 우리체크 | GS25한빛중앙점(일시불)" }), done()]).card, undefined);
  eq("10분 넘게 떨어지면 안 바꿈", pick([card(), done({ collected_at: at(11 * 60 * 1000) })]).card, undefined);
  eq("확정된 카드 행은 안 바꿈", pick([card({ status: "confirmed" }), done()]).card, undefined);
  eq("휴지통 신호는 안 셈", pick([card(), done({ status: "ignored" })]).card, undefined);
  eq("계좌 없는 신호는 안 셈", pick([card(), done({ guessed_account_id: null })]).card, undefined);
  eq("취소 알림은 안 바꿈", pick([card({ guessed_kind: "cancel" }), done()]).card, undefined);
  eq("신호 1개는 카드 행 1개만(가까운 쪽)", JSON.stringify(pick([card({ id: "c1" }), card({ id: "c2", collected_at: at(1000) }), done()])), JSON.stringify({ c1: "acc-onnuri" }));
  eq("계좌 없는 신용카드 승인은 안 바꿈", pick([card({ guessed_account_id: null, guessed_payment_method_id: "pm-samsung", raw_text: "삼성카드삼성1234승인 이*다 23,700원 일시불 10/06 18:39 (주)한빛마트" }), done({ guessed_payment_method_id: "pm-onnuri" })]).card, undefined);
  eq("계좌 없어도 온누리 수단으로 잡힌 행은 바꿈", pick([card({ guessed_account_id: null, guessed_payment_method_id: "pm-onnuri" }), done({ guessed_payment_method_id: "pm-onnuri" })]).card, "acc-onnuri");
  eq("더 가까운 duplicate 카드 행이 있어도 pending 행을 바꿈", JSON.stringify(pick([card({ id: "dup", status: "duplicate", collected_at: at(90) }), card({ id: "p" }), done()])), JSON.stringify({ p: "acc-onnuri" }));
  eq("상호 2자 포함은 짝 아님", onnuriPairMerchantMatches("CU", "CU한빛점"), false);
  eq("이미 온누리로 고친 행이 짝을 차지 — 다른 행 안 건드림", JSON.stringify(pick([card({ id: "c1", guessed_account_id: "acc-onnuri" }), card({ id: "c2", collected_at: at(1000) }), done()])), "{}");

  // 배선: 조회 → update 가 실제로 나가는지(가짜 supabase, update 기록)
  const updates: { patch: Row; filters: Record<string, unknown> }[] = [];
  let raceConfirmed = false;
  const rows: Row[] = [
    { owner_auth_uid: OWNER, guessed_date: "2026-10-06", guessed_amount: 23700, ...(card() as Row) },
    { owner_auth_uid: OWNER, guessed_date: "2026-10-06", guessed_amount: 23700, ...(done() as Row) },
  ];
  const base = stub({ t: rows }) as unknown as { from: (t: string) => Record<string, unknown> };
  const sb = {
    from: () => {
      const api = base.from("t");
      api.update = (patch: Row) => {
        const filters: Record<string, unknown> = {};
        const u: Record<string, unknown> = {
          eq: (c: string, v: unknown) => { filters[c] = v; return u; },
          select: () => u,
          then: (res: (v: { data: Row[]; error: null }) => unknown) => {
            updates.push({ patch, filters });
            // raceConfirmed: 조회 뒤·갱신 전에 사람이 확정한 상황 — DB 는 pending 조건에 걸려 0행을 돌려준다.
            const hitRows = raceConfirmed ? [] : rows.filter((r) => r.id === filters.id && r.status === filters.status);
            return res({ data: hitRows.map((r) => ({ id: r.id })), error: null });
          },
        };
        return u;
      };
      return api;
    },
  } as never;
  eq("배선: 카드 행 1개 변경", JSON.stringify(await relabelOnnuriLinkedCardPayment(sb, OWNER, "2026-10-06", 23700)), JSON.stringify(["card"]));
  eq("배선: 계좌 = 온누리", updates[0]?.patch.guessed_account_id, "acc-onnuri");
  eq("배선: 결제수단 = 빈칸", updates[0]?.patch.guessed_payment_method_id, null);
  eq("배선: pending 일 때만 바꾸는 조건", updates[0]?.filters.status, "pending");
  raceConfirmed = true;
  eq("배선: 조회 뒤 확정된 행은 0행 갱신이라 안 셈", JSON.stringify(await relabelOnnuriLinkedCardPayment(sb, OWNER, "2026-10-06", 23700)), "[]");
  raceConfirmed = false;
  eq("배선: 다른 금액이면 변경 없음", JSON.stringify(await relabelOnnuriLinkedCardPayment(sb, OWNER, "2026-10-06", 1000)), "[]");
}

if (fail) {
  console.error(`\n❌ 설계 213·224 테스트 ${fail}개 실패`);
  process.exit(1);
}
console.log("\n✅ 설계 213·224 테스트 통과");
