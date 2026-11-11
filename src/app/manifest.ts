// 홈 화면에 추가했을 때 쓰이는 앱 정보. Next 가 /manifest.webmanifest 로 내보낸다.
import type { MetadataRoute } from "next";

import {
  BRAND_BLUE,
  PAGE_BACKGROUND,
  SITE_ICON,
  SITE_NAME,
  SITE_SHORT_NAME,
  SITE_TOUCH_ICON,
} from "@/lib/site/meta";

const SVG = { sizes: "any", type: "image/svg+xml" } as const;

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_SHORT_NAME,
    lang: "ko",
    scope: "/",
    start_url: "/dashboard",
    display: "standalone",
    theme_color: BRAND_BLUE,
    background_color: PAGE_BACKGROUND,
    icons: [
      { ...SVG, src: SITE_ICON, purpose: "any" },
      { ...SVG, src: SITE_TOUCH_ICON, purpose: "maskable" },
    ],
  };
}
