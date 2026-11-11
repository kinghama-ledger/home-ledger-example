// Supabase 접속 값을 읽는 한곳.
// 값은 모듈을 불러올 때가 아니라 함수를 부를 때 읽는다 — 값이 없어도 빌드는 돌아야 한다.

const HOW_TO_FIX = "프로젝트 폴더의 .env.local 을 확인하고 개발 서버를 다시 켜 주세요.";

export class MissingEnvError extends Error {
  constructor(names: string[]) {
    super(`Supabase 접속 값이 없습니다(${names.join(", ")}). ${HOW_TO_FIX}`);
    this.name = "MissingEnvError";
  }
}

export type PublicDbEnv = { url: string; anonKey: string };

// 공개 변수는 반드시 `process.env.이름` 꼴로 적는다. 빌드가 이 표기를 찾아 값을 끼워 넣기 때문에
// 이름을 변수로 넘겨 읽으면 브라우저에서는 비어 버린다.
export function readPublicDbEnv(): PublicDbEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function publicDbEnv(): PublicDbEnv {
  const env = readPublicDbEnv();
  if (env) return env;
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  throw new MissingEnvError(missing);
}

// 서비스 키는 서버에서만 읽힌다(공개 접두어가 없어 브라우저 묶음에는 들어가지 않는다).
export function serviceDbEnv(): { url: string; serviceKey: string } {
  const { url } = publicDbEnv();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new MissingEnvError(["SUPABASE_SERVICE_ROLE_KEY"]);
  return { url, serviceKey };
}
