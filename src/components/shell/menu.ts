// 옆 메뉴 자료. 이름·순서를 바꾸려면 이 표만 고친다.
import {
  BookText,
  ChartColumn,
  Inbox,
  Landmark,
  ReceiptText,
  Settings,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { FIRST_SCREEN_PATH, HOUSEHOLD_PATH } from "@/lib/routes";

export type MenuEntry = {
  label: string;
  href: string;
  icon: LucideIcon;
  // href 말고도 이 메뉴에 속하는 주소(앞부분 일치).
  alsoActiveOn?: string[];
};

export const MENU: MenuEntry[] = [
  { label: "수집함", href: FIRST_SCREEN_PATH, icon: Inbox },
  { label: "현금흐름", href: `${HOUSEHOLD_PATH}/cash`, icon: Wallet },
  { label: "통장내역", href: `${HOUSEHOLD_PATH}/passbook`, icon: BookText },
  { label: "대출관리", href: `${HOUSEHOLD_PATH}/loans`, icon: Landmark },
  {
    label: "거래관리",
    href: `${HOUSEHOLD_PATH}/expenses`,
    icon: ReceiptText,
    alsoActiveOn: [`${HOUSEHOLD_PATH}/income`, `${HOUSEHOLD_PATH}/transfers`],
  },
  { label: "통계", href: `${HOUSEHOLD_PATH}/stats`, icon: ChartColumn },
  { label: "설정", href: `${HOUSEHOLD_PATH}/settings`, icon: Settings },
  { label: "시스템개선", href: `${HOUSEHOLD_PATH}/system`, icon: Wrench },
];

// "/a/b" 는 "/a/b" 와 "/a/b/…" 에만 맞는다("/a/bc" 는 아니다).
export function isUnder(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function isMenuActive(entry: MenuEntry, pathname: string): boolean {
  return [entry.href, ...(entry.alsoActiveOn ?? [])].some((base) => isUnder(pathname, base));
}

export function currentMenu(pathname: string): MenuEntry | undefined {
  return MENU.find((entry) => isMenuActive(entry, pathname));
}
