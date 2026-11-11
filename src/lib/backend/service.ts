// 서비스 키 연결 — 행 수준 보안을 건너뛴다. 서버 코드에서만 쓴다(브라우저 코드에서 import 금지).
// `import "server-only"` 는 붙이지 않았다 — 문자 수집 모듈(sms-ingest 등)이 이 파일을 쓰고, 그 모듈의
// 시험이 Next 밖(tsx)에서 돌아 그 표시가 있으면 시험이 멈춘다. 대신 아래에서 브라우저 실행을 직접 막고,
// 서비스 키는 공개 접두어가 없어 브라우저 묶음에 들어가지 않는다(env.ts).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { serviceDbEnv } from "./env";

export function serviceDb(): SupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error("serviceDb() 는 서버에서만 부를 수 있습니다.");
  }
  const { url, serviceKey } = serviceDbEnv();
  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
