"use client";

import Link from "next/link";

import { InstallmentForm } from "@/components/household/installment-form";
import { useHhEditTarget } from "@/components/household/use-hh-edit-target";
import { FailureNotice, LoadingNotice } from "@/components/screen/blocks";
import { Button } from "@/components/ui/button";
import type { HhInstallment } from "@/lib/household/types";

const LIST_PATH = "/dashboard/household/expenses";

export default function HouseholdInstallmentEditPage() {
  const { loading, target } = useHhEditTarget<HhInstallment>({ table: "hh_installment" });

  if (loading) return <LoadingNotice label="불러오는 중..." />;
  if (target) return <InstallmentForm target={target} />;

  const toList = (
    <Button asChild variant="outline">
      <Link href={LIST_PATH}>목록으로</Link>
    </Button>
  );
  return <FailureNotice title="할부를 찾을 수 없습니다." action={toList} />;
}
