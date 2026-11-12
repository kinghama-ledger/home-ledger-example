"use client";

import Link from "next/link";
import { ArrowLeft, PencilLine, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";

import { FailureNotice, LoadingNotice, Screen, Panel } from "@/components/screen/blocks";
import { HhPageHeader, HhField } from "@/components/household/hh-page-header";
import { usePrivacyMode } from "@/components/privacy/privacy-mode";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { browserDb } from "@/lib/backend/browser";
import { maskNamesIn } from "@/lib/privacy/mask";
import type { HhLoan } from "@/lib/household/types";

export default function HouseholdLoanDetailPage() {
  const supabase = useMemo(() => browserDb(), []);
  const { mask, enabled: privacyOn } = usePrivacyMode();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [row, setRow] = useState<HhLoan | null>(null);
  // 등록된 사람 이름 — 대출명 안의 이름을 가릴 때만 쓴다(목록 화면과 같은 규칙).
  const [personNames, setPersonNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const fetchOne = useCallback(async () => {
    await supabase.auth.getSession();
    const [{ data }, personRes] = await Promise.all([
      supabase.from("hh_loan").select("*").eq("id", id).single(),
      supabase.from("hh_person").select("name"),
    ]);
    // 가림 중에 이름 목록을 못 받으면 대출명 속 이름을 가릴 수 없다 — 실명을 보이느니 '찾을 수 없음'으로 둔다.
    // 가림이 꺼져 있으면 이름 목록이 없어도 대출은 그대로 보여 준다.
    setPersonNames(((personRes.data ?? []) as { name: string }[]).map((p) => p.name));
    setRow(personRes.error && privacyOn ? null : ((data as HhLoan) ?? null));
    setLoading(false);
  }, [supabase, id, privacyOn]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchOne();
  }, [fetchOne]);

  const handleDelete = async () => {
    if (!row || deleting) return;
    // 가림 모드에서는 삭제하지 않는다 — 확인창에 실제 값이 그대로 나온다.
    if (privacyOn) {
      toast.info("마스킹 모드에서는 삭제할 수 없습니다");
      return;
    }
    if (!confirm(`'${row.name}' 대출을 삭제하시겠습니까?`)) return;
    setDeleting(true);
    const { error: err } = await supabase.from("hh_loan").delete().eq("id", id);
    if (err) {
      toast.error(`삭제 실패: ${err.message}`);
      setDeleting(false);
      return;
    }
    toast.success("삭제되었습니다.");
    router.push("/dashboard/household/loans");
  };

  if (loading) return <LoadingNotice label="불러오는 중..." />;
  if (!row)
    return <FailureNotice title="대출을 찾을 수 없습니다." description="이미 삭제되었거나 접근할 수 없는 내역입니다." action={<Button asChild variant="outline"><Link href="/dashboard/household/loans">목록으로</Link></Button>} />;

  const shownName = maskNamesIn(mask("owner_name", row.name), personNames, privacyOn);
  const repaid = row.principal > 0 ? Math.min(100, Math.round(((row.principal - row.current_balance) / row.principal) * 100)) : 0;

  return (
    <Screen>
      <HhPageHeader
        title={shownName}
        breadcrumbs={[{ label: "가계부" }, { label: "대출관리", href: "/dashboard/household/loans" }, { label: shownName }]}
        actions={
          <>
            <Button variant="outline" asChild><Link href="/dashboard/household/loans"><ArrowLeft className="h-4 w-4" />목록</Link></Button>
            <Button variant="outline" asChild><Link href={`/dashboard/household/loans/${id}/edit`}><PencilLine className="h-4 w-4" />수정</Link></Button>
            <Button variant="destructive" onClick={() => void handleDelete()} disabled={deleting}><Trash2 className="h-4 w-4" />{deleting ? "삭제 중..." : "삭제"}</Button>
          </>
        }
      />
      <Panel>
        <HhField label="상태" value={row.status === "closed" ? <Badge variant="secondary">완료</Badge> : <Badge>상환중</Badge>} />
        <HhField label="대출금액 (원금)" value={<span className="tabular-nums">{mask("expense_amount",`${row.principal.toLocaleString("ko-KR")}원`)}</span>} />
        <HhField label="현재 잔액" value={<span className="font-semibold tabular-nums">{mask("expense_amount",`${row.current_balance.toLocaleString("ko-KR")}원`)}</span>} />
        <HhField label="상환 진행" value={`${repaid}%`} />
        <HhField label="이자율" value={row.interest_rate != null ? `${row.interest_rate}%` : "-"} />
        <HhField label="월납입금" value={row.monthly_payment != null ? mask("expense_amount",`${row.monthly_payment.toLocaleString("ko-KR")}원`) : "-"} />
        <HhField label="대출일" value={row.origin_date ?? "-"} />
        <HhField label="만기일" value={row.maturity_date ?? "-"} />
        <HhField label="상환일" value={row.payment_day != null ? `매월 ${row.payment_day}일` : "-"} />
      </Panel>
    </Screen>
  );
}
