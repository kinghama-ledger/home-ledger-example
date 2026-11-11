"use client";

// 옆 메뉴(PC)와 모바일 윗줄. 둘 다 같은 메뉴 목록·계정 칸을 쓴다.
import { useState, useSyncExternalStore } from "react";
import { ChevronsLeft, ChevronsRight, Menu as MenuIcon, X as XIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { PrivacyModeSwitch, usePrivacyMode } from "@/components/privacy/privacy-mode";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { FALLBACK_DISPLAY_NAME } from "@/lib/account/identity";
import { FIRST_SCREEN_PATH, MY_PAGE_PATH } from "@/lib/routes";
import { cn } from "@/lib/utils";

import { MENU, currentMenu, isMenuActive, isUnder } from "./menu";
import { useAccount } from "./use-account";

const APP_NAME = "우리 집 가계부";
const ROLE_LABEL = "관리자";

// ── 접힘 상태: 이 브라우저에 기억한다 ──────────────────────────────────────
const FOLD_KEY = "ledger:side-menu-folded";
const foldListeners = new Set<() => void>();
let foldInMemory = false;

function readFolded(): boolean {
  try {
    return window.localStorage.getItem(FOLD_KEY) === "yes";
  } catch {
    return foldInMemory;
  }
}

function writeFolded(next: boolean) {
  foldInMemory = next;
  try {
    if (next) window.localStorage.setItem(FOLD_KEY, "yes");
    else window.localStorage.removeItem(FOLD_KEY);
  } catch {
    // 저장소를 못 쓰면 이 탭에서만 기억한다.
  }
  foldListeners.forEach((notify) => notify());
}

function subscribeFold(notify: () => void) {
  foldListeners.add(notify);
  return () => {
    foldListeners.delete(notify);
  };
}

// ── 공용 조각 ──────────────────────────────────────────────────────────────
const ROW = "flex items-center gap-2.5 rounded-full text-sm font-medium transition-colors";
const ROW_IDLE = "text-muted-foreground hover:bg-accent hover:text-accent-foreground";
const ROW_ACTIVE = "bg-primary text-primary-foreground shadow-sm";

function MenuLinks({
  pathname,
  iconOnly = false,
  onPick,
}: {
  pathname: string;
  iconOnly?: boolean;
  onPick?: () => void;
}) {
  return (
    <nav aria-label="메뉴" className="flex flex-col gap-1">
      {MENU.map((entry) => {
        const active = isMenuActive(entry, pathname);
        const Icon = entry.icon;
        return (
          <Link
            key={entry.href}
            href={entry.href}
            onClick={onPick}
            aria-current={active ? "page" : undefined}
            title={iconOnly ? entry.label : undefined}
            className={cn(
              ROW,
              iconOnly ? "size-10 justify-center self-center" : "px-3 py-2",
              active ? ROW_ACTIVE : ROW_IDLE
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            {iconOnly ? <span className="sr-only">{entry.label}</span> : <span>{entry.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

function AccountLink({
  pathname,
  iconOnly = false,
  onPick,
}: {
  pathname: string;
  iconOnly?: boolean;
  onPick?: () => void;
}) {
  const account = useAccount();
  const { mask } = usePrivacyMode();
  const name = mask("name", account?.name ?? FALLBACK_DISPLAY_NAME);
  const active = isUnder(pathname, MY_PAGE_PATH);

  return (
    <Link
      href={MY_PAGE_PATH}
      onClick={onPick}
      aria-current={active ? "page" : undefined}
      title={iconOnly ? `${name} · 마이페이지` : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-xl transition-colors",
        iconOnly ? "justify-center p-1.5" : "px-2 py-2",
        active ? "bg-accent text-accent-foreground ring-1 ring-primary/40" : "hover:bg-accent"
      )}
    >
      <span
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
      >
        {Array.from(name)[0] ?? "?"}
      </span>
      {iconOnly ? (
        <span className="sr-only">{name} 마이페이지</span>
      ) : (
        <span className="min-w-0 leading-tight">
          <span className="block break-all text-sm font-semibold text-foreground">{name}</span>
          <span className="block text-xs text-muted-foreground">{ROLE_LABEL}</span>
        </span>
      )}
    </Link>
  );
}

// ── PC 옆 메뉴 ─────────────────────────────────────────────────────────────
export function SideMenu() {
  const pathname = usePathname();
  const folded = useSyncExternalStore(subscribeFold, readFolded, () => false);
  const foldLabel = folded ? "사이드바 펼치기" : "사이드바 접기";
  const FoldIcon = folded ? ChevronsRight : ChevronsLeft;

  return (
    <aside
      className={cn(
        "my-3 ml-3 hidden shrink-0 flex-col rounded-2xl border bg-card shadow-sm transition-[width] duration-200 md:flex",
        folded ? "w-[75px] p-2" : "w-[190px] p-3"
      )}
    >
      <div className={cn("flex items-center pb-3", folded ? "justify-center" : "justify-between gap-1")}>
        {folded ? null : (
          <Link href={FIRST_SCREEN_PATH} className="min-w-0 px-1 text-base font-bold tracking-tight text-foreground">
            {APP_NAME}
          </Link>
        )}
        <button
          type="button"
          onClick={() => writeFolded(!folded)}
          aria-label={foldLabel}
          title={foldLabel}
          aria-expanded={!folded}
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <FoldIcon className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <MenuLinks pathname={pathname} iconOnly={folded} />
      </div>

      <div className="mt-3 space-y-2 border-t pt-3">
        <PrivacyModeSwitch collapsed={folded} />
        <AccountLink pathname={pathname} iconOnly={folded} />
      </div>
    </aside>
  );
}

// ── 모바일 윗줄 + 서랍 메뉴 ────────────────────────────────────────────────
export function MobileBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <header className="mx-3 mt-3 flex items-center justify-between rounded-2xl border bg-card py-1.5 pl-4 pr-1.5 shadow-sm md:hidden">
        <span className="text-base font-semibold text-foreground">{currentMenu(pathname)?.label ?? "가계부"}</span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="메뉴 열기"
          title="메뉴 열기"
          className="flex size-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-accent"
        >
          <MenuIcon className="size-5" aria-hidden="true" />
        </button>
      </header>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" showCloseButton={false} className="w-[260px] gap-0 p-3">
          <SheetClose
            aria-label="닫기"
            title="닫기"
            className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <XIcon className="size-4" aria-hidden="true" />
          </SheetClose>
          <SheetTitle className="px-2 pb-3 pt-1 text-base font-bold tracking-tight">
            <Link href={FIRST_SCREEN_PATH} onClick={close}>
              {APP_NAME}
            </Link>
          </SheetTitle>
          <SheetDescription className="sr-only">가계부 메뉴</SheetDescription>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <MenuLinks pathname={pathname} onPick={close} />
          </div>
          <div className="mt-3 space-y-2 border-t pt-3">
            <PrivacyModeSwitch />
            <AccountLink pathname={pathname} onPick={close} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
