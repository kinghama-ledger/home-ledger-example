// 요청 쿠키용 Supabase 연결 — 서버 컴포넌트, 라우트 핸들러, 서버 액션에서 쓴다.
import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { publicDbEnv } from "./env";

export async function requestDb(): Promise<SupabaseClient> {
  const { url, anonKey } = publicDbEnv();
  const jar = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll(updated) {
        try {
          for (const { name, value, options } of updated) {
            jar.set(name, value, options);
          }
        } catch {
          // 서버 컴포넌트에서는 쿠키를 쓸 수 없다. 갱신된 쿠키는 요청 문지기(src/proxy.ts)가 싣는다.
        }
      },
    },
  });
}
