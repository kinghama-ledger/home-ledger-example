// 설계 228 검증: 비이체 크로스소스 후보는 계좌가 확실히 다르면 같은 거래가 아니다.
//   확실 = 두 계좌가 다르고 · 한쪽이라도 메시지 잔액으로 증명되고 · 두 상호가 서로 관련 없음.
//   상호가 숫자·영문 전표 코드면 '관련 없음'의 근거가 못 된다(같은 결제의 다른 표기일 수 있다).
//
// 실행: npm run test:dedup-account   (DB 불필요 — 순수 함수 + 가짜 supabase 스텁)
// 값은 전부 가상이다(김하늘 가족의 국민은행·카카오뱅크·토스뱅크).
const { isConfidentlyDifferentAccount, isCrossSourceDuplicate } = await import("../src/lib/household/sms-ingest");

let fail = 0;
const eq = (name: string, a: unknown, b: unknown) => {
  if (Object.is(a, b)) console.log(`  ✅ ${name}`);
  else {
    fail++;
    console.log(`  ❌ ${name} — 기대 ${JSON.stringify(b)}, 실제 ${JSON.stringify(a)}`);
  }
};

const KAKAO = "acc-kakao-khn", KB = "acc-kb-khn", TOSS = "acc-toss-khn";
// 카카오뱅크 앱 알림: 적금 자동이체 100,000(계좌는 알지만 알림에 잔액은 없다)
const kakaoAuto = { guessed_account_id: KAKAO, guessed_from_account_id: null, reported_balance_account_id: null, guessed_merchant: "김하늘 (한빛적금)" };
// 같은 날 국민은행 출금 문자 100,000(문자에 잔액이 찍혀 계좌가 증명된다). 상대처는 아파트 관리비다.
const kbSms = { accountId: KB, fromAccountId: null, reportedBalanceAccountId: KB, merchant: "새봄아파트관리비" };
// 같은 문자인데 상대처 자리에 은행이 준 전표 코드가 찍힌 꼴.
const kbSmsCode = { ...kbSms, merchant: "0000000ABC000" };

console.log("\n[1] 잔액으로 증명된 국민은행 출금 vs 카카오뱅크 자동이체, 상호 무관");
eq("★문자(국민, 잔액) vs 알림(카카오) = 다른 거래", isConfidentlyDifferentAccount(kbSms, kakaoAuto), true);
eq(
  "★순서 반대(알림이 나중) = 후보 쪽 증명으로 다른 거래",
  isConfidentlyDifferentAccount(
    { accountId: KAKAO, reportedBalanceAccountId: null, merchant: kakaoAuto.guessed_merchant },
    { guessed_account_id: KB, reported_balance_account_id: KB, guessed_merchant: kbSms.merchant }
  ),
  true
);

console.log("\n[2] 양쪽 다 잔액으로 증명된 소액 입금 — 국민 입금 문자 vs 카카오뱅크 입금 알림");
eq(
  "다른 거래",
  isConfidentlyDifferentAccount(
    { accountId: KB, reportedBalanceAccountId: KB, merchant: "한빛상품권" },
    { guessed_account_id: KAKAO, reported_balance_account_id: KAKAO, guessed_merchant: "카카오뱅크 인증입금" }
  ),
  true
);

console.log("\n[3] 증명 없는 짐작끼리는 기존 판정 유지");
eq("둘 다 잔액 없음 = 중복 후보로 남긴다", isConfidentlyDifferentAccount({ ...kbSms, reportedBalanceAccountId: null }, kakaoAuto), false);
eq("잔액 계좌가 짐작 계좌와 다름 = 증명 아님", isConfidentlyDifferentAccount({ ...kbSms, reportedBalanceAccountId: KAKAO }, kakaoAuto), false);

