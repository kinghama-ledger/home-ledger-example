// 설계 129 검증: 지역화폐(한빛페이) 충전 문자의 이체 계좌 해석.
//
// 실행: npm run test:localpay-charge   (DB 불필요 — 가짜 supabase 스텁으로 순수 검증)
//
// 사례: 두 명의가 같은 날 같은 금액(300,000원)을 충전하면
//   ⓐ 규칙(설계 52)의 하드코딩된 from("카카오뱅크(김하늘)")이 **문자가 지목한 계좌를 덮어써서**
//      국민은행(이바다) 출금이 카카오뱅크(김하늘) 출금으로 잡히고 → 두 건의 날짜·금액·출금계좌가
//      같아지며 뒤엣것이 '중복'으로 걸러져 **거래 1건이 장부에서 통째로 빠진다**.
//   ⓑ 규칙의 to("지역화폐")는 어느 계좌명과도 안 맞아 **항상 null** → 확정 RPC 가
//      '이체는 입금계좌가 필요합니다'로 막아 충전 문자는 확정 자체가 불가능하다.
// 아래 [1]·[2]·[3] 이 그 재발을 막는다. [4]·[5] 는 잔액 귀속(설계 71) 가드다.
const { enrichParsed } = await import("../src/lib/household/sms-ingest");

let fail = 0;
const eq = (name: string, a: unknown, b: unknown) => {
  if (Object.is(a, b)) console.log(`  ✅ ${name}`);
  else {
    fail++;
    console.log(`  ❌ ${name} — 기대 ${JSON.stringify(b)}, 실제 ${JSON.stringify(a)}`);
  }
};
const ne = (name: string, a: unknown, b: unknown) => {
  if (!Object.is(a, b)) console.log(`  ✅ ${name}`);
  else {
    fail++;
    console.log(`  ❌ ${name} — ${JSON.stringify(a)} 와 같으면 안 된다`);
  }
};

const OWNER = "owner-1";
const P_KHN = "p-khn";
const P_LBD = "p-lbd";
const ACC_KB_LBD = "acc-kb-lbd"; // 국민은행(이바다)  110-11-0***-111
const ACC_KAKAO_KHN = "acc-kakao-khn"; // 카카오뱅크(김하늘) 1000-****-0000
const ACC_KAKAO_LBD = "acc-kakao-lbd"; // 카카오뱅크(이바다) 300-20-**1111
const ACC_PAY_LBD = "acc-pay-lbd"; // 한빛페이(이바다)  계좌번호 없음
const ACC_PAY_KHN = "acc-pay-khn"; // 한빛페이(김하늘)  계좌번호 없음
const PM_KB_CHECK = "pm-kb-check"; // 국민카드(이바다) 체크카드 끝4 5550 → 국민은행(이바다) 연결
const CAT_FOOD = "cat-food";

type Row = Record<string, unknown>;

/** enrichParsed 가 쓰는 만큼만 구현한 체이너블 supabase 스텁(test_unmatched_card_fallback 과 동일 구조). */
function stub(tables: Record<string, Row[]>) {
  const build = (rows: Row[]) => {
    let cur = rows;
    const api: Record<string, unknown> = {
      select: () => api,
      order: () => api,
      limit: (n: number) => {
        cur = cur.slice(0, n);
        return api;
      },
      not: () => api,
      // 설계 194 의 지난 확정 조회(.gte/.lte txn_date) 가 쓴다 — 행에 그 컬럼이 있을 때만 문자열 비교로 거른다.
      gte: (col: string, val: unknown) => { cur = cur.filter((r) => !(col in r) || String(r[col]) >= String(val)); return api; },
      lte: (col: string, val: unknown) => { cur = cur.filter((r) => !(col in r) || String(r[col]) <= String(val)); return api; },
      ilike: (col: string, pat: string) => {
        const needle = String(pat).replace(/%/g, "");
        cur = cur.filter((r) => !(col in r) || String(r[col] ?? "").includes(needle));
        return api;
      },
      eq: (col: string, val: unknown) => {
        cur = cur.filter((r) => !(col in r) || r[col] === val);
        return api;
      },
      maybeSingle: async () => ({ data: cur[0] ?? null, error: null }),
      then: (resolve: (v: { data: Row[]; error: null }) => unknown) => resolve({ data: cur, error: null }),
    };
    return api;
  };
  return { from: (t: string) => build(structuredClone(tables[t] ?? [])) } as never;
}

