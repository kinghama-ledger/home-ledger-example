// 설계 206 검증: 문자가 계좌를 직접 특정한 은행 출금 문자에는 학습표가 준 신용카드를 붙이지 않는다.
//
// 실행: npx tsx scripts/test_bank_withdraw_credit_reject.mts   (DB 불필요 — 가짜 supabase 스텁으로 순수 검증)
//
// 가상 사례: `출금 12,300원 … 110-22-0***-456  네이버페이 체크카드출금 … 잔액…` 꼴의 은행 문자에
//   같은 가게를 예전에 삼성카드(김하늘, 신용)로 썼던 학습값이 붙는다. 돈은 계좌에서 나갔으므로
//   계좌가 진실이고 결제수단이 거짓이다 — 계좌를 지우면 실제 출금이 장부에서 사라진다.
//   설계 117 은 '카드 문자 + 학습된 계좌 → 계좌를 버린다' 를 막고, 여기서는 그 거울상을 막는다.
// 값은 전부 가상이다.
const { enrichParsed } = await import("../src/lib/household/sms-ingest");

let fail = 0;
const eq = (name: string, a: unknown, b: unknown) => {
  if (Object.is(a, b)) console.log(`  ✅ ${name}`);
  else {
    fail++;
    console.log(`  ❌ ${name} — 기대 ${JSON.stringify(b)}, 실제 ${JSON.stringify(a)}`);
  }
};

const OWNER = "owner-1";
const ACC_KB = "acc-kb"; // 국민은행(김하늘) — 문자의 계좌 끝자리가 여기를 가리킨다
const CAT_SHOP = "cat-shop";
const PM_SS_CREDIT = "pm-ss-credit"; // 삼성카드(김하늘) — credit
const PM_KB_CHECK = "pm-kb-check"; // 국민카드(김하늘) 체크카드 — check
const PM_SS_INSTALL = "pm-ss-install"; // 할부 카드 — installment

type Row = Record<string, unknown>;

/** enrichParsed 가 쓰는 만큼만 구현한 체이너블 supabase 스텁(test_unmatched_card_fallback 과 같은 관례). */
function stub(tables: Record<string, Row[]>, failTable?: string) {
  const build = (rows: Row[], table: string) => {
    const forcedError = failTable === table ? { message: `stub: ${table} 조회 실패` } : null;
    let cur = rows;
    const api: Record<string, unknown> = {
      select: () => api,
      order: () => api,
      limit: (n: number) => {
        cur = cur.slice(0, n);
        return api;
      },
      not: () => api,
      gte: (col: string, val: unknown) => {
        cur = cur.filter((r) => !(col in r) || String(r[col]) >= String(val));
        return api;
      },
      lte: (col: string, val: unknown) => {
        cur = cur.filter((r) => !(col in r) || String(r[col]) <= String(val));
        return api;
      },
      ilike: (col: string, pat: string) => {
        const needle = String(pat).replace(/%/g, "");
        cur = cur.filter((r) => !(col in r) || String(r[col] ?? "").includes(needle));
        return api;
      },
      eq: (col: string, val: unknown) => {
        cur = cur.filter((r) => !(col in r) || r[col] === val);
        return api;
      },
      // 조회 실패 경로를 검증하려면 스텁이 에러를 흉내낼 수 있어야 한다 — 실패 시 data 를 비우고 error 를 준다.
      maybeSingle: async () => (forcedError ? { data: null, error: forcedError } : { data: cur[0] ?? null, error: null }),
      then: (resolve: (v: { data: Row[] | null; error: { message: string } | null }) => unknown) =>
        resolve(forcedError ? { data: null, error: forcedError } : { data: cur, error: null }),
    };
    return api;
  };
  return { from: (tbl: string) => build(structuredClone(tables[tbl] ?? []), tbl) } as never;
}

const METHOD_SS_CREDIT: Row = {
  owner_auth_uid: OWNER,
  id: PM_SS_CREDIT,
  name: "삼성카드(김하늘)",
  kind: "credit",
  card_no: "1111-2222-3333-1234",
  linked_account_id: ACC_KB,
};
const METHOD_KB_CHECK: Row = {
  owner_auth_uid: OWNER,
  id: PM_KB_CHECK,
  name: "국민카드(김하늘) 체크카드",
  kind: "check",
  card_no: "1111-2222-3333-5550",
  linked_account_id: ACC_KB,
};
const METHOD_SS_INSTALL: Row = {
  owner_auth_uid: OWNER,
  id: PM_SS_INSTALL,
  name: "삼성카드(김하늘) 할부",
  kind: "installment",
  card_no: "1111-2222-3333-4455",
  linked_account_id: ACC_KB,
};