console.log("\n[4] ★상호가 겹치면 계좌가 달라도 같은 거래 후보(학습된 계좌가 틀린 페이 알림)");
const payNotif = { guessed_account_id: TOSS, reported_balance_account_id: null, guessed_merchant: "네이버페이" };
eq("국민 출금 문자 '네이버페이'(잔액) vs 알림 '네이버페이'(학습=토스뱅크) = 중복 후보", isConfidentlyDifferentAccount({ ...kbSms, merchant: "네이버페이" }, payNotif), false);
eq("은행 문자가 상호를 자름 '씨유(CU)한빛푸' vs '씨유(CU)한빛푸르지오점'", isConfidentlyDifferentAccount({ ...kbSms, merchant: "씨유(CU)한빛푸" }, { ...payNotif, guessed_merchant: "씨유(CU)한빛푸르지오점" }), false);
eq("법인 표기 차이 '주식회사 한빛마트' vs '（주）한빛마트'", isConfidentlyDifferentAccount({ ...kbSms, merchant: "주식회사 한빛마트" }, { ...payNotif, guessed_merchant: "（주）한빛마트" }), false);
eq("상호 한쪽 없음 = 근거 부족", isConfidentlyDifferentAccount({ ...kbSms, merchant: null }, kakaoAuto), false);
eq("포함관계는 아니지만 토막이 겹침 '스타벅스강남R점' vs '스타벅스코리아'", isConfidentlyDifferentAccount({ ...kbSms, merchant: "스타벅스강남R점" }, { ...payNotif, guessed_merchant: "스타벅스코리아" }), false);
eq("대소문자·구두점 'NETFLIX.COM' vs 'Netflix'", isConfidentlyDifferentAccount({ ...kbSms, merchant: "NETFLIX.COM" }, { ...payNotif, guessed_merchant: "Netflix" }), false);
eq("짧은 상호(3자 미만) '쿠팡' vs '쿠페이' = 근거 부족", isConfidentlyDifferentAccount({ ...kbSms, merchant: "쿠팡" }, { ...payNotif, guessed_merchant: "쿠페이" }), false);
eq("★결제대행사 '토스페이먼츠'(은행 문자) vs '쿠팡'(알림) = 같은 결제일 수 있음", isConfidentlyDifferentAccount({ ...kbSms, merchant: "토스페이먼츠" }, { ...payNotif, guessed_merchant: "쿠팡" }), false);
eq("결제대행사가 알림 쪽 'KCP' 여도 근거 부족", isConfidentlyDifferentAccount({ ...kbSms, merchant: "스마트스토어상점" }, { ...payNotif, guessed_merchant: "(주)KCP" }), false);

console.log("\n[4-2] ★상호가 숫자·영문 전표 코드면 근거 부족 — 계좌가 달라 보여도 중복 후보로 남긴다");
const martNotif = { ...payNotif, guessed_merchant: "한빛마트" };
eq("은행 문자 상대처 '0000000ABC000' vs 알림 '한빛마트'(학습=토스뱅크)", isConfidentlyDifferentAccount(kbSmsCode, martNotif), false);
eq("전표 코드 vs 자동이체 알림 '김하늘 (한빛적금)'", isConfidentlyDifferentAccount(kbSmsCode, kakaoAuto), false);
eq(
  "코드가 후보 쪽에 있어도 같다",
  isConfidentlyDifferentAccount(
    { accountId: TOSS, reportedBalanceAccountId: null, merchant: "한빛마트" },
    { guessed_account_id: KB, reported_balance_account_id: KB, guessed_merchant: kbSmsCode.merchant }
  ),
  false
);
eq("숫자뿐인 코드 '120000'", isConfidentlyDifferentAccount({ ...kbSms, merchant: "120000" }, martNotif), false);
eq("영문+숫자 코드 '32961TAQ046'", isConfidentlyDifferentAccount({ ...kbSms, merchant: "32961TAQ046" }, martNotif), false);
eq("양쪽 다 잔액으로 증명돼도 코드면 근거 부족", isConfidentlyDifferentAccount(kbSmsCode, { ...martNotif, reported_balance_account_id: TOSS }), false);
eq("한글이 섞인 상호 'GS25새봄점'은 코드가 아니다 = 다른 거래", isConfidentlyDifferentAccount({ ...kbSms, merchant: "GS25새봄점" }, martNotif), true);
eq("숫자 없는 영문 상호 'STARBUCKS'도 코드가 아니다 = 다른 거래", isConfidentlyDifferentAccount({ ...kbSms, merchant: "STARBUCKS" }, martNotif), true);

