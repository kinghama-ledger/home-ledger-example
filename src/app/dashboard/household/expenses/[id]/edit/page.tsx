"use client";

import Link from "next/link";

import { ExpenseForm } from "@/components/household/expense-form";
import { useHhEditTarget } from "@/components/household/use-hh-edit-target";
import { FailureNotice, LoadingNotice } from "@/components/screen/blocks";
import { Button } from "@/components/ui/button";
import type { HhTransaction } from "@/lib/household/types";

const LIST_PATH = "/dashboard/household/expenses";

export default function HouseholdExpenseEditPage() {
  const { loading, target } = useHhEditTarget<HhTransaction>({ table: "hh_transaction", type: "expense" });

  if (loading) return <LoadingNotice label="불러오는 중..." />;
  if (target) return <ExpenseForm target={target} />;

  const toList = (
    <Button asChild variant="outline">
      <Link href={LIST_PATH}>목록으로</Link>
    </Button>
  );
  return <FailureNotice title="지출 내역을 찾을 수 없습니다." action={toList} />;
}
