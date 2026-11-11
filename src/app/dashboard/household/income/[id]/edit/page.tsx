"use client";

import Link from "next/link";

import { IncomeForm } from "@/components/household/income-form";
import { useHhEditTarget } from "@/components/household/use-hh-edit-target";
import { FailureNotice, LoadingNotice } from "@/components/screen/blocks";
import { Button } from "@/components/ui/button";
import type { HhTransaction } from "@/lib/household/types";

const LIST_PATH = "/dashboard/household/income";

export default function HouseholdIncomeEditPage() {
  const { loading, target } = useHhEditTarget<HhTransaction>({ table: "hh_transaction", type: "income" });

  if (loading) return <LoadingNotice label="불러오는 중..." />;
  if (target) return <IncomeForm target={target} />;

  const toList = (
    <Button asChild variant="outline">
      <Link href={LIST_PATH}>목록으로</Link>
    </Button>
  );
  return <FailureNotice title="수입 내역을 찾을 수 없습니다." action={toList} />;
}
