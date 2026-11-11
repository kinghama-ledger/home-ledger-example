import { redirect } from "next/navigation";

import { DASHBOARD_PATH } from "@/lib/routes";

export default function RootPage() {
  redirect(DASHBOARD_PATH);
}
