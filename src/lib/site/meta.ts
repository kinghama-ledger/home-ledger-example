// 앱 이름·설명·색처럼 여러 곳(루트 틀, 매니페스트)이 함께 쓰는 값.
import type { Metadata, Viewport } from "next";

export const SITE_NAME = "우리 집 가계부";
export const SITE_SHORT_NAME = "가계부";
export const SITE_SUMMARY = "우리 집 수입·지출·통장·대출을 한곳에서 보는 가계부";

// 앱의 파랑(globals.css 의 --primary 와 같은 색)과 바탕색(--background).
export const BRAND_BLUE = "#2563eb";
export const PAGE_BACKGROUND = "#f5f6f8";

export const SITE_ICON = "/icon.svg";
export const SITE_TOUCH_ICON = "/apple-icon.svg";

// 개인 가계부라 검색에 잡힐 화면이 없다. robots.ts 와 함께 이중으로 막는다.
const NO_SEARCH = { index: false, follow: false } as const;

// 매니페스트 연결은 적지 않는다 — src/app/manifest.ts 가 있으면 Next 가 알아서 잇는다.
export const siteMetadata: Metadata = {
  title: SITE_NAME,
  description: SITE_SUMMARY,
  icons: { icon: SITE_ICON, apple: SITE_TOUCH_ICON },
  robots: { ...NO_SEARCH, nocache: true, googleBot: { ...NO_SEARCH, noimageindex: true } },
};

export const siteViewport: Viewport = { themeColor: BRAND_BLUE };
