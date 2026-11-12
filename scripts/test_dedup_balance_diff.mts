// 설계 211 검증: 같은 날·같은 금액·같은 끝점 이체라도 같은 계좌 잔액이 다르면 다른 거래로 본다.
//
// 실행: npx tsx scripts/test_dedup_balance_diff.mts   (DB 불필요 — 순수 함수)
// 가상 사례: 카카오뱅크(김하늘)→국민은행(김하늘) 50,000 을 오전(잔액 320,500)·오후(잔액 270,500) 두 번 보내면
//   끝점이 같아 가족이체 중복 판정이 둘째를 숨긴다. 값은 전부 가상이다.
const { isConfidentlyDifferentTransfer } = await import("../src/lib/household/sms-ingest");

let fail = 0;
const eq = (name: string, a: unknown, b: unknown) => {
  if (Object.is(a, b)) console.log(`  ✅ ${name}`);
  else {
    fail++;
    console.log(`  ❌ ${name} — 기대 ${JSON.stringify(b)}, 실제 ${JSON.stringify(a)}`);
  }
};

const KAKAO = "acc-kakao-khn", KB = "acc-kb-khn", SHINHAN = "acc-shinhan-lbd";
const first = { guessed_type: "transfer", guessed_from_account_id: KAKAO, guessed_to_account_id: KB, reported_balance: 320_500, reported_balance_account_id: KB, source: "sms" };

console.log("\n[1] 같은 끝점, 같은 계좌 잔액이 다르다");
eq("★두 번째 이체는 다른 거래", isConfidentlyDifferentTransfer({ fromAccountId: KAKAO, toAccountId: KB, reportedBalance: 270_500, reportedBalanceAccountId: KB, source: "sms" }, first), true);

console.log("\n[2] 재전송 — 같은 계좌·같은 잔액이면 여전히 같은 거래");
eq("같은 잔액 = 중복 후보로 남긴다", isConfidentlyDifferentTransfer({ fromAccountId: KAKAO, toAccountId: KB, reportedBalance: 320_500, reportedBalanceAccountId: KB, source: "sms" }, first), false);

console.log("\n[3] 같은 이체의 두 다리 — 잔액이 다른 계좌 것이면 비교하지 않는다");
eq("출금 다리(카카오뱅크 잔액) vs 입금 다리(국민은행 잔액) = 같은 거래", isConfidentlyDifferentTransfer({ fromAccountId: KAKAO, toAccountId: KB, reportedBalance: 800_000, reportedBalanceAccountId: KAKAO, source: "notification" }, first), false);

console.log("\n[4] 한쪽 잔액이 없으면 기존 판정 그대로");
eq("들어온 쪽 잔액 없음", isConfidentlyDifferentTransfer({ fromAccountId: KAKAO, toAccountId: KB }, first), false);
eq("후보 쪽 잔액 없음", isConfidentlyDifferentTransfer({ fromAccountId: KAKAO, toAccountId: KB, reportedBalance: 270_500, reportedBalanceAccountId: KB, source: "sms" }, { ...first, reported_balance: null }), false);
eq("후보 잔액 계좌 미상", isConfidentlyDifferentTransfer({ fromAccountId: KAKAO, toAccountId: KB, reportedBalance: 270_500, reportedBalanceAccountId: KB, source: "sms" }, { ...first, reported_balance_account_id: null }), false);

console.log("\n[5] 끝점 없이 잔액만 알아도 가려낸다");
eq("끝점 미상 + 같은 계좌 다른 잔액", isConfidentlyDifferentTransfer({ fromAccountId: null, toAccountId: null, reportedBalance: 270_500, reportedBalanceAccountId: KB, source: "sms" }, { ...first, guessed_from_account_id: null }), true);

console.log("\n[5b] 경로가 다르면 잔액을 비교하지 않는다");
eq("★문자 vs 알림, 같은 계좌·다른 잔액 = 중복 후보로 남긴다", isConfidentlyDifferentTransfer({ fromAccountId: KAKAO, toAccountId: KB, reportedBalance: 270_500, reportedBalanceAccountId: KB, source: "notification" }, first), false);
eq("들어온 쪽 경로 미상이면 비교 안 함", isConfidentlyDifferentTransfer({ fromAccountId: KAKAO, toAccountId: KB, reportedBalance: 270_500, reportedBalanceAccountId: KB }, first), false);

console.log("\n[5c] 알림은 같은 앱끼리만 잔액을 비교한다");
const notif = { ...first, source: "notification", source_adapter: "카카오뱅크" };
eq("★같은 앱 알림, 같은 계좌·다른 잔액 = 다른 거래", isConfidentlyDifferentTransfer({ fromAccountId: KAKAO, toAccountId: KB, reportedBalance: 270_500, reportedBalanceAccountId: KB, source: "notification", sourceAdapter: "카카오뱅크" }, notif), true);
eq("★다른 앱 알림 = 잔액 비교 안 함(중복 후보로 남긴다)", isConfidentlyDifferentTransfer({ fromAccountId: KAKAO, toAccountId: KB, reportedBalance: 270_500, reportedBalanceAccountId: KB, source: "notification", sourceAdapter: "가계부앱" }, notif), false);
eq("알림 앱 미상 = 비교 안 함", isConfidentlyDifferentTransfer({ fromAccountId: KAKAO, toAccountId: KB, reportedBalance: 270_500, reportedBalanceAccountId: KB, source: "notification" }, notif), false);

console.log("\n[5d] 같은 경로라도 잔액 계좌가 다르면 비교하지 않는다");
eq("같은 문자 경로, 잔액 계좌 다름 = 기존 판정(같은 이체)", isConfidentlyDifferentTransfer({ fromAccountId: KAKAO, toAccountId: KB, reportedBalance: 800_000, reportedBalanceAccountId: KAKAO, source: "sms" }, first), false);

console.log("\n[6] 기존 규칙 회귀 없음");
eq("비이체 후보는 다른 것", isConfidentlyDifferentTransfer({ fromAccountId: KAKAO, toAccountId: KB }, { guessed_type: "expense" }), true);
eq("끝점 안 겹침 = 다른 이체", isConfidentlyDifferentTransfer({ fromAccountId: SHINHAN, toAccountId: KAKAO }, { guessed_type: "transfer", guessed_from_account_id: KAKAO, guessed_to_account_id: KB }), true);

console.log(fail ? `\n❌ 실패 ${fail}건` : "\n✅ 전부 통과");
if (fail) process.exitCode = 1;
