import { redirect } from "next/navigation";

// 현황은 통계의 '요약' 탭으로 통합됐다(설계 87).
// 진입 첫 화면·로고 홈·북마크는 수집함으로 보낸다(설계 100).
export default function HouseholdHomePage() {
  redirect("/dashboard/household/inbox");
}
