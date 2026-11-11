"use client";

// 세션 지킴이 — 화면에는 아무것도 그리지 않는다. 대시보드 틀이 한 번만 올린다.
import { useEffect } from "react";

import { isAuthOutage } from "@/lib/account/outage";
import { browserDb } from "@/lib/backend/browser";

const LOGIN_PATH = "/login";

export function SessionKeeper() {
  useEffect(() => {
    const db = browserDb();
    let leaving = false;
    let checking = false;

    // 같은 이동을 두 번 하지 않는다. 쿠키 상태를 서버가 다시 보도록 전체 이동으로 보낸다.
    const leave = () => {
      if (leaving) return;
      leaving = true;
      window.location.replace(LOGIN_PATH);
    };

    // 세션이 "정말" 없을 때만 내보낸다. 장애·판단 불가일 때는 그대로 둔다.
    const recheck = async () => {
      if (leaving || checking) return;
      checking = true;
      try {
        const { data, error } = await db.auth.getUser();
        if (data.user) return;
        if (error && isAuthOutage(error)) return;
        leave();
      } catch {
        // 확인 자체가 실패했다(네트워크 등) — 내보내지 않는다.
      } finally {
        checking = false;
      }
    };

    const { data } = db.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") leave();
    });

    const onVisible = () => {
      if (document.visibilityState === "visible") void recheck();
    };
    const onOnline = () => void recheck();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);

    return () => {
      data.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  return null;
}
