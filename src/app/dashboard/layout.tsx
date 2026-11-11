import type { ReactNode } from "react";

import { PrivacyModeBadge, PrivacyModeProvider, PrivacyScreenGate } from "@/components/privacy/privacy-mode";
import { ClientErrorReporter } from "@/components/shell/client-error-reporter";
import { SessionKeeper } from "@/components/shell/session-keeper";
import { MobileBar, SideMenu } from "@/components/shell/side-menu";
import { StepBack } from "@/components/shell/step-back";

// 로그인한 뒤의 모든 화면이 쓰는 틀: 왼쪽 메뉴(좁은 화면은 윗줄) + 본문.
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <PrivacyModeProvider>
      <SessionKeeper />
      {/* 화면 오류 기록은 로그인한 사람만 보낼 수 있으므로 로그인 뒤의 틀에만 둔다. */}
      <ClientErrorReporter />
      <PrivacyModeBadge />
      <div className="flex h-dvh overflow-hidden">
        <SideMenu />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileBar />
          {/* 본문만 세로로 스크롤한다. 가로로는 넘치지 않게 한다. */}
          <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
            <div className="mx-auto flex w-full max-w-[1280px] items-start gap-2 px-3 py-4 md:px-5 md:py-5">
              <StepBack />
              <div className="min-w-0 flex-1">
                {/* 가림 모드에서 가리지 못하는 화면(수집함 등)은 안내문으로 바꾼다. */}
                <PrivacyScreenGate>{children}</PrivacyScreenGate>
              </div>
            </div>
          </main>
        </div>
      </div>
    </PrivacyModeProvider>
  );
}
