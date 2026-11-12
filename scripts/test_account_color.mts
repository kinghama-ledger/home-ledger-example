// 출금계좌 칸 색: 등록된 인물 순서대로 첫째 파랑·둘째 주황, 그 밖은 초록. 가상 가족 이름에 묶이지 않는다.
const { accountTintMap } = await import("../src/lib/household/account-color");

let pass = 0;
let fail = 0;
function check(label: string, actual: unknown, expected: unknown) {
  if (actual === expected) {
    pass += 1;
    console.log(`  OK ${label}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}
const color = (tint: string | undefined) =>
  !tint
    ? "none"
    : tint.includes("bg-blue-100")
      ? "blue"
      : tint.includes("bg-orange-100")
        ? "orange"
        : tint.includes("bg-emerald-100")
          ? "green"
          : "other";

// 가상 가족(예제 자료) — 책 그림과 같은 색이어야 한다
const demoPersons = [
  { id: "p1", name: "김하늘" },
  { id: "p2", name: "이바다" },
  { id: "p3", name: "가족" },
];
const demo = accountTintMap(
  [
    { id: "a1", name: "국민은행(김하늘)", person_id: "p1" },
    { id: "a2", name: "신한은행(이바다)", person_id: "p2" },
    { id: "a3", name: "생활비 통장", person_id: "p3" },
    { id: "a4", name: "한빛페이(김하늘)", person_id: "p1" },
  ],
  demoPersons,
);
check("가상 가족: 첫째 인물 계좌는 파랑", color(demo.get("a1")), "blue");
check("가상 가족: 둘째 인물 계좌는 주황", color(demo.get("a2")), "orange");
check("가상 가족: 셋째 인물 계좌는 초록", color(demo.get("a3")), "green");
check("주인이 같으면 은행이 달라도 같은 색", color(demo.get("a4")), "blue");

// 다른 이름의 가족 — 이름이 무엇이든 순서로 색이 갈린다
const myPersons = [
  { id: "x1", name: "박나래" },
  { id: "x2", name: "최도윤" },
];
const mine = accountTintMap(
  [
    { id: "b1", name: "월급 통장", person_id: "x1" },
    { id: "b2", name: "배우자 통장", person_id: "x2" },
    { id: "b3", name: "모임 통장", person_id: null },
    { id: "b4", name: "비상금(최도윤)", person_id: null },
    { id: "b5", name: "적금(최도윤)", person_id: "x1" },
    { id: "b6", name: "옛 통장(박나래)", person_id: "지워진-인물" },
  ],
  myPersons,
);
check("다른 가족: 첫째 인물 계좌는 파랑", color(mine.get("b1")), "blue");
check("다른 가족: 둘째 인물 계좌는 주황", color(mine.get("b2")), "orange");
check("명의가 없고 이름에도 인물이 없으면 초록", color(mine.get("b3")), "green");
check("명의가 없으면 계좌명에 든 인물 이름으로", color(mine.get("b4")), "orange");
check("명의가 있으면 계좌명보다 명의가 이긴다", color(mine.get("b5")), "blue");
check("명의가 목록에 없는 인물이면 이름으로 넘겨짚지 않는다", color(mine.get("b6")), "green");

// 순서를 바꾸면 색도 바뀐다
const swapped = accountTintMap([{ id: "b1", name: "월급 통장", person_id: "x1" }], [myPersons[1], myPersons[0]]);
check("인물 순서가 색을 정한다", color(swapped.get("b1")), "orange");

// 인물이 없을 때
const none = accountTintMap([{ id: "c1", name: "국민은행(김하늘)", person_id: null }], []);
check("등록된 인물이 없으면 가상 이름이 들어 있어도 초록", color(none.get("c1")), "green");

console.log(`\nResult: ${pass} passed / ${fail} failed`);
process.exit(fail ? 1 : 0);
