"use client";

import { CrashNotice } from "@/components/screen/crash-notice";

type Props = { error: unknown; retry: () => void };

// 대시보드 안의 화면이 그리다 실패했을 때 Next 가 이 파일을 대신 보여 준다.
export default function DashboardError(props: Props) {
  return <CrashNotice problem={props.error} onRetry={() => props.retry()} />;
}
