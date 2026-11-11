import { DEFAULT_ADMIN_ID, recallAdminId } from "./lib/admin-account.mjs";
import { loadEnvFile } from "./lib/env-file.mjs";

loadEnvFile();

// 마지막으로 setup:admin 이 만든 ID 가 가장 정확하다. 없으면 설정값, 그것도 없으면 기본값.
const loginId = recallAdminId() || process.env.ADMIN_LOGIN_ID?.trim() || DEFAULT_ADMIN_ID;
const passwordGuide = process.env.ADMIN_PASSWORD
  ? "ADMIN_PASSWORD에 설정한 값 (값은 표시하지 않음)"
  : "설치 때 화면에 나온 값";

console.log("\n우리 집 가계부 개발 서버를 시작합니다.");
console.log("접속 주소: http://localhost:3000");
console.log(`로그인 ID: ${loginId} (마이페이지에서 바꿨다면 바꾼 ID)`);
console.log(`비밀번호: ${passwordGuide}`);
console.log("잊었으면 npm run setup:admin 을 다시 실행하세요.\n");