/** 학습표가 '네이버페이 → (주어진 결제수단)' 을 배운 상태. 계좌는 학습하지 않았다(신용카드라 null). */
const tables = (learnedPm: string | null, methods: Row[]): Record<string, Row[]> => ({
  hh_merchant_map: [{ owner_auth_uid: OWNER, merchant_key: "네이버페이", category_id: CAT_SHOP, payment_method_id: learnedPm, account_id: null }],
  hh_account: [{ owner_auth_uid: OWNER, id: ACC_KB, name: "국민은행(김하늘)", account_no: "110-22-0456-789", person_id: "p-khn", is_active: true }],
  hh_payment_method: methods,
  hh_person: [{ owner_auth_uid: OWNER, id: "p-khn", name: "김하늘" }],
  hh_category: [],
  hh_loan: [],
  hh_scheduled_payment: [],
});

// 계좌 끝자리 + 잔액이 있는 은행 출금 문자.
// ★마스킹된 형식이어야 파서가 계좌 앞자리를 뽑는다. 마스킹을 벗기면 계좌를 문자에서 특정하지 못해
//   이 시험이 설계 206 이 아니라 설계 117 경로를 검사하게 된다.
const SMS_BANK = "출금 12,300원김*늘님 03/14 09:21 110-22-0***-456  네이버페이 체크카드출금 12,300 잔액987,650";

console.log("\n[1] ★본체 — 은행 출금 문자에 학습된 신용카드가 붙으면 안 된다 (계좌는 남아야 한다)");
{
  const { parsed, fields } = await enrichParsed(stub(tables(PM_SS_CREDIT, [METHOD_SS_CREDIT])), OWNER, SMS_BANK, null);
  eq("끝4 없음(카드 문자가 아니다)", parsed.cardLast4, null);
  eq("★결제수단 = 빈칸 (학습된 신용카드 차단)", fields.guessed_payment_method_id, null);
  eq("★출금계좌 = 국민은행 (문자가 지목했다 — 지우면 안 된다)", fields.guessed_account_id, ACC_KB);
  eq("카테고리 학습값은 유지", fields.guessed_category_id, CAT_SHOP);
  eq("금액", fields.guessed_amount, 12300);
}

console.log("\n[2] ★본체 — 할부(installment)도 같다");
{
  const { fields } = await enrichParsed(stub(tables(PM_SS_INSTALL, [METHOD_SS_INSTALL])), OWNER, SMS_BANK, null);
  eq("결제수단 = 빈칸", fields.guessed_payment_method_id, null);
  eq("출금계좌 = 국민은행 유지", fields.guessed_account_id, ACC_KB);
}

console.log("\n[3] 회귀 — 학습값이 체크카드면 막지 않는다 (즉시 출금이라 은행 문자와 모순이 없다)");
{
  const { fields } = await enrichParsed(stub(tables(PM_KB_CHECK, [METHOD_KB_CHECK])), OWNER, SMS_BANK, null);
  eq("★결제수단 = 체크카드 유지", fields.guessed_payment_method_id, PM_KB_CHECK);
  eq("출금계좌 = 국민은행 유지", fields.guessed_account_id, ACC_KB);
}

console.log("\n[4] 회귀 — 문자가 끝4로 지목한 신용카드는 은행 문자여도 건드리지 않는다");
{
  // 카드 끝4(1234)가 본문에 있어 문자가 카드를 지목한다 → 206 이 발동하면 안 된다.
  const sms = "국민은행 출금 12,300원 김*늘님 03/14 09:21 110-22-0***-456 삼성1234승인 네이버페이 잔액987,650";
  const { parsed, fields } = await enrichParsed(stub(tables(null, [METHOD_SS_CREDIT])), OWNER, sms, null);
  eq("끝4를 문자에서 읽었다", parsed.cardLast4, "1234");
  eq("★결제수단 = 그 카드 유지(문자가 지목했다)", fields.guessed_payment_method_id, PM_SS_CREDIT);
}

