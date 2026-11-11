"use client";

// 지금 로그인한 계정의 이름·로그인 ID 를 화면에서 쓰기 위한 훅.
import { useEffect, useState } from "react";

import { displayNameOf, loginIdOf } from "@/lib/account/identity";
import { browserDb } from "@/lib/backend/browser";

export type AccountView = { name: string; loginId: string };

// 아직 모르면 null. 계정 정보가 바뀌면(이름 변경 뒤 세션 갱신 등) 따라 바뀐다.
export function useAccount(): AccountView | null {
  const [account, setAccount] = useState<AccountView | null>(null);

  useEffect(() => {
    const db = browserDb();
    let active = true;

    // 구독은 처음에 지금 세션을 한 번 알려 주고, 그 뒤 바뀔 때마다 알려 준다.
    const { data } = db.auth.onAuthStateChange((_event, session) => {
      if (!active || !session?.user) return;
      setAccount({ name: displayNameOf(session.user), loginId: loginIdOf(session.user) });
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return account;
}
