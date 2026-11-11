// 가림(마스킹) 함수 — 화면을 남에게 보여 줄 때 진짜 금액·이름 대신 가짜 값을 내놓는다.
// 같은 입력에는 늘 같은 가짜 값이 나온다(새로 고쳐도 숫자가 바뀌지 않는다).

export type MaskKind =
  | "amount"
  | "income_amount"
  | "expense_amount"
  | "merchant"
  | "owner_name"
  | "name";

export type MaskInput = string | number | null | undefined;

// ── 글자 → 번호 ────────────────────────────────────────────────────────────
// 글자열을 32비트 정수 하나로 접는다. 암호용이 아니라 "고르게 흩어지기만 하면 되는" 용도다.
function seedOf(text: string): number {
  let h = 0x9e3779b9;
  for (let i = 0; i < text.length; i += 1) {
    h = Math.imul(h ^ text.charCodeAt(i), 0x85ebca6b);
    h = (h << 13) | (h >>> 19);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 13;
  return h >>> 0;
}

// 씨앗에서 0 이상 1 미만의 수를 차례로 뽑는 생성기(xorshift32).
function sequenceFrom(seed: number): () => number {
  let state = seed || 0x1234567;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x100000000;
  };
}

function pickFrom<T>(list: readonly T[], seed: number): T {
  return list[seed % list.length];
}

// ── 가짜 금액 ──────────────────────────────────────────────────────────────
// 수입 앞자리(4~7)가 지출 앞자리(1~3)보다 커서, 합계에서도 "수입 > 지출"로 보인다.
const LEADING_DIGIT: Record<"amount" | "income_amount" | "expense_amount", [number, number]> = {
  amount: [1, 9],
  income_amount: [4, 7],
  expense_amount: [1, 3],
};

const EXTRA_DIGITS = 3;
const NUMBER_RUN = /\d[\d,]*(?:\.\d+)?/g;

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function fakeAmount(kind: keyof typeof LEADING_DIGIT, text: string): string {
  const [low, high] = LEADING_DIGIT[kind];
  let runIndex = 0;
  // 숫자 덩어리만 바꾸므로 앞의 부호와 뒤의 단위("원", "만원")는 그대로 남는다.
  return text.replace(NUMBER_RUN, (run) => {
    const whole = run.split(".")[0].replace(/,/g, "").replace(/^0+/, "");
    // 0 뿐인 값은 그대로 둔다 — 없는 돈을 만들어 보이지 않는다.
    if (whole === "") return run;

    const next = sequenceFrom(seedOf(`${kind}/${runIndex}/${text}`));
    runIndex += 1;

    let digits = String(low + Math.floor(next() * (high - low + 1)));
    const length = whole.length + EXTRA_DIGITS;
    while (digits.length < length) digits += String(Math.floor(next() * 10));
    return groupThousands(digits);
  });
}

// ── 가짜 이름 ──────────────────────────────────────────────────────────────
// 성과 이름을 따로 골라 붙인다(목록에 통째 이름을 두지 않는다).
const FAMILY_NAMES = [
  "강", "고", "남", "문", "민", "방", "배", "서", "성", "송",
  "양", "엄", "여", "원", "유", "임", "전", "차", "천", "하",
] as const;

const GIVEN_NAMES = [
  "가온", "나래", "다솜", "도담", "라온", "마루", "미르", "보람", "봄이", "새론",
  "솔", "아람", "여울", "온유", "은솔", "이든", "재이", "초롱", "한결", "해든",
  "단비", "누리", "소담", "채움", "푸름",
] as const;

function fakePersonName(text: string): string {
  const seed = seedOf(`name/${text}`);
  const family = pickFrom(FAMILY_NAMES, seed);
  const given = pickFrom(GIVEN_NAMES, Math.floor(seed / FAMILY_NAMES.length));
  return `${family}${given}`;
}

// 괄호 안의 이름만 가짜로 바꾼다. 괄호가 없으면 손대지 않는다.
// 예) "국민은행(김하늘)" → "국민은행(가짜 이름)"
function fakeOwnerName(text: string): string {
  return text.replace(/\(([^()]+)\)/g, (_match, inner: string) => `(${fakePersonName(inner.trim())})`);
}

// ── 가짜 상호 ──────────────────────────────────────────────────────────────
// 앞말과 업종을 따로 골라 붙인다. 실제 상호와 겹치지 않게 흔한 낱말만 썼다.
const SHOP_PREFIXES = [
  "아침", "골목", "모퉁이", "언덕", "햇살", "달빛", "바람", "구름", "솔숲", "강변",
  "별빛", "새벽", "들꽃", "마당", "우리동네", "첫눈", "단풍", "은하", "파도", "노을",
] as const;

const SHOP_TYPES = [
  "마트", "분식", "빵집", "카페", "약국", "서점", "문구", "식당", "정육점", "과일가게",
  "세탁소", "철물점", "꽃집", "미용실", "주유소",
] as const;

function fakeMerchant(text: string): string {
  const seed = seedOf(`merchant/${text}`);
  const prefix = pickFrom(SHOP_PREFIXES, seed);
  const type = pickFrom(SHOP_TYPES, Math.floor(seed / SHOP_PREFIXES.length));
  return `${prefix} ${type}`;
}

// ── 공개 함수 ──────────────────────────────────────────────────────────────
export function mask(kind: MaskKind, value: MaskInput, enabled: boolean): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (!enabled || text === "") return text;

  switch (kind) {
    case "amount":
    case "income_amount":
    case "expense_amount":
      return fakeAmount(kind, text);
    case "merchant":
      return fakeMerchant(text);
    case "owner_name":
      return fakeOwnerName(text);
    case "name":
      return fakePersonName(text);
    default:
      return text;
  }
}
