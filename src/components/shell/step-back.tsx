"use client";

// 뒤로 버튼 — PC 에서, 주소가 깊은 화면(등록·상세·수정)에만 보인다.
import { useEffect, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

// "/dashboard/household/expenses/new" 처럼 네 마디부터.
const MIN_DEPTH = 4;

function parentOf(pathname: string): string {
  const cut = pathname.replace(/\/+$/, "").lastIndexOf("/");
  return cut <= 0 ? "/" : pathname.slice(0, cut);
}

export function StepBack() {
  const pathname = usePathname();
  const router = useRouter();
  // 이 탭에서 앱 안을 돌아다닌 길. 새로 고치면 비워진다.
  const trail = useRef<string[]>([]);

  useEffect(() => {
    const steps = trail.current;
    if (steps[steps.length - 1] === pathname) return;
    // 바로 전 화면으로 돌아온 것이면 길을 한 칸 접는다.
    if (steps[steps.length - 2] === pathname) steps.pop();
    else steps.push(pathname);
  }, [pathname]);

  const depth = pathname.split("/").filter(Boolean).length;
  if (depth < MIN_DEPTH) return null;

  const goBack = () => {
    if (trail.current.length > 1) router.back();
    else router.push(parentOf(pathname));
  };

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label="이전 페이지로"
      title="이전 페이지로"
      className="sticky top-0 hidden size-9 shrink-0 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:flex"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
    </button>
  );
}