console.log("\n[5] 회귀 — 카드사 승인 문자는 종전대로(설계 117 이 계좌를 비운다)");
{
  // 학습표에 계좌를 넣어야 이 검사가 의미가 있다 — 계좌가 애초에 null 이면 117 을 꺼도 통과한다.
  const withAcct: Record<string, Row[]> = {
    ...tables(PM_SS_CREDIT, [METHOD_SS_CREDIT]),
    hh_merchant_map: [
      { owner_auth_uid: OWNER, merchant_key: "네이버페이", category_id: CAT_SHOP, payment_method_id: PM_SS_CREDIT, account_id: ACC_KB },
    ],
  };
  const sms = "삼성카드 삼성1234승인 김*늘 34,500원 일시불 03/14 09:21 네이버페이 누적1,234,500원";
  const { fields } = await enrichParsed(stub(withAcct), OWNER, sms, null);
  eq("결제수단 = 신용카드(문자가 지목)", fields.guessed_payment_method_id, PM_SS_CREDIT);
  eq("★출금계좌 = 빈칸 (학습표에 계좌가 있었는데 설계 117 이 비웠다)", fields.guessed_account_id, null);
}

console.log("\n[6] 회귀 — 계좌를 특정 못 한 문자는 종전대로 학습 폴백을 쓴다(206 이 넓게 안 막는다)");
{
  // 계좌 끝자리가 없어 문자가 계좌를 지목하지 않는다 → 기존 블록(설계 107·117) 관할이다.
  const sms = "출금 12,300원 김*늘님 03/14 09:21 네이버페이 12,300";
  const { fields } = await enrichParsed(stub(tables(PM_KB_CHECK, [METHOD_KB_CHECK])), OWNER, sms, null);
  eq("결제수단 = 학습된 체크카드", fields.guessed_payment_method_id, PM_KB_CHECK);
  eq("출금계좌 = 연결계좌(설계 107)", fields.guessed_account_id, ACC_KB);
}

console.log("\n[7] ★조회 실패 — 종류를 확인 못 하면 안전하게 비운다(fail-closed)");
{
  const { fields } = await enrichParsed(stub(tables(PM_SS_CREDIT, [METHOD_SS_CREDIT]), "hh_payment_method"), OWNER, SMS_BANK, null);
  eq("★결제수단 = 빈칸 (조회 실패 시 fail-closed)", fields.guessed_payment_method_id, null);
  eq("출금계좌 = 국민은행 유지", fields.guessed_account_id, ACC_KB);
}

console.log("\n[8] ★취소 문자에는 걸지 않는다 — 삭제 대상 탐색이 넓어지면 안 된다");
{
  // 원문에 '취소' 가 있으면 cancel 로 분류된다. 결제수단을 비우면 취소 대상 필터가 사라져
  // 같은 금액의 다른 카드 거래가 지목될 수 있으므로 취소는 가드 대상에서 뺀다.
  const sms = "출금취소 12,300원김*늘님 03/14 09:21 110-22-0***-456  네이버페이 12,300 잔액987,650";
  const { parsed, fields } = await enrichParsed(stub(tables(PM_SS_CREDIT, [METHOD_SS_CREDIT])), OWNER, sms, null);
  eq("취소로 분류된다", parsed.kind, "cancel");
  eq("★결제수단 = 학습값 그대로 유지(취소 대상 필터를 지키기 위해)", fields.guessed_payment_method_id, PM_SS_CREDIT);
}

console.log("\n[9] ★할부로 재분류되는 문자에는 걸지 않는다 — 수단·계좌가 둘 다 비면 확정이 막힌다");
{
  const sms = "승인 12,300원 김*늘님 03/14 09:21 110-22-0***-456 네이버페이 3개월 할부";
  const { fields } = await enrichParsed(stub(tables(PM_SS_CREDIT, [METHOD_SS_CREDIT])), OWNER, sms, null);
  const confirmable = fields.guessed_payment_method_id != null || fields.guessed_account_id != null;
  eq("★결제수단 또는 계좌 중 하나는 남아 확정할 수 있다", confirmable, true);
}

console.log(fail === 0 ? "\n전부 통과 ✅" : `\n실패 ${fail}건 ❌`);
process.exit(fail === 0 ? 0 : 1);
