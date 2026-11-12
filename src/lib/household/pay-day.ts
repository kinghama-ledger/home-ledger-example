// 정기지출 납부일 입력 검증. (설계 178 후속)
//
// ★`pay_day = 31` 이 '매월 말일'이다 — 계산은 `calc.clampDayToMonth` 가 그 달 말일(30/28/29)로 줄인다(설계 178).
//   편집 창이 1~28 만 받으면, 말일로 등록된 항목(관리비·학원비 등)을 열어 다른 칸만 고쳐도 저장이 막힌다.
// 매주(weekly)는 요일(0~6)이라 여기서 검사하지 않는다.
export function payDayError(frequency: string, payDay: number | null): string | null {
  if (frequency === "weekly" || payDay == null) return null;
  if (!Number.isInteger(payDay) || payDay < 1 || payDay > 31) return "납부일은 1~31 사이여야 합니다(31 = 말일).";
  return null;
}
