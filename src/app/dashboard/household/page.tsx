import { redirect } from "next/navigation";

import { DASHBOARD_PATH } from "@/lib/routes";

// 현황은 통계의 '요약' 탭으로 통합됐다(설계 87).
// 진입 첫 화면·로고 홈·북마크는 수집함으로 보낸다(설계 100).
// 어디로 보낼지는 /dashboard 한곳이 정한다 — 가림 모드면 수집함 대신 현금흐름이다(설계 223).
export default function HouseholdHomePage() {
  redirect(DASHBOARD_PATH);
}
