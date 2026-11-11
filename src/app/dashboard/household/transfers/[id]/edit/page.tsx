"use client";

import Link from "next/link";

import { TransferForm } from "@/components/household/transfer-form";
import { useHhEditTarget } from "@/components/household/use-hh-edit-target";
import { FailureNotice, LoadingNotice } from "@/components/screen/blocks";
import { Button } from "@/components/ui/button";
import type { HhTransaction } from "@/lib/household/types";

const LIST_PATH = "/dashboard/household/transfers";

export default function HouseholdTransferEditPage() {
  const { loading, target } = useHhEditTarget<HhTransaction>({ table: "hh_transaction", type: "transfer" });

  if (loading) return <LoadingNotice label="불러오는 중..." />;
  if (target) return <TransferForm target={target} />;

  const toList = (
    <Button asChild variant="outline">
      <Link href={LIST_PATH}>목록으로</Link>
    </Button>
  );
  return <FailureNotice title="통장이동을 찾을 수 없습니다." action={toList} />;
}
