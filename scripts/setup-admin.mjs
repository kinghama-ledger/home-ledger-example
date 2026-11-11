import { randomInt } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

import {
  DEFAULT_ADMIN_ID,
  accountEmail,
  loginIdProblem,
  passwordProblem,
  rememberAdminId,
} from "./lib/admin-account.mjs";
import { loadEnvFile } from "./lib/env-file.mjs";

loadEnvFile();

const required = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length > 0) {
  console.error(
    `[오류] 필수 설정이 없습니다: ${missing.join(", ")}\n` +
      ".env.local에 값을 넣은 뒤 다시 실행하세요."
  );
  process.exit(1);
}

const [loginIdArg, passwordArg] = process.argv.slice(2);
const envLoginId = process.env.ADMIN_LOGIN_ID?.trim() || "";
const loginId = (loginIdArg || envLoginId || DEFAULT_ADMIN_ID).trim();
const displayName = (process.env.ADMIN_NAME || "관리자").trim() || "관리자";
const configuredPassword = passwordArg || process.env.ADMIN_PASSWORD;
const passwordWasGenerated = !configuredPassword;
const password = configuredPassword || makePassword(12);

// 앱의 로그인·프로필 API 가 받는 것과 같은 규칙으로 본다. 여기서 통과시킨 ID·비밀번호로
// 앱에 로그인하지 못하는 일이 없게 한다.
const problem = loginIdProblem(loginId) ?? passwordProblem(password);
if (problem) {
  console.error(`[오류] ${problem}`);
  process.exit(1);
}

const email = accountEmail(loginId);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

try {
  const existing = await findUserByEmail(email);
  if (existing) {
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: {
        ...(existing.user_metadata || {}),
        display_name: displayName,
      },
    });
    if (error) throw error;
    console.log("관리자 계정의 비밀번호와 이름을 새 값으로 바꿨습니다.");
  } else {
    const { error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    });
    if (error) throw error;
    console.log("관리자 계정을 만들었습니다.");
  }

  console.log(`로그인 ID: ${loginId}`);
  // 켤 때 안내(npm run dev)가 같은 ID 를 보여 주도록 적어 둔다.
  rememberAdminId(loginId);
  if (loginId !== (envLoginId || DEFAULT_ADMIN_ID)) {
    console.log(
      `.env.local 의 ADMIN_LOGIN_ID 도 ${loginId} 로 맞춰 두세요. ` +
        "가상 자료(npm run seed:demo)가 그 값을 보고 계정을 찾습니다."
    );
  }
  if (passwordWasGenerated) {
    console.log(`새 비밀번호: ${password}`);
    console.log(
      "지금 적어 두세요. 이 비밀번호는 파일에 저장하지 않습니다. " +
        "잊으면 npm run setup:admin 을 다시 실행하세요."
    );
  } else {
    console.log("직접 정한 비밀번호는 화면에 다시 표시하지 않습니다.");
    if (passwordArg) {
      console.log(
        "명령줄에 적은 비밀번호는 터미널 기록에 남습니다. " +
          "다음에는 .env.local 의 ADMIN_PASSWORD 에 적는 방법을 권합니다."
      );
    }
  }
  console.log("npm run dev 로 가계부를 켠 뒤 로그인하세요.");
  console.log("비밀번호는 마이페이지에서도 바꿀 수 있습니다.");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[오류] 관리자 계정을 준비하지 못했습니다: ${message}`);
  process.exit(1);
}

function makePassword(length) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  return Array.from({ length }, () => alphabet[randomInt(alphabet.length)]).join("");
}

async function findUserByEmail(targetEmail) {
  const normalized = targetEmail.toLowerCase();
  const perPage = 200;

  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const found = data.users.find(
      (user) => user.email?.toLowerCase() === normalized
    );
    if (found) return found;
    if (data.users.length < perPage) return null;
  }
}
