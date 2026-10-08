// 첫 관리자 계정을 만드는 스크립트입니다.
// Supabase Auth 사용자 + employees 테이블 행을 한 번에 생성합니다.
//
// 사용법:
//   npm run setup:admin                  # 로그인ID=admin, 비밀번호는 실행할 때마다 무작위로 새로 만든다
//   npm run setup:admin -- myid mypw      # 로그인ID/비밀번호 직접 지정
//
// 비밀번호 정하는 순서: 명령 인자 → .env.local 의 ADMIN_PASSWORD → (둘 다 없으면) 무작위 12자.
// 로그인 비밀번호가 설정된 "직후"(직원 레코드 작업 전)에 [로그인 ID]와 [비밀번호]를 크게 보여 준다.
// 화면에 비밀번호를 찍는 것은 이번 실행에서 새로 만든 무작위 비밀번호뿐이다. 지정한 값은 다시 찍지 않는다.
// 이 스크립트는 비밀번호를 어디에도 저장하지 않고 다시 알려 주지도 않으니 그때 적어 둔다.
//
// ⚠️ 재실행 동작: 이미 같은 계정이 있으면 비밀번호를 "새 값으로 재설정"한다(아래 updateUserById).
//    비밀번호를 지정하지 않고 다시 실행하면 → 새 무작위 비밀번호로 바뀌고 화면에 나온다.
//    그래서 비밀번호를 잊었을 때는 `npm run setup:admin` 을 다시 실행하면 된다(복구 방법).
//    다른 ID 로 만들었다면 `npm run setup:admin -- 그ID` (또는 .env.local 에 ADMIN_LOGIN_ID 를 적어 둔다).
//    .env.local 에 ADMIN_PASSWORD 를 적어 두었다면 그 값으로 재설정된다.

import { readFileSync } from "node:fs";
import { randomInt } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_LOGIN_ID = "admin";

// 헷갈리는 글자(0 O 1 l I)를 뺀 영문·숫자. 12자 = Supabase Auth 최소 6자 충족.
const PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
function generatePassword(length = 12) {
  let out = "";
  for (let i = 0; i < length; i++) out += PASSWORD_CHARS[randomInt(PASSWORD_CHARS.length)];
  return out;
}

// .env.local 을 직접 읽어 환경변수로 로드 (Node 버전 무관)
function loadEnvFile(path) {
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return;
  }
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const domain = process.env.NEXT_PUBLIC_AUTH_EMAIL_DOMAIN || "example.com";

if (!url || !serviceKey) {
  console.error(
    "\n[오류] .env.local 에 NEXT_PUBLIC_SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.\n" +
      "      SETUP.md 의 '3. 키 조회 & DB 만들기' 를 따라 아래 명령으로 값을 조회해 .env.local 에 넣어주세요.\n" +
      "        npx supabase projects api-keys --project-ref <내-project-ref>\n"
  );
  process.exit(1);
}

const loginId = (process.argv[2] || process.env.ADMIN_LOGIN_ID || DEFAULT_LOGIN_ID).trim();
const name = (process.env.ADMIN_NAME || "관리자").trim();
const givenPassword = process.argv[3] || process.env.ADMIN_PASSWORD || "";
const generated = !givenPassword; // 지정한 비밀번호가 없으면 무작위로 만든다
const password = givenPassword || generatePassword();
const email = loginId.includes("@") ? loginId : `${loginId}@${domain}`;
// 잊었을 때 다시 칠 명령. ID 를 명령 인자로 바꿔 만들었으면 그 ID 를 붙여 안내한다.
const recoverCmd =
  process.argv[2] && loginId !== (process.env.ADMIN_LOGIN_ID || DEFAULT_LOGIN_ID).trim()
    ? `npm run setup:admin -- ${loginId}`
    : "npm run setup:admin";
let passwordApplied = false; // Auth 비밀번호가 실제로 설정됐는지(오류 안내용)

