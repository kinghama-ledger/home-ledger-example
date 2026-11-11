"use client";

import Link from "next/link";

import { LoanForm } from "@/components/household/loan-form";
import { useHhEditTarget } from "@/components/household/use-hh-edit-target";
import { FailureNotice, LoadingNotice } from "@/components/screen/blocks";
import { Button } from "@/components/ui/button";
import type { HhLoan } from "@/lib/household/types";

const LIST_PATH = "/dashboard/household/loans";

export default function HouseholdLoanEditPage() {
  const { loading, target } = useHhEditTarget<HhLoan>({ table: "hh_loan" });

  if (loading) return <LoadingNotice label="불러오는 중..." />;
  if (target) return <LoanForm target={target} />;

  const toList = (
    <Button asChild variant="outline">
      <Link href={LIST_PATH}>목록으로</Link>
    </Button>
  );
  return <FailureNotice title="대출을 찾을 수 없습니다." action={toList} />;
}