const ACCOUNTS: Row[] = [
  { owner_auth_uid: OWNER, id: ACC_KB_LBD, name: "국민은행(이바다)", account_no: "110-11-0***-111", person_id: P_LBD, is_active: true },
  { owner_auth_uid: OWNER, id: ACC_KAKAO_KHN, name: "카카오뱅크(김하늘)", account_no: "1000-****-0000", person_id: P_KHN, is_active: true },
  { owner_auth_uid: OWNER, id: ACC_KAKAO_LBD, name: "카카오뱅크(이바다)", account_no: "300-20-**1111", person_id: P_LBD, is_active: true },
  { owner_auth_uid: OWNER, id: ACC_PAY_LBD, name: "한빛페이(이바다)", account_no: null, person_id: P_LBD, is_active: true },
  { owner_auth_uid: OWNER, id: ACC_PAY_KHN, name: "한빛페이(김하늘)", account_no: null, person_id: P_KHN, is_active: true },
];

/** merchant_map 이 '지역화폐'를 김하늘 카카오뱅크로 학습해 둔 상태 — 이바다 문자에 이게 붙으면 안 된다. */
const tables = (): Record<string, Row[]> => ({
  hh_merchant_map: [
    { owner_auth_uid: OWNER, merchant_key: "지역화폐 오픈뱅킹", category_id: null, payment_method_id: null, account_id: ACC_KAKAO_KHN },
    { owner_auth_uid: OWNER, merchant_key: "달빛(Dalbit)", category_id: CAT_FOOD, payment_method_id: null, account_id: ACC_KB_LBD },
  ],
  hh_account: ACCOUNTS,
  hh_payment_method: [
    {
      owner_auth_uid: OWNER,
      id: PM_KB_CHECK,
      name: "국민카드(이바다) 체크카드",
      kind: "check",
      card_no: "1234-5678-9012-5550",
      linked_account_id: ACC_KB_LBD,
      is_active: true,
    },
  ],
  hh_person: [
    { owner_auth_uid: OWNER, id: P_KHN, name: "김하늘" },
    { owner_auth_uid: OWNER, id: P_LBD, name: "이바다" },
  ],
  hh_category: [],
  hh_loan: [],
  hh_scheduled_payment: [],
});

// 예시 원문 2건(형태는 은행 문자·앱 알림 그대로, 값은 가상 — 계좌는 샘플 계좌에 맞춘 예시). 형태를 바꾸지 말 것 — 이 형태가 결함을 드러낸다.
const SMS_LBD = "출금 300,000원이*다님 08/03 19:41 110-11-0***-111 지역화폐 오픈뱅킹출금 300,000 잔액3,740,503";
const NOTI_KHN = "300,000원 출금 내 토스뱅크 통장 → 코나아이(주)(지역화폐)";

console.log("\n[1] 이바다 은행 SMS — 문자가 지목한 계좌(국민은행(이바다))가 규칙 from 을 이긴다");
const lbd = await enrichParsed(stub(tables()), OWNER, SMS_LBD, null);
{
  const { fields } = lbd;
  eq("유형 = 이체", fields.guessed_type, "transfer");
  eq("금액", fields.guessed_amount, 300000);
  eq("★출금계좌 = 국민은행(이바다) (규칙·학습값이 아니라 문자)", fields.guessed_from_account_id, ACC_KB_LBD);
  eq("★입금계좌 = 한빛페이(이바다) (같은 주인의 지갑)", fields.guessed_to_account_id, ACC_PAY_LBD);
  eq("이체라 단일계좌는 비운다", fields.guessed_account_id, null);
  eq("잔액", fields.reported_balance, 3740503);
  eq("잔액 귀속 = 국민은행(이바다)", fields.reported_balance_account_id, ACC_KB_LBD);
}

console.log("\n[2] 김하늘 토스 알림 — 문자에 계좌가 없으니 규칙 from 이 폴백으로 쓰인다");
const khn = await enrichParsed(stub(tables()), OWNER, NOTI_KHN, null);
{
  const { fields } = khn;
  eq("유형 = 이체", fields.guessed_type, "transfer");
  eq("출금계좌 = 카카오뱅크(김하늘) (규칙 폴백)", fields.guessed_from_account_id, ACC_KAKAO_KHN); // 규칙의 출금 계좌는 샘플 계좌에 맞춘 예시
  eq("★입금계좌 = 한빛페이(김하늘) (같은 주인의 지갑)", fields.guessed_to_account_id, ACC_PAY_KHN);
}

