"use client";

// 가계부 "수정" 화면이 주소의 [id] 한 건을 불러오는 공통 훅.
// 지출·수입·통장이동·할부·대출 수정 화면이 모두 같은 순서(세션 확인 → 한 건 조회)를 쓴다.
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { browserDb } from "@/lib/backend/browser";

type Source =
  | { table: "hh_transaction"; type: "expense" | "income" | "transfer" }
  | { table: "hh_installment" | "hh_loan"; type?: undefined };

type Loaded<Row> = { loading: true; target: null } | { loading: false; target: Row | null };

const WAITING = { loading: true, target: null } as const;

// 불러오는 동안은 loading, 끝나면 target(없거나 종류가 다르면 null).
export function useHhEditTarget<Row>({ table, type }: Source): Loaded<Row> {
  const { id } = useParams<{ id: string }>();
  const [result, setResult] = useState<Loaded<Row>>(WAITING);

  useEffect(() => {
    let current = true;

    const load = async () => {
      const db = browserDb();
      // 새로 고친 직후에는 세션 복원이 끝난 뒤에 조회해야 본인 행이 보인다.
      await db.auth.getSession();
      let query = db.from(table).select("*").eq("id", id);
      if (type) query = query.eq("type", type);
      const { data } = await query.single();
      if (current) setResult({ loading: false, target: (data as Row | null) ?? null });
    };
    void load();

    return () => {
      current = false;
    };
  }, [table, type, id]);

  return result;
}
