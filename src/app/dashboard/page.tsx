import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { PRIVACY_COOKIE, PRIVACY_COOKIE_ON, PRIVACY_LANDING_PATH } from "@/lib/privacy/demo-link";
import { FIRST_SCREEN_PATH } from "@/lib/routes";

// 평소에는 수집함으로, 가림 모드로 들어왔으면 금액이 가려지는 현금흐름으로 보낸다.
export default async function DashboardPage() {
  const jar = await cookies();
  const masked = jar.get(PRIVACY_COOKIE)?.value === PRIVACY_COOKIE_ON;
  redirect(masked ? PRIVACY_LANDING_PATH : FIRST_SCREEN_PATH);
}
