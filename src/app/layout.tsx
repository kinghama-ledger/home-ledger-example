import type { ReactNode } from "react";
import { Toaster } from "sonner";

import { siteMetadata, siteViewport } from "@/lib/site/meta";

import "./globals.css";

// 제목·아이콘·검색 차단·테마색은 src/lib/site/meta.ts 한곳에 있다.
export const metadata = siteMetadata;
export const viewport = siteViewport;

// 글꼴은 Pretendard 하나만 쓴다(CLAUDE.md "글꼴").
const FONT_HOST = "https://cdn.jsdelivr.net";
const FONT_SHEET = `${FONT_HOST}/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.min.css`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href={FONT_HOST} crossOrigin="anonymous" />
        <link rel="stylesheet" href={FONT_SHEET} />
      </head>
      <body className="antialiased">
        {children}
        <Toaster position="bottom-right" closeButton />
      </body>
    </html>
  );
}