console.log("\n[5] 같은 계좌·미상");
eq("같은 계좌 = 같은 거래 후보", isConfidentlyDifferentAccount(kbSms, { ...kakaoAuto, guessed_account_id: KB }), false);
eq("들어온 쪽 계좌 미상", isConfidentlyDifferentAccount({ ...kbSms, accountId: null }, kakaoAuto), false);
eq("후보 계좌 미상(신용카드 승인 등)", isConfidentlyDifferentAccount(kbSms, { ...kakaoAuto, guessed_account_id: null }), false);

console.log("\n[6] 계좌 칸이 비면 출금계좌(from)로 본다");
eq("후보 from 카카오뱅크 = 다른 거래", isConfidentlyDifferentAccount(kbSms, { ...kakaoAuto, guessed_account_id: null, guessed_from_account_id: KAKAO }), true);
eq("들어온 쪽 from 국민(잔액) vs 후보 국민 = 같은 거래 후보", isConfidentlyDifferentAccount({ ...kbSms, accountId: null, fromAccountId: KB }, { ...kakaoAuto, guessed_account_id: KB }), false);

console.log("\n[7] 연결 — 실제 판정 함수(isCrossSourceDuplicate)");
{
  const rows: Record<string, unknown>[] = [
    { id: "n1", owner_auth_uid: "o", source: "notification", status: "confirmed", guessed_date: "2026-10-26", guessed_amount: 100_000, guessed_type: "expense", ...kakaoAuto },
  ];
  const sb = {
    from: () => {
      let cur = rows.slice();
      const api: Record<string, unknown> = {
        select: () => api,
        eq: (c: string, v: unknown) => ((cur = cur.filter((r) => r[c] === v)), api),
        neq: (c: string, v: unknown) => ((cur = cur.filter((r) => r[c] != null && r[c] !== v)), api),
        in: (c: string, vs: unknown[]) => ((cur = cur.filter((r) => vs.includes(r[c]))), api),
        then: (res: (x: unknown) => unknown) => res({ data: cur, error: null }),
      };
      return api;
    },
  } as never;
  const inc = { type: "expense", toAccountId: null, ...kbSms };
  const dup = (i: Record<string, unknown>) => isCrossSourceDuplicate(sb, "o", "sms", "2026-10-26", 100_000, i as never);
  eq("★국민 출금(잔액 증명) = 중복 아님", await dup(inc), false);
  eq("잔액 증명 없으면 기존대로 중복", await dup({ ...inc, reportedBalanceAccountId: null }), true);
  eq("같은 계좌(카카오뱅크)면 중복", await dup({ ...inc, accountId: KAKAO, reportedBalanceAccountId: KAKAO }), true);
  eq("★상대처가 전표 코드면 잔액 증명이 있어도 중복 후보로 남는다", await dup({ ...inc, merchant: kbSmsCode.merchant }), true);
  // 들어온 쪽이 이체면 이체 판정(끝점 공유)만 본다 — 후보도 이체로 두고, 새 규칙이면 '다른 거래'일 짝이 중복으로 남는지 본다.
  rows[0] = { ...rows[0], guessed_type: "transfer", guessed_from_account_id: KAKAO, guessed_to_account_id: KB };
  eq("들어온 쪽이 이체면 이 규칙 밖(같은 끝점 국민 = 같은 이체)", await dup({ ...inc, type: "transfer", fromAccountId: null, toAccountId: KB, accountId: KB }), true);

  // ★수기 후보는 설계 107 이 맡는다 — 상호가 맞아 같은 거래로 본 수기 행을 계좌로 다시 빼지 않는다.
  rows.splice(0, 1, { id: "m1", owner_auth_uid: "o", source: "manual", status: "confirmed", guessed_date: "2026-10-26", guessed_amount: 100_000, guessed_type: "expense", guessed_account_id: KAKAO, guessed_merchant: kbSms.merchant });
  eq("★수기(계좌 잘못 고름, 상호 일치) + 늦게 온 문자 = 중복", await dup(inc), true);
}

console.log(fail ? `\n❌ 실패 ${fail}건` : "\n✅ 전부 통과");
if (fail) process.exitCode = 1;
