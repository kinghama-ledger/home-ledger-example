// 화면(브라우저)에서 남길 수 있는 기록 이름의 목록 — 화면과 서버가 함께 본다.
// 여기에 없는 이름은 `/api/audit` 가 받지 않는다. `LOGIN`·`PASSWORD_CHANGE` 같은
// 서버 기록 이름을 화면에서 흉내 내지 못하게 하려는 것이다.
// 화면에 새 기록을 추가할 때는 이 목록에 이름을 먼저 넣는다(안 넣으면 타입 검사가 알려 준다).
export const SCREEN_ACTIONS = [
  "CLIENT_ERROR",
  "LOGOUT",
  "CREATE_HOUSEHOLD_DEFAULTS",
  "CREATE_HH_INGEST_TOKEN",
  "CREATE_HH_EXPENSE",
  "DELETE_HH_EXPENSE",
  "CREATE_HH_INCOME",
  "UPDATE_HH_INCOME",
  "DELETE_HH_INCOME",
  "CREATE_HH_INSTALLMENT",
  "CREATE_HH_TRANSFER",
  "CONFIRM_HH_INBOX",
  "UNCONFIRM_HH_INBOX",
] as const;

export type ScreenAction = (typeof SCREEN_ACTIONS)[number];

const ALLOWED: ReadonlySet<string> = new Set(SCREEN_ACTIONS);

export function isScreenAction(value: unknown): value is ScreenAction {
  return typeof value === "string" && ALLOWED.has(value);
}
