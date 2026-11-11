"use client";

// 날짜 칸 — 브라우저 기본 날짜 입력을 입력 칸 모양으로 쓴다.
import type { ChangeEvent, ComponentProps } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// 연도를 네 자리로 묶는다(안 묶으면 여섯 자리까지 쳐진다).
const LAST_DAY = "9999-12-31";

type DateFieldProps = {
  /** "YYYY-MM-DD" 또는 빈 글자(고르지 않음). */
  value: string;
  onChange: (next: string) => void;
  /** 기본 날짜 입력은 빈칸 안내를 못 보여 주므로 이름표·말풍선으로 쓴다. */
  placeholder?: string;
} & Pick<ComponentProps<"input">, "className">;

export function DateField(props: DateFieldProps) {
  const { value, placeholder: hint } = props;
  const pick = (event: ChangeEvent<HTMLInputElement>) => props.onChange(event.target.value);
  const look = cn("min-w-0 px-2 tabular-nums", !value && "text-muted-foreground", props.className);

  return <Input type="date" max={LAST_DAY} value={value} onChange={pick} aria-label={hint} title={hint} className={look} />;
}
