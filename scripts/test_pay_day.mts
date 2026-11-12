// 정기지출 납부일 31(=말일) 검증 — DB 없이 순수 함수만 본다.  npm run test:pay-day
//   · 편집 창 검증 payDayError: 매월 1~31 허용, 0·32·소수 거부, 매주는 검사 안 함
//   · clampDayToMonth: 31 이 30일 달·2월(평년/윤년)에서 그 달 말일로 줄어든다(화면에 없는 날짜가 안 생긴다)
const { payDayError } = await import("../src/lib/household/pay-day");
const { clampDayToMonth } = await import("../src/lib/household/calc");

let fail = 0;
const eq = (name: string, a: unknown, b: unknown) => {
  if (Object.is(a, b)) console.log(`  ✅ ${name}`);
  else { fail++; console.log(`  ❌ ${name} — 기대 ${JSON.stringify(b)}, 실제 ${JSON.stringify(a)}`); }
};

console.log("\n[1] payDayError — 매월");
eq("1 허용", payDayError("monthly", 1), null);
eq("28 허용", payDayError("monthly", 28), null);
eq("★31(말일) 허용", payDayError("monthly", 31), null);
eq("격월 31 허용", payDayError("bimonthly", 31), null);
eq("빈칸 허용", payDayError("monthly", null), null);
eq("0 거부", typeof payDayError("monthly", 0), "string");
eq("32 거부", typeof payDayError("monthly", 32), "string");
eq("소수 거부", typeof payDayError("monthly", 12.5), "string");

console.log("\n[2] payDayError — 매주는 검사하지 않는다(요일 0~6)");
eq("매주 6", payDayError("weekly", 6), null);
eq("★매주 0(일요일) — 월 납부일 범위로 거부하지 않는다", payDayError("weekly", 0), null);

console.log("\n[3] clampDayToMonth — 31 = 그 달 말일");
eq("2027-01 → 31", clampDayToMonth(31, "2027-01"), 31);
eq("2027-04 → 30", clampDayToMonth(31, "2027-04"), 30);
eq("2027-02 → 28", clampDayToMonth(31, "2027-02"), 28);
eq("2028-02 → 29(윤년)", clampDayToMonth(31, "2028-02"), 29);
eq("12 는 그대로", clampDayToMonth(12, "2027-02"), 12);
eq("null 은 null", clampDayToMonth(null, "2027-04"), null);

console.log(fail === 0 ? "\n전부 통과 ✅" : `\n실패 ${fail}건 ❌`);
process.exit(fail === 0 ? 0 : 1);
