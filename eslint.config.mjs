import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "public/vendor/**",
  ]),

  // 일회성 운영 스크립트(진단 `diag_*` · 정정 `fix_*` · 등록 `register_*` — 이 예제에는 없음)만 `any` 를 허용한다.
  // (설계 148, 2026-08-04 / `register_*` 추가는 설계 162, 2026-08-11)
  //
  // 이 스크립트들은 Supabase 가 돌려주는 형태 없는 행을 그때그때 훑어보고 **한 번 실행한 뒤
  // 이력으로만 남는** 물건이다. 타입을 붙여도 재사용되지 않는데, 대신 `npm run lint` 가 늘
  // 빨강이라 **앱 소스의 진짜 위반이 그 안에 묻힌다**(2026-08-04 실측: 오류 115건이 전부 여기,
  // 앱 소스는 0건. 그래서 설계 146 커밋이 "eslint 0건"이라 잘못 적었다).
  //
  // ★테스트(`scripts/test_*`)·측정 도구(`measure_*`)·감사(`audit_*`, 뒤의 둘은 이 예제에는 없음)는 일부러 뺐다 —
  //   그쪽은 반복 실행되며 판정 근거가 되므로 계속 엄격하게 본다.
  //   여기 새 접두어를 추가하려면 "한 번 쓰고 버리는가"를 먼저 따질 것.
  //
  // ★`register_*` 추가 판정 (2026-08-11, 설계 162):
  //   마스터 행을 한 번 넣는 **1회성 등록** 스크립트다(이 예제에는 없음).
  //   `fix_*` 와 성격이 같다 — dry-run·`--revert` 를 달고 한 번 실행한 뒤 이력으로만 남는다.
  //   반복 실행되지 않고 무엇의 판정 근거도 되지 않으므로 위 기준("한 번 쓰고 버리는가")에 든다.
  // ★`verify_*` 추가 판정 (2026-08-31, 설계 194 배포 전 교차리뷰 · 검토 AI 지적):
  //   수집한 원문을 새 파서에 한 번 통과시켜 보는 **1회성 원문 검증** 스크립트다(이 예제에는 없음). 날짜가 붙고 다시 실행되지 않으며
  //   어떤 판정의 근거도 아니다(근거는 `test_*`). `diag_*` 와 성격이 같다. 빠져 있어 `npm run lint` 가 13건으로 깨졌다.
  {
    files: [
      "scripts/diag_*.mts",
      "scripts/fix_*.mts",
      "scripts/register_*.mts",
      "scripts/verify_*.mts",
      "scripts/diag_*.mjs",
      "scripts/fix_*.mjs",
      "scripts/register_*.mjs",
    ],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
]);

export default eslintConfig;