console.log("\n[3] ★두 명의가 같은 날 같은 금액을 충전해도 두 건이 서로 다른 끝점을 갖는다(중복 오판 방지)");
{
  ne("출금계좌가 서로 다르다", lbd.fields.guessed_from_account_id, khn.fields.guessed_from_account_id);
  ne("입금계좌가 서로 다르다", lbd.fields.guessed_to_account_id, khn.fields.guessed_to_account_id);
  eq("금액은 같다(그래서 계좌가 갈려야 한다)", lbd.fields.guessed_amount, khn.fields.guessed_amount);
}

console.log("\n[4] 잔액 귀속 — 계좌 근거가 문자에 없으면(학습값으로만 채워짐) 잔액을 아무 계좌에 붙이지 않는다");
{
  const sms = "출금 54,000원 이*다님 08/03 12:53 달빛(Dalbit) 자동이체 54,000 잔액 1,000,000";
  const { fields } = await enrichParsed(stub(tables()), OWNER, sms, null);
  eq("출금계좌는 학습값 그대로(설계 117 회귀)", fields.guessed_account_id, ACC_KB_LBD);
  eq("잔액은 보존", fields.reported_balance, 1000000);
  eq("★잔액 귀속 계좌 = 빈칸 (문자에 근거 없음)", fields.reported_balance_account_id, null);
}

console.log("\n[5] 잔액 귀속 회귀 — 문자가 지목한 체크카드의 '잔액'은 연결계좌에 귀속한다");
{
  const sms = "국민카드 국민5550승인 이*다 12,000원 일시불 08/03 19:41 달빛(Dalbit) 잔액 3,740,503";
  const { fields } = await enrichParsed(stub(tables()), OWNER, sms, null);
  eq("결제수단 = 국민 체크카드", fields.guessed_payment_method_id, PM_KB_CHECK);
  eq("출금계좌 = 연결계좌(설계 107)", fields.guessed_account_id, ACC_KB_LBD);
  eq("잔액 귀속 = 연결계좌", fields.reported_balance_account_id, ACC_KB_LBD);
}

// ── 설계 226: 토스페이 충전 알림은 이체 ─────────────────────────────────────
// 값은 전부 가상이다(김하늘 가족). 알림 형태만 토스 앱 알림 꼴을 따른다.
const ACC_TOSS_KHN = "acc-toss-khn"; // 토스뱅크(김하늘) 계좌번호 없음
const ACC_TOSSPAY_KHN = "acc-tosspay-khn"; // 토스페이(김하늘) 계좌번호 없음
const CAT_SUB = "cat-sub"; // 구독료
const NOTI_TOSSPAY_CHARGE = "100,000원 출금 내 토스뱅크 통장 → (주)비바리퍼블리카(토스페이충전)";
/** 학습 키 `토스페이`(국민은행(이바다)·구독료·체크카드)가 이미 있는 상태 — 충전 알림이 이 키에 끌려가면 안 된다. */
const tossPayTables = (): Record<string, Row[]> => ({
  ...tables(),
  hh_account: [
    ...ACCOUNTS,
    { owner_auth_uid: OWNER, id: ACC_TOSS_KHN, name: "토스뱅크(김하늘)", account_no: null, person_id: P_KHN, is_active: true },
    { owner_auth_uid: OWNER, id: ACC_TOSSPAY_KHN, name: "토스페이(김하늘)", account_no: null, person_id: P_KHN, is_active: true },
  ],
  hh_merchant_map: [
    ...tables().hh_merchant_map,
    { owner_auth_uid: OWNER, merchant_key: "토스페이", category_id: CAT_SUB, payment_method_id: PM_KB_CHECK, account_id: ACC_KB_LBD },
  ],
});

