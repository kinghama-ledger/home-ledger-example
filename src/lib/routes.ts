// 앱 안에서 쓰는 주소 모음. 로그인 뒤 착지 화면을 바꾸려면 여기만 고친다.

export const LOGIN_PATH = "/login";

// 로그인에 성공하면 가는 곳. 이 주소는 다시 FIRST_SCREEN_PATH 로 넘긴다.
export const DASHBOARD_PATH = "/dashboard";

export const HOUSEHOLD_PATH = "/dashboard/household";

// 처음 보이는 화면(수집함). 메뉴 맨 위 항목과 앱 이름 링크도 이 값을 쓴다.
export const FIRST_SCREEN_PATH = `${HOUSEHOLD_PATH}/inbox`;

export const MY_PAGE_PATH = "/dashboard/my";
