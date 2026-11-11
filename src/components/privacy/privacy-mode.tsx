"use client";

// 가림 모드 — 켜면 화면의 금액·이름이 가짜 값으로 보인다(화면 공유·캡처용).
// 켜는 길은 셋이다: 옆 메뉴 버튼, 단축키, 주소 뒤의 `?mask=on`(요청 문지기가 쿠키로 바꿔 준다).
// 켜져 있는 동안에는 저장 요청을 보내지 않고(browser.ts·proxy.ts), 가리지 못하는 화면과 대화창은 안내문으로 바꾼다.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { PRIVACY_LANDING_PATH, isUnmaskedScreen } from "@/lib/privacy/demo-link";
import { mask as maskValue, type MaskInput, type MaskKind } from "@/lib/privacy/mask";
import { isPrivacyOn, reassertPrivacyCookie, setPrivacyOn, subscribePrivacy } from "@/lib/privacy/mode-store";
import { cn } from "@/lib/utils";

const SHORTCUT_HINT = "Ctrl/⌘ + Shift + M";

// 켜짐 상태는 src/lib/privacy/mode-store.ts 가 들고 있다 — DB 연결(browser.ts)도 같은 값을 본다.
const serverSnapshot = () => false;

// ── 컨텍스트 ───────────────────────────────────────────────────────────────
type PrivacyMode = {
  enabled: boolean;
  toggle: () => void;
  setEnabled: (next: boolean) => void;
  mask: (kind: MaskKind, value: MaskInput) => string;
};

// 제공자 밖에서 부르면 아무것도 가리지 않는다(오류를 내지 않는다).
const OUTSIDE_PROVIDER: PrivacyMode = {
  enabled: false,
  toggle: () => {},
  setEnabled: () => {},
  mask: (kind, value) => maskValue(kind, value, false),
};

const PrivacyModeContext = createContext<PrivacyMode>(OUTSIDE_PROVIDER);

function isToggleShortcut(event: KeyboardEvent) {
  return (
    (event.ctrlKey || event.metaKey) &&
    event.shiftKey &&
    !event.altKey &&
    event.key.toLowerCase() === "m"
  );
}

export function PrivacyModeProvider({ children }: { children: ReactNode }) {
  const enabled = useSyncExternalStore(subscribePrivacy, isPrivacyOn, serverSnapshot);

  const setEnabled = useCallback((next: boolean) => {
    if (isPrivacyOn() === next) return;
    setPrivacyOn(next);
    toast(next ? "마스킹 모드 켜짐" : "마스킹 모드 꺼짐");
  }, []);

  const toggle = useCallback(() => setEnabled(!isPrivacyOn()), [setEnabled]);

  // 켜져 있는 탭은 돌아올 때마다 쿠키를 다시 적는다 — 다른 탭에서 껐어도 이 탭의 저장은 계속 막힌다.
  useEffect(() => {
    if (!enabled) return;
    reassertPrivacyCookie();
    const onReturn = () => {
      if (document.visibilityState === "visible") reassertPrivacyCookie();
    };
    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    return () => {
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [enabled]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isToggleShortcut(event) || event.repeat) return;
      event.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  const value = useMemo<PrivacyMode>(
    () => ({
      enabled,
      toggle,
      setEnabled,
      mask: (kind, input) => maskValue(kind, input, enabled),
    }),
    [enabled, toggle, setEnabled]
  );

  return <PrivacyModeContext.Provider value={value}>{children}</PrivacyModeContext.Provider>;
}

export function usePrivacyMode(): PrivacyMode {
  return useContext(PrivacyModeContext);
}

// ── 옆 메뉴 아래의 전환 버튼 ───────────────────────────────────────────────
export function PrivacyModeSwitch({ collapsed = false }: { collapsed?: boolean }) {
  const { enabled, toggle } = usePrivacyMode();
  const label = enabled ? "마스킹 ON" : "마스킹 OFF";
  const Icon = enabled ? EyeOff : Eye;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={enabled}
      aria-label={label}
      title={`${label} (${SHORTCUT_HINT})`}
      className={cn(
        "flex w-full items-center gap-2 rounded-md border text-sm font-medium transition-colors",
        collapsed ? "justify-center p-2" : "px-3 py-2",
        enabled
          ? "border-amber-400 bg-amber-100 text-amber-900 hover:bg-amber-200 dark:border-amber-500/60 dark:bg-amber-500/20 dark:text-amber-200"
          : "border-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {collapsed ? null : <span className="truncate">{label}</span>}
    </button>
  );
}

// ── 켜져 있음을 알리는 표시 ────────────────────────────────────────────────
// pointer-events-none 이라 아래에 있는 버튼 클릭을 가로채지 않는다.
export function PrivacyModeBadge() {
  const { enabled } = usePrivacyMode();
  if (!enabled) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50" role="status">
      <div className="h-1 w-full bg-amber-400" />
      <span className="absolute right-3 top-2 rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-semibold text-amber-950 shadow-sm">
        마스킹 모드
      </span>
    </div>
  );
}

// ── 가리지 못하는 화면을 안내문으로 바꾸는 문 ──────────────────────────────
// 수집함처럼 원문·금액을 그대로 보여 주는 화면은 가림 모드에서 내용을 아예 그리지 않는다.
// 어느 화면이 해당하는지는 src/lib/privacy/demo-link.ts 의 isUnmaskedScreen 이 정한다.
export function PrivacyScreenGate({ children }: { children: ReactNode }) {
  const { enabled } = usePrivacyMode();
  const pathname = usePathname() ?? "";
  if (!enabled || !isUnmaskedScreen(pathname)) return <>{children}</>;

  return (
    <div className="mx-auto mt-10 max-w-md rounded-2xl border border-amber-300 bg-amber-50 p-6 text-sm text-amber-950 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-100" role="status">
      <p className="text-base font-semibold">마스킹 모드에서는 이 화면을 열지 않습니다</p>
      <p className="mt-2 leading-relaxed">
        이 화면은 금액·가맹점·문자 원문을 가리지 않고 보여 줍니다. 화면을 남에게 보여 주는 동안에는 가려지는 화면만 엽니다.
      </p>
      <p className="mt-2 leading-relaxed">
        끄려면 왼쪽 아래 <b>마스킹 ON</b> 버튼을 누르거나 {SHORTCUT_HINT} 를 누릅니다.
      </p>
      <Link href={PRIVACY_LANDING_PATH} className="mt-4 inline-block font-semibold underline underline-offset-4">
        현금흐름 화면으로 가기
      </Link>
    </div>
  );
}

// ── 글자 하나를 가려서 보여 주는 감싸개 ────────────────────────────────────
export function MaskedText({
  category,
  children,
}: {
  category: MaskKind;
  children: MaskInput;
}) {
  const { mask } = usePrivacyMode();
  return <>{mask(category, children)}</>;
}