// 로그인 비밀번호가 설정된 직후 한 번만 크게 보여 준다.
function printCredentials() {
  const bar = "==================================================";
  console.log("\n" + bar);
  console.log("  🔑 로그인 정보");
  console.log("");
  console.log("  👤 로그인 ID : " + loginId);
  if (generated) {
    console.log("  🔒 비밀번호  : " + password);
    console.log("");
    console.log("  ✍️  지금 적어 두세요 — 이 스크립트는 비밀번호를 저장하거나 다시 알려 주지 않습니다.");
    console.log("  잊었으면 `" + recoverCmd + "` 을 다시 실행하세요. (새 비밀번호로 바뀌고 다시 나옵니다.)");
  } else {
    console.log("  🔒 비밀번호  : 지정한 비밀번호로 설정됨 (화면에 다시 찍지 않습니다)");
  }
  console.log(bar + "\n");
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findAuthUserByEmail(targetEmail) {
  // 사용자가 많지 않은 템플릿 환경 기준으로 첫 페이지에서 탐색
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw new Error(error.message);
  return data.users.find((u) => u.email?.toLowerCase() === targetEmail.toLowerCase()) || null;
}

async function main() {
  console.log(`\n관리자 계정 생성 중...  (로그인 ID: ${loginId}, 이메일: ${email})`);

  // 1) Supabase Auth 사용자 생성 (이미 있으면 비밀번호만 갱신)
  let authUserId;
  const created = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (created.error) {
    const msg = created.error.message || "";
    const alreadyExists =
      msg.toLowerCase().includes("already") || created.error.status === 422;
    if (!alreadyExists) throw new Error(msg);

    const existing = await findAuthUserByEmail(email);
    if (!existing) throw new Error(`이미 등록된 이메일이지만 사용자를 찾지 못했습니다: ${email}`);
    authUserId = existing.id;
    const upd = await supabase.auth.admin.updateUserById(authUserId, {
      password,
      email_confirm: true,
    });
    if (upd.error) throw new Error(upd.error.message);
    passwordApplied = true;
    console.log(
      generated
        ? "이미 있는 계정입니다. 비밀번호를 새 무작위 값으로 재설정했습니다."
        : "이미 있는 계정입니다. 비밀번호를 지정한 값으로 재설정했습니다."
    );
  } else {
    authUserId = created.data.user.id;
    passwordApplied = true;
    console.log("Auth 사용자를 생성했습니다.");
  }
  // 비밀번호는 이미 바뀌었으므로 아래 직원 레코드 작업이 실패해도 볼 수 있게 지금 보여 준다.
  printCredentials();

  // 2) employees 행 생성/갱신 (관리자 권한)
  const { data: existingEmp, error: selErr } = await supabase
    .from("employees")
    .select("id")
    .eq("login_id", loginId)
    .maybeSingle();
  if (selErr) throw new Error(selErr.message);

  if (existingEmp) {
    const { error } = await supabase
      .from("employees")
      .update({ auth_uid: authUserId, email, employee_type: "관리자", is_active: true })
      .eq("id", existingEmp.id);
    if (error) throw new Error(error.message);
    console.log("기존 직원 레코드를 관리자 계정으로 갱신했습니다.");
  } else {
    const { error } = await supabase.from("employees").insert({
      name,
      login_id: loginId,
      email,
      employee_type: "관리자",
      is_active: true,
      auth_uid: authUserId,
    });
    if (error) throw new Error(error.message);
    console.log("관리자 직원 레코드를 생성했습니다.");
  }

  console.log("\n✅ 관리자 계정 준비 완료! `npm run dev` 후 위 ID·비밀번호로 로그인하세요.");
  console.log("(비밀번호는 원하면 로그인 후 마이페이지에서 바꿀 수 있습니다.)\n");
}

main().catch((err) => {
  console.error("\n[오류] 관리자 생성 실패:", err.message);
  if (passwordApplied) {
    console.error(
      generated
        ? "⚠️ 로그인 비밀번호는 이미 바뀌었습니다(위에 나온 값). 원인을 고친 뒤 `" + recoverCmd +
            "` 을 다시 실행하면 새 비밀번호가 나옵니다."
        : "⚠️ 로그인 비밀번호는 이미 지정한 값으로 바뀌었습니다. 원인을 고친 뒤 같은 명령을 다시 실행하세요."
    );
  }
  console.error("Supabase 마이그레이션(supabase db push)이 먼저 적용되었는지 확인하세요.\n");
  process.exit(1);
});
