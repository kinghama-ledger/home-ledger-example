/**
 * 금액(원)을 만원 단위 글자로 바꾼다. 좁은 화면의 통계 카드와 그래프 눈금에 쓴다.
 * 0 은 "0원", 그 밖은 만원 단위로 반올림해 "1,234만원".
 */
export function formatManwon(won: number): string {
  if (won === 0) return "0원";
  const manwon = Math.round(won / 10_000);
  return `${manwon.toLocaleString("ko-KR")}만원`;
}