console.log("\n[6] 설계 226 — 토스뱅크→토스페이 충전 알림은 이체(학습 키 `토스페이` 가 있어도)");
{
  const { parsed, fields } = await enrichParsed(stub(tossPayTables()), OWNER, NOTI_TOSSPAY_CHARGE, null);
  eq("상대처 = 비바리퍼블리카(토스페이충전)(전제)", parsed.merchant, "비바리퍼블리카(토스페이충전)");
  eq("유형 = 이체", fields.guessed_type, "transfer");
  eq("★출금계좌 = 토스뱅크(김하늘) (학습 키의 국민은행이 아니라)", fields.guessed_from_account_id, ACC_TOSS_KHN);
  eq("입금계좌 = 토스페이(김하늘)", fields.guessed_to_account_id, ACC_TOSSPAY_KHN);
  eq("이체라 단일계좌는 비운다", fields.guessed_account_id, null);
  eq("이체라 분류는 비운다(구독료 아님)", fields.guessed_category_id ?? null, null);
  eq("이체라 학습된 결제수단도 비운다", fields.guessed_payment_method_id ?? null, null);
}

console.log("\n[7] 설계 226 — 같은 주인의 '토스페이' 계좌가 둘이면 입금계좌를 고르지 않는다");
{
  const t = tossPayTables();
  t.hh_account = [...t.hh_account, { owner_auth_uid: OWNER, id: "acc-tosspay-point-khn", name: "토스페이포인트(김하늘)", account_no: null, person_id: P_KHN, is_active: true }];
  const { fields } = await enrichParsed(stub(t), OWNER, NOTI_TOSSPAY_CHARGE, null);
  eq("유형 = 이체", fields.guessed_type, "transfer");
  eq("★입금계좌 = 빈칸 (모호하면 고르지 않는다)", fields.guessed_to_account_id, null);
}

console.log("\n[8] 설계 226 — 토스페이로 나간 구독료 출금은 그대로 지출");
{
  const { parsed, fields } = await enrichParsed(stub(tossPayTables()), OWNER, "5,900원 출금 내 토스뱅크 통장 → (주)비바리퍼블리카(토스페이)", null);
  eq("상대처 = 비바리퍼블리카(토스페이)(전제)", parsed.merchant, "비바리퍼블리카(토스페이)");
  ne("★유형 ≠ 이체", fields.guessed_type, "transfer");
  eq("입금계좌를 채우지 않는다", fields.guessed_to_account_id, null);
}

console.log("\n[9] 설계 226 — 규칙 판정: 출금만 · 충전 키만");
{
  const { matchTransferRule } = await import("../src/lib/household/defaults");
  eq("토스페이충전 + withdraw → 토스페이", matchTransferRule("비바리퍼블리카(토스페이충전)", "withdraw")?.to, "토스페이");
  eq("토스페이충전 + kind 없음 → null", matchTransferRule("비바리퍼블리카(토스페이충전)"), null);
  eq("토스페이충전 + deposit → null(환불·취소 방향)", matchTransferRule("비바리퍼블리카(토스페이충전)", "deposit"), null);
  eq("토스페이충전 + transfer → null", matchTransferRule("비바리퍼블리카(토스페이충전)", "transfer"), null);
  eq("토스페이충전 + approve → null", matchTransferRule("비바리퍼블리카(토스페이충전)", "approve"), null);
  eq("비바리퍼블리카(토스페이) + withdraw → null", matchTransferRule("비바리퍼블리카(토스페이)", "withdraw"), null);
  eq("토스페이 + withdraw → null", matchTransferRule("토스페이", "withdraw"), null);
  eq("종류 제한 없는 기존 규칙은 kind 없이도 발동(지역화폐)", matchTransferRule("코나아이(주)(지역화폐)")?.to, "한빛페이");
}

console.log("\n[10] 설계 226 — 해지 지갑은 후보에서 빠진다(해지 계좌 때문에 입금계좌가 빈칸이 되지 않는다)");
{
  const t = tossPayTables();
  t.hh_account = [...t.hh_account, { owner_auth_uid: OWNER, id: "acc-tosspay-old-khn", name: "토스페이(김하늘)_해지", account_no: null, person_id: P_KHN, is_active: false }];
  const { fields } = await enrichParsed(stub(t), OWNER, NOTI_TOSSPAY_CHARGE, null);
  eq("입금계좌 = 활성 토스페이(김하늘)", fields.guessed_to_account_id, ACC_TOSSPAY_KHN);
}

console.log(fail === 0 ? "\n전부 통과 ✅" : `\n실패 ${fail}건 ❌`);
process.exit(fail === 0 ? 0 : 1);
