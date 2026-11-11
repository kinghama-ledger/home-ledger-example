/**
 * 가계부 탭 모양 상수. `<TabsTrigger className={...}>` 에 덧입힌다.
 * (공식 ui 원본 `@/components/ui/tabs` 는 건드리지 않고 여기서 덧입힌다.)
 */

/**
 * 활성 탭을 '파란 칠 + 흰 글씨'로 강조하는 덧입힘. (설계 142)
 *
 * 기본값은 **옅은 회색 트랙 위의 흰 알약**이라 흰 배경 화면에서
 * 활성·비활성 구분이 거의 안 보였다. 사이드바의 활성 항목과 같은
 * 파란 칠을 써서 지금 어느 탭인지 한눈에 보이게 한다.
 *
 * `cn()` 이 겹치는 Tailwind 클래스를 합쳐 주므로 뒤에 오는 이 클래스가 기본값
 * (`data-[state=active]:bg-background`)을 대체한다 — CSS 출력 순서에 기대지 않는다.
 * 쓰는 곳: `<TabsTrigger className={HH_TAB_SOLID}>`.
 */
export const HH_TAB_SOLID =
  "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=inactive]:hover:bg-background/70";

/**
 * 하위 탭(화면 안쪽·카드 안에서 한 번 더 나뉘는 탭)용 — 같은 파랑을 **연하게**. (설계 143)
 *
 * 메인 탭(`HH_TAB_SOLID`, 파란 칠+흰 글씨)과 층위를 눈으로 구분하기 위한 것이다.
 * 옅은 파란 배경 + 파란 글씨라 활성은 뚜렷하되 메인 탭보다 가볍다.
 * 쓰는 곳: 지출 화면의 전체·현금·카드, 현금흐름의 출금 예정·익월 출금·보류.
 */
export const HH_TAB_SUB =
  "data-[state=active]:bg-primary/12 data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=inactive]:hover:bg-background/70";
