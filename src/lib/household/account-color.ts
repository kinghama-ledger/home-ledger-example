/**
 * 계좌별 색 — '출금계좌 / 결제계좌' 칸을 **소유자 단위**로 가른다. (설계 127, 요구 사항 2026-08-03)
 *
 * ★설계 126(계좌마다 다른 색, 20색 팔레트)은 폐기됐다. 계좌 단위 색은 계좌를 추가·삭제하면
 *   전체 색이 밀리고, 20색을 훑어도 "이게 누구 통장인가"라는 실제 질문에는 답을 못 했다.
 *   필요한 구분은 **사람**이다: 내 통장인가, 배우자 통장인가, 아니면 카드인가.
 *
 * 배정 규칙
 *   - **등록된 인물 순서대로: 첫째 인물 계좌 = 연한 파랑, 둘째 인물 계좌 = 연한 주황.** 소유자가 같으면 은행이 달라도 같은 색이다.
 *     순서는 설정 → 인물의 '표시 순서'(같으면 이름순)다. 가상 가족이면 김하늘이 파랑, 이바다가 주황이다.
 *     예전에는 두 이름이 코드에 박혀 있어, 자기 가족을 등록하면 모든 통장이 초록 한 색이었다.
 *   - 그 밖의 소유자(셋째부터·공용·미상)는 연한 초록 — 두 사람 색과 겹치지 않게만 한다.
 *   - **카드 행은 CARD_TINT(회색)** — 계좌 색과 항상 구분된다. "통장에서 그날 빠지는 돈"과
 *     "카드대금일에 몰아 나가는 돈"이 색만으로 갈리는 것이 목적이다.
 *   - 소유자 판별: ① 계좌의 person_id(명의) ② 명의가 비어 있으면 계좌명에 든 인물 이름
 *     — 계좌명이 '국민은행(김하늘)'처럼 소유자를 품는 것이 이 앱의 명명 규칙이라 폴백이 안전하다.
 *   - 배경은 -50 이 아니라 **-100** 이다: -50 은 흰 배경 위에서 색이 거의 안 읽혔다(실측, 설계 126).
 *
 * ★클래스는 **문자열 리터럴 그대로** 둔다. Tailwind v4 는 소스를 훑어 클래스를 뽑으므로
 *   `bg-${c}-100` 처럼 조립하면 CSS 가 생성되지 않아 색이 통째로 안 나온다.
 * ★한 항목 안에서 같은 속성의 유틸을 겹치지 않는다(border/bg/text 각 1개) — 겹치면 뒤에 출력되는
 *   쪽이 이겨 의도한 색이 조용히 죽는다.
 */

/** 등록된 인물 순서 → 색. 첫째 인물이 파랑, 둘째 인물이 주황이다. */
const OWNER_TINTS_IN_ORDER: string[] = [
  "border-blue-400 bg-blue-100 text-blue-900 dark:border-blue-700 dark:bg-blue-950/60 dark:text-blue-200",
  "border-orange-400 bg-orange-100 text-orange-900 dark:border-orange-700 dark:bg-orange-950/60 dark:text-orange-200",
];

/** 그 밖의 소유자(셋째부터·공용·미상) — 두 사람 색과 계열이 겹치지 않는 연한 초록. */
const OWNER_TINT_ETC =
  "border-emerald-400 bg-emerald-100 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200";

/**
 * 카드 행 전용(**회색**) — 소유자 색 어느 것과도 다르다. 카드는 "그날 통장에서 안 빠지는" 별종이라
 * 색부터 갈라야 훑을 때 현금 유출 행과 섞이지 않는다. (설계 127)
 *
 * ★2026-08-04 요구 사항으로 연보라 → **회색**. 색이 있는 칸은 "그날 통장에서 실제로 빠지는 돈"이고,
 *   카드는 그날 안 빠지므로 **무채색이 맞다**(연보라는 소유자 색과 같은 무게로 읽혀 눈이 헷갈렸다).
 */
export const CARD_TINT =
  "border-gray-300 bg-gray-100 text-gray-600 dark:border-gray-600 dark:bg-gray-800/60 dark:text-gray-300";

/** 계좌가 안 정해진 칸(‘계좌 선택…’)은 색을 주지 않는다 — 색은 '정해졌다'는 신호다. */
export const ACCOUNT_TINT_NONE = "border-border/60 bg-background";

/**
 * 계좌 id → 소유자 색 클래스 묶음(border/bg/text).
 * persons 는 **등록된 순서대로**(sort_order, 이름) 넘긴다 — 그 순서가 색을 정한다.
 * 호출부는 `useMemo` 로 감싸 계좌·인물 목록이 바뀔 때만 다시 만든다.
 */
export function accountTintMap(
  accounts: { id: string; name: string; person_id?: string | null }[],
  persons: { id: string; name: string }[],
): Map<string, string> {
  const orderById = new Map(persons.map((p, i) => [p.id, i]));
  const m = new Map<string, string>();
  for (const a of accounts) {
    let order: number | undefined;
    if (a.person_id) {
      // 명의가 지정돼 있으면 그것이 답이다 — 제3의 인물 계좌를 이름 문자열로 두 사람 색에 오배정하지 않는다.
      order = orderById.get(a.person_id);
    } else {
      const byName = persons.findIndex((p) => p.name !== "" && a.name.includes(p.name));
      order = byName < 0 ? undefined : byName;
    }
    m.set(a.id, (order === undefined ? undefined : OWNER_TINTS_IN_ORDER[order]) ?? OWNER_TINT_ETC);
  }
  return m;
}
