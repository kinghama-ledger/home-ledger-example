// `npm run dev` 시작 시 로그인 방법을 눈에 띄게 보여주는 배너입니다.
// (package.json 의 predev 로 자동 실행됩니다.)
// 비밀번호 자체는 찍지 않는다 — 설치(npm run setup:admin) 때 화면에 나온 값을 쓰고,
// 잊었으면 npm run setup:admin 을 다시 실행해 새로 만든다.

import { readFileSync } from "node:fs";

const C = {
  reset: "\x1b[0m", bold: "\x1b[1m",
  cyan: "\x1b[36m", yellow: "\x1b[33m", green: "\x1b[32m", gray: "\x1b[90m",
};

// .env.local 을 create-admin.mjs 와 같은 규칙(앞뒤 공백·따옴표 제거)으로 읽는다.
function readEnvLocal() {
  const env = {};
  let text;
  try {
    text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  } catch {
    return env; // .env.local 없으면 기본 안내
  }
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[line.slice(0, eq).trim()] = value;
  }
  return env;
}
const env = readEnvLocal();
const loginId = (process.env.ADMIN_LOGIN_ID || env.ADMIN_LOGIN_ID || "admin").trim() || "admin";
// ADMIN_PASSWORD 가 적혀 있으면 setup:admin 이 그 값을 쓰므로, 그 사실만 알린다(값은 찍지 않음).
const fixedPw = Boolean(process.env.ADMIN_PASSWORD || env.ADMIN_PASSWORD);

const line = "════════════════════════════════════════════";
console.log("");
console.log(C.cyan + line + C.reset);
console.log(C.cyan + "  🔑  " + C.bold + "우리 집 가계부 로그인 안내" + C.reset);
console.log(C.cyan + "  ──────────────────────────────────────" + C.reset);
console.log("      👤  ID  :  " + C.bold + C.yellow + loginId + C.reset);
console.log("      🔒  PW  :  " + (fixedPw
  ? "설치 때 쓴 비밀번호 " + C.gray + "(.env.local 의 ADMIN_PASSWORD 값)" + C.reset
  : "설치 때 화면에 나온 비밀번호"));
console.log(C.cyan + line + C.reset);
console.log("  🌐  " + C.green + "http://localhost:3000" + C.reset + " 에서 위 정보로 로그인하세요.");
console.log("  👉  비밀번호를 잊었으면 " + C.bold + "npm run setup:admin" + C.reset + " 을 다시 실행하세요" +
  (fixedPw ? " (ADMIN_PASSWORD 값으로 다시 맞춰집니다)." : " (새 비밀번호가 화면에 나옵니다)."));
console.log("");
