# 우리 집 가계부 — 프로젝트 안내 (Claude Code 용)

개인/가족 가계부 앱(Next.js 16 + Supabase)의 **독자 학습용 샘플**입니다.
들어 있는 데이터는 전부 가상(김하늘·이바다 가족)입니다.
처음 클론한 사용자는 대부분 초보자입니다. 친절하게, 한 번에 한 단계씩 안내하세요.

---

## 🚀 초기 설정 도우미

**트리거:** 사용자가 "초기 설정 도와줘", "설치 도와줘", "설치해줘", "세팅 도와줘", "처음부터 같이 해줘",
"setup", 또는 **GitHub 주소만 주며 "설치해줘"** 라고 하면 **아래 절차를 순서대로 진행한다.**
(사람용 상세본: `SETUP.md`)

### 진행 원칙
- **한 번에 한 단계.** 각 단계를 실행/안내하고, 결과를 확인한 뒤 다음으로 넘어간다. 한꺼번에 쏟아내지 않는다.
- **OS 를 먼저 파악한다.** Windows 와 macOS 는 설치 명령이 다르다(`winget` vs Homebrew/설치파일, `copy` vs `cp`).
  현재 OS 를 확인하고 그에 맞는 명령만 안내한다. 모르면 사용자에게 묻는다.
- **OS 레벨 설치는 대화형일 수 있음을 인지한다.** git·Node 설치는 UAC(윈도우) 승인 클릭이나 설치 마법사(맥)가
  뜰 수 있어 **클로드코드가 100% 무인 자동화할 수 없다.** 이 구간은 명령을 `!` 로 띄워 주고, 사용자가
  팝업을 승인/완료하도록 또렷이 안내한 뒤 결과를 확인한다. 그 다음 단계(코드 받기~)부터는 네가 자동 처리한다.
- **Supabase CLI 는 전역으로 깔지 않는다.** 코드를 받은 뒤 프로젝트 폴더에서 처음 한 번
  `npm install supabase --save-dev` 를 실행하고, 이후 모든 명령은 `npx supabase …` 로 실행한다.
  `npx supabase --version` 이 실행되지 않으면 프로젝트 폴더 안인지 확인하고 설치 명령을 다시 실행한다.
- **⚠️ 방금 설치한 git·Node·gh·vercel 은 이미 열려 있던 터미널에서 바로 안 잡힐 수 있다(특히 Windows).**
  `command not found`/`...은(는) 인식되지 않습니다` 가 나오면 새 터미널을 열어 다시 확인하게 하고,
  Claude Code 로 진행 중이었다면 `claude` 를 다시 실행한 뒤 "이어서 설치해줘" 라고 하면 된다고 안내한다.
- **⚠️ `npx supabase login` 은 반드시 사용자가 "새/일반 터미널"에서 직접 실행한다 — `!` 로 시키지 않는다.**
  `login` 은 브라우저를 여는 **대화형** 명령인데, Claude Code 의 `!`(비대화형/에이전트 환경)에서 실행하면 CLI 가 이를 감지해
  **브라우저 대신 "액세스 토큰을 입력하라"** 는 모드로 빠진다(초보자가 여기서 막힘). 그래서 로그인은 이렇게 안내한다:
  **"새 터미널(또는 cmd)을 열고 프로젝트 폴더에서 `npx supabase login` 을 직접 실행하세요 — 브라우저가 열려 인증됩니다."**
  인증이 끝나면 토큰이 저장되어, 이후 비대화형 명령은 네가 같은 머신에서 `npx supabase …` 로 이어서 처리할 수 있다.
  `gh auth login`·`vercel login` 도 같은 이유로 똑같이 다룬다.
- **그 밖의 대화형 입력**(DB 비밀번호 등)도 사용자가 직접 실행하게 한다. `! 명령어` 는 이 세션에서 실행되지만,
  **브라우저·대화형 프롬프트가 필요한 명령(특히 `login`)은 `!` 가 아니라 사용자의 실제 터미널에서 돌려야 한다.**
- **비밀번호를** 사용자가 채팅에 붙여넣으면 네가 `.env.local` 에 적어준다. 키 값을 채팅에 도로 출력하지 않는다.
- **에러가 나면** 메시지를 그대로 읽고, 원인과 해결책을 한국어로 쉽게 설명한 뒤 다시 시도한다.
- 진행 상황을 짧게 요약해 사용자가 지금 어디쯤인지 알게 한다.

### 단계
> **핵심 방침:** 대시보드에서 키를 손으로 복사하게 하지 않는다. **Supabase CLI 로 로그인→프로젝트 생성→키 조회까지
> 자동화**해서, 사용자는 브라우저 로그인만 하면 되게 한다. 이것이 가장 빠른 설치 경로다.

0. **환경 부트스트랩 (필수 프로그램 확인·설치)** — 이 과정은 **CLI-first** 다: GitHub·Supabase·Vercel 을
   전부 CLI 로 다룬다. 먼저 4가지를 깐다: **git**(코드 받기), **Node.js 20.9 이상 + npm**(빌드·실행),
   **GitHub CLI(gh)**(내 저장소 생성·push), **vercel CLI**(배포). 먼저 한 번에 점검한다:
   `git --version`, `node -v`, `npm -v`, `gh --version`, `vercel --version`. 없는 것만 OS 에 맞춰 깐다.
   (Supabase CLI 는 코드를 받은 뒤 1단계에서 설치하고 확인한다.)
   - **Windows** (대부분 `winget` 사용 가능):
     - git: `winget install --id Git.Git -e`
     - Node LTS: `winget install --id OpenJS.NodeJS.LTS -e`  ← Node 가 npm·Supabase/Vercel CLI 의 전제
     - GitHub CLI: `winget install --id GitHub.cli -e`
     - (winget 자체가 없으면 https://nodejs.org LTS, https://git-scm.com 설치파일 안내)
   - **macOS**:
     - git: `git --version` 을 한 번 실행하면 Xcode Command Line Tools 설치창이 뜬다(또는 `xcode-select --install`).
     - Node LTS: Homebrew 가 있으면 `brew install node`, 없으면 https://nodejs.org LTS 설치파일 안내.
     - GitHub CLI: `brew install gh` (Homebrew 없으면 https://cli.github.com 설치파일).
   - **Vercel CLI**: `npm install -g vercel`.
     이 흐름은 CLI 로 저장소 생성·프로젝트 생성·키 조회·배포까지 자동화하므로 CLI 설치가 **필수다.**
   - 사용자가 "로컬 실행만 빠르게" 원하면 gh·vercel 은 건너뛰어도 된다(각각 내 저장소 단계·배포 단계에서 다시 안내).
   - git·Node 설치는 승인 팝업/마법사가 뜰 수 있다 → `!` 로 명령을 띄우고 사용자가 완료하게 한 뒤 버전을 재확인한다.
   - **설치 직후 `--version` 으로 인식되는지 꼭 확인한다.** 안 잡히면 새 터미널에서 다시 확인한다(위 진행 원칙 ⚠️).
1. **코드 받기 (URL 만 받은 경우)** — 이미 이 폴더가 열려 있으면(= `package.json` 이 보이면) 건너뛰고
   `npm install` 로 넘어간다. GitHub 주소만 받았다면 **지금 열려 있는 폴더가 비어 있는지 먼저 확인한다.**
   - **비어 있으면 현재 폴더에 그대로 받는다:**
     `git clone https://github.com/kinghama-ledger/home-ledger-example.git .` ← **끝의 점을 빠뜨리지 않는다.**
     사용자가 만든 폴더(예: `my-ledger`)가 곧 프로젝트 루트가 되어야 한다. 하위에 `home-ledger-example/`
     같은 폴더를 한 겹 더 만들면 **폴더 이름이 사람마다 달라지고, 1-2단계의 저장소 이름까지 원본과 같아져**
     이 문서의 안내와 어긋난다.
   - **비어 있지 않으면** 충돌하므로 하위 폴더로 받는다: `git clone <url> my-ledger` 후 그 폴더로 이동한다.
   - 이 저장소는 공개라 클론에 인증이 필요 없다.
   - 어느 쪽이든 클론이 끝나면 프로젝트 루트에서 `npm install` 을 실행한다.
   - 이어서 **Supabase CLI 를 프로젝트에 설치한다(처음 한 번):** `npm install supabase --save-dev` →
     `npx supabase --version` 으로 확인한다. 이 명령으로 `package.json`·`package-lock.json` 이 바뀌는 것은 정상이다.
1-2. **내 GitHub 저장소 만들기 (권장, 건너뛰기 가능)** — 커스텀 내역을 백업하고 Vercel 연동에 쓸
   **사용자 소유 비공개 저장소를** 만든다. 순서:
   - `gh auth status` 로 로그인 확인. 미로그인이면 **사용자가 새 터미널에서 `gh auth login` 을 직접 실행하게**
     안내한다(브라우저 인증 — `npx supabase login` 과 같은 이유로 `!` 비대화형에서 돌리면 안 된다.
     프롬프트는 GitHub.com → HTTPS → Login with a web browser 선택 안내).
   - 로그인 확인 후 **네가 직접** 실행한다: `git remote rename origin template` →
     `gh repo create <폴더명> --private --source=. --push`. 이름 충돌 시 다른 이름을 제안한다.
     **`<폴더명>` 이 `home-ledger-example` 면(= 1단계에서 점 없이 클론된 경우) 그대로 쓰지 말고**
     사용자에게 본인 이름을 넣은 저장소 이름(예: `hong-ledger`)을 제안해 확인받는다. 원본과 같은 이름은
     나중에 본인 저장소인지 샘플인지 구분이 안 된다.
   - ⚠️ **저장소 이름은 영문 소문자·숫자·하이픈으로 정한다**(예: `my-ledger`). 폴더명이 한글이면
     GitHub 은 받아주지만 URL 이 퍼센트 인코딩으로 길어지고, **무엇보다 나중에 Vercel 배포에서 프로젝트
     이름으로 재사용할 수 없다**(아래 배포 도우미 3단계 참고). 폴더명이 한글이면 영문 이름을 제안해 확인받는다.
   - 완료 후 origin=내 저장소, template=원본임을 알려주고, 이후 작업 커밋은 `git push` 로 백업됨을 안내한다.
   - 사용자가 원치 않거나 GitHub 계정이 없으면 건너뛴다(나중에 "내 GitHub 저장소 만들어줘" 로 재개).
2. **Supabase 로그인 (사용자가 새 터미널에서 직접)** — **`!` 로 시키지 말고**, 사용자에게
   **"새 터미널(또는 cmd)을 열어 `npx supabase login` 을 직접 실행"** 하라고 안내한다. 브라우저가 열려 인증하면
   토큰이 자동 저장된다(대시보드 접속·키 복사 불필요). ⚠️ `! npx supabase login`(비대화형)으로 하면 브라우저 대신
   토큰 입력 모드로 빠져 막히므로 쓰지 않는다. 인증 완료 후(네가 `npx supabase projects list` 로 확인) 다음 단계로.
   이 PC 에서 이미 로그인한 적이 있다면 토큰이 남아 있어 이 단계는 확인만으로 지나간다.
3. **프로젝트 준비** — 로그인 후 네가 직접 명령으로 처리한다. 두 갈래 중 하나:
   - **새로 만들기(기본):** **DB 비밀번호는 사용자에게 묻지 말고 네가 강력하게 생성한다.**
     `node -e "console.log(require('crypto').randomBytes(18).toString('hex'))"` 같은 방식으로 특수문자 없는
     안전한 값을 만들고, **이 비밀번호를 즉시 `.env.local` 의 `SUPABASE_DB_PASSWORD=` 에 저장한다**(채팅에 출력하지 않음).
     `npx supabase orgs list -o json` 으로 조직 ID 를 확인하고(여러 개면 사용자가 고르게 한다), 리전은 `ap-northeast-2`(서울)
     기본으로, **네가 직접** 생성한다(사용자에게 실행시키지 않는다):
     `npx supabase projects create "home-ledger-example" --org-id <org> --db-password <생성한비밀번호> --region ap-northeast-2 -o json`
   - **기존 프로젝트 사용:** `npx supabase projects list -o json` 결과를 보여주고 쓸 프로젝트를 고르게 한다.
     (이 경우 DB 비밀번호는 네가 모르므로, `link` 단계에서 사용자에게 한 번 입력받아 `.env.local` 에 저장한다.)
     ⚠️ 다른 앱이 쓰는 프로젝트를 골라 쓰면 두 앱의 테이블이 한 DB 에 섞인다 — 권장하지 않는다. 새로 만드는 쪽을 기본으로.
   - **무료 플랜 제한을 미리 말해 준다:** Supabase 무료 플랜은 **내가 소유자·관리자인 조직을 합쳐 활성 프로젝트 2개다.** 생성이 프로젝트 수 제한으로 실패하면 안 쓰는 프로젝트를
     일시정지/삭제하거나 다른 조직에 만들도록 안내한다.
   - 어느 쪽이든 결과에서 **project ref**(`<ref>`)를 확보한다. 새 프로젝트는 준비에 1~2분 걸릴 수 있어
     `ACTIVE_HEALTHY` 가 될 때까지 `npx supabase projects list -o json` 으로 상태를 확인한 뒤 다음으로 넘어간다.
4. **키 자동 조회 & `.env.local` 작성** — 네가 직접 처리한다(사용자가 키를 복사할 필요 없음):
   - `npx supabase projects api-keys --project-ref <ref> -o json` 으로 `anon` 과 `service_role` 키를 받는다.
   - `cp .env.example .env.local`(Windows cmd 면 `copy`) 후 다음을 채운다:
     `NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co`, `NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon>`,
     `SUPABASE_SERVICE_ROLE_KEY=<service_role>`, 그리고 **`SUPABASE_DB_PASSWORD=<3단계에서 생성한 비밀번호>`**.
     `NEXT_PUBLIC_AUTH_EMAIL_DOMAIN` 은 기본값(example.com) 유지.
   - service_role·DB 비밀번호는 비밀값이므로 채팅에 값을 다시 출력하지 않는다(`.env.local` 에만 저장).
5. **연결 & DB 생성** — 비밀번호를 네가 갖고 있으므로 **사용자 개입 없이 네가 직접** 실행한다:
   - `npx supabase link --project-ref <ref> -p <SUPABASE_DB_PASSWORD>` (3·4단계에서 저장한 값을 그대로 사용).
   - 이어서 `npx supabase db push --yes` 를 실행한다(`--yes` 로 확인 프롬프트 자동 통과). `employees` 와
     가계부 테이블(`hh_*`)·정책이 생성된다.
   - (기존 프로젝트를 골랐고 비밀번호를 모르면) 이때만 사용자에게 한 번 입력받아 `.env.local` 에 저장한 뒤 진행한다.
   - `project not ready`/연결 오류면 프로젝트 준비(1~2분)를 기다렸다가, 또는 login/link 를 재확인 후 재시도한다.
6. **첫 관리자 생성** — 이 앱은 **회원가입 화면이 없다.** 로그인 계정은 이 단계로 만드는 관리자 1개로 시작한다.
   `npm run setup:admin` 만 실행하면 **고정 기본 계정 `admin` / `jadong!`** 로 생성된다. 이 공개 기본값은 **배포 전에 반드시 변경해야 한다고** 계정 생성 전에 먼저 안내한다.
   사용자에게 **ID `admin`, 비밀번호 `jadong!`** 를 또렷하게 알린다. (개인 가계부라 이 계정 하나로 충분하다.)
6-2. **더미 데이터 넣기 (권장)** — `npm run seed:demo` 를 네가 실행한다. 인물 3명 · 계좌 4개(은행 3 + 지역화폐 예시 지갑
   `한빛페이(김하늘)`) · 결제수단 5개 · 대출 3건 · 정기지출·수입 13건 · 할부 2건 · 넉 달 치 거래 약 200건이 들어가 화면이 채워진 채로
   시작할 수 있다(정확한 건수는 시드가 끝날 때 출력하는 표를 본다). 전부 가공의 **「김하늘 · 이바다 가족」** 데이터이며
   실제 사람·계좌와 관계없음을 사용자에게 알린다. 나중에 지우려면 `node scripts/seed-demo.mjs --reset`.
   사용자가 "빈 상태로 시작하겠다"고 하면 건너뛴다.
7. **실행 & 로그인** — `npm run dev` 를 백그라운드로 띄운다. 시작 시 `admin / jadong!` 가 배너로 강조 출력된다.
   http://localhost:3000 에서 **이메일이 아니라 ID `admin` / 비밀번호 `jadong!`** 로 로그인하라고 알린다.
   로그인 직후 **왼쪽 사이드바 맨 아래 '내 이름' 클릭 → 마이페이지(`/dashboard/my`)에서 비밀번호를 꼭 바꾸라고** 안내한다.
   더미 데이터를 넣었다면 **현금흐름** 화면부터 열어 보라고 권한다(이 앱의 핵심 화면).
8. **완료** — 축하 인사와 함께, 폰 문자 자동수집(MacroDroid → 수집함)은 **선택 기능**이며
   배포 후 [설정] ▸ 문자수집 탭에서 토큰을 발급해 나중에 켤 수 있다고 알린다(`SETUP.md` 7단계 참고).
   기본 샘플은 그것 없이도 완전히 동작한다(직접 입력 + 엑셀 붙여넣기).
   인터넷 배포를 원하면 **"배포해줘"** 라고 하면 된다고 안내한다(아래 배포 도우미).

---

## 🚀 배포 도우미 (Vercel)

**트리거:** "배포해줘", "배포하고 싶어", "vercel 배포", "인터넷에 올려줘" → 아래 절차를 진행한다.
로컬 설치(위 초기 설정)가 끝난 상태를 전제로 한다.

1. **로그인 확인** — `vercel whoami` 실행. 미로그인이면 **사용자가 새 터미널에서 `vercel login` 을 직접 실행하게**
   안내한다(브라우저 인증 — `npx supabase login`/`gh auth login` 과 같은 이유로 `!` 비대화형 금지).
2. **비밀번호 점검** — 기본 비밀번호(`jadong!`)를 아직 쓰는지 물어본다. 배포하면 URL 을 아는 누구나 로그인
   화면에 접근하므로, 기본값이면 **배포 전에 마이페이지에서 반드시 변경하도록** 안내하고 바꾼 뒤에 배포를 진행한다.
3. **프로젝트 연결** — `vercel link --yes` 를 네가 실행한다(첫 실행 시 폴더명으로 프로젝트 자동 생성).
   ⚠️ **Vercel 프로젝트 이름은 소문자 영숫자와 `.` `_` `-` 만 허용된다.** 폴더 이름이 한글이거나 대문자·공백을
   포함하면 `invalid_project_name` 으로 실패한다(폴더명이 `우리집-가계부` 같은 경우가 흔하다).
   **먼저 폴더명을 확인하고, 규칙에 안 맞으면 ASCII 이름을 만들어 명시적으로 지정한다:**
   `vercel link --yes --project <ascii-이름>` (예: `my-ledger`). 사용자에게 그 이름을 알려준다 —
   배포 URL 이 `https://<ascii-이름>.vercel.app` 이 된다. 폴더 이름 자체를 바꿀 필요는 없다.
   이미 배포한 다른 프로젝트가 있으면 **이름이 겹치지 않게** 다른 이름을 쓴다.
4. **환경변수 등록** — `.env.local` 에서 값을 읽어 **네가 직접** 등록한다. 값은 채팅에 출력하지 않는다:
   `printf '%s' "<값>" | vercel env add <KEY> production` 방식(비대화형)으로
   `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` /
   `NEXT_PUBLIC_AUTH_EMAIL_DOMAIN` 4개를 넣는다. 이미 존재하는 키는 `vercel env rm <KEY> production -y` 후 재등록.
   문자수집을 켠다면 `vercel.json` 의 일일 크론(수집함 원문 30일 정리)에 필요한 **`CRON_SECRET`** 등록은 필수다.
   네가 임의의 긴 문자열을 생성해 `.env.local` 과 Vercel 양쪽에 넣는다(값은 출력하지 않음). 없으면 30일 원문 정리가 실행되지 않는다.
5. **배포** — `vercel deploy --prod --yes` 를 실행하고 출력된 프로덕션 URL 을 확인한다.
   빌드 실패 시 로그를 읽고 원인(대부분 env 누락)을 고쳐 재배포한다.
6. **검증·마무리** — 배포 URL 을 `curl` 로 200 확인 후 사용자에게 알린다. 함께 안내할 것:
   - 로컬과 배포본은 **같은 Supabase DB** 를 본다(데이터 동일).
   - 코드 수정 후엔 "다시 배포해줘" 한마디면 된다(`vercel deploy --prod --yes`).
   - 폰 문자 자동수집(선택)을 켜려면 이 배포 주소가 필요하다 — `SETUP.md` 7단계.
   - 무료(Hobby) 플랜은 크론을 **하루 1회까지만** 허용한다. 기본 `vercel.json` 은 그 안에 있다.

### 자주 나는 문제
- **`npx supabase` 가 실행되지 않음** → 프로젝트 폴더 안인지 확인하고 `npm install supabase --save-dev` 를 다시 실행한다.
- **`npx supabase login` 했더니 브라우저 대신 "토큰을 입력하라"고 나옴** → `login` 을 비대화형(`!`)에서 돌려서다.
  **사용자가 새 터미널(또는 cmd)을 열어 프로젝트 폴더에서 `npx supabase login` 을 직접 실행하게** 하면 브라우저가 열린다.
- `npx supabase projects create`/`api-keys` 가 인증 오류 → 사용자가 **새 터미널에서 `npx supabase login`** 을 먼저 했는지 확인.
- `npx supabase projects create` 가 **프로젝트 수 제한**으로 실패 → 무료 플랜은 내가 소유자·관리자인 조직을 합쳐 활성 프로젝트 2개. 안 쓰는 프로젝트를
  일시정지/삭제하거나 다른 조직에 만들도록 안내.
- `npx supabase db push` 가 `project not ready`/연결 오류 → 새 프로젝트 준비(1~2분)를 기다린 뒤,
  `npx supabase link --project-ref <ref>` (DB 비밀번호) 를 재확인하고 재시도.
- `npm run build` 실패 → `.env.local` 의 Supabase 값(URL/anon/service_role)이 채워졌는지 확인 (빌드에 필요).
- `setup:admin` 이 비밀번호 길이 오류 → 비밀번호는 **6자 이상이어야** 한다(Supabase Auth 기본 정책).
- `seed:demo` 실패 → `setup:admin` 을 먼저 했는지, `.env.local` 의 `SUPABASE_SERVICE_ROLE_KEY` 가 채워졌는지 확인.
- 로그인 안 됨 → 1) 이메일이 아니라 **ID(`admin`)** 로 시도했는지 확인, 2) `npm run setup:admin -- admin <새비밀번호>` 로 재설정.
- **`gh auth login`/`vercel login` 이 브라우저를 안 열고 코드/토큰을 요구** → 비대화형(`!`)에서 돌려서다.
  supabase 와 동일하게 **사용자가 새 터미널에서 직접** 실행하게 한다. (`gh` 는 device code 가 떠도 브라우저에서
  코드 입력으로 진행 가능하니, 뜨면 그 코드를 안내한다.)
- `gh repo create` 가 "Name already exists" → 다른 저장소 이름을 제안해 재시도.
- `vercel env add` 가 값 입력 프롬프트에서 멈춤 → 대화형이라서다. `printf '%s' "<값>" | vercel env add <KEY> production` 으로 파이프해 비대화형으로 실행한다.
- Vercel 배포는 됐는데 화면이 에러 → 환경변수 4개가 production 에 등록됐는지 `vercel env ls` 로 확인 후 재배포.
- **수집함이 비어 있음** → 문자 자동수집(선택)을 안 켰다면 정상. 거래관리에서 직접 입력하면 된다.

---

## 포함 기능 (메뉴)

**사이드바:** 수집함 · 현금흐름 · 통장내역 · 대출관리 · 거래관리(수입 / 지출 / 통장이동 탭, 지출에 할부 포함) ·
통계 · 설정(계좌정보 / 지출항목 분류 / 인물 / 정기지출 / 예산 / 문자수집) · 시스템개선
(+ 사이드바 하단 **마이페이지**)

- 개인/가족 가계부 단일 모듈이다. 고객·프로젝트·견적 같은 업무 관리 기능은 이 예제에 없다.
- 거래 4종(수입 / 지출(일시불·할부) / 통장이동 / 카드·대출 납부)을 하나의 거래 테이블(`hh_transaction`)로 관리하고,
  계좌 잔액·분류 집계·할부·대출 상환·다음 달 출금 예정을 자동 반영한다.
- **유일한 외부 연동은 폰 문자 자동수집**(선택 기능)이다. 폰의 MacroDroid 가 결제/입금 문자를
  `POST /api/household/inbox/sms` 로 보내면 수집함에 쌓인다. 인증은 헤더 `X-Ingest-Token` 이고, 토큰은
  [설정] ▸ 문자수집 탭에서 발급한다(환경변수가 아니다. 서버엔 해시만 저장). 기본 샘플은 이것 없이 완전히 동작한다.
- 문자수집을 켜면 Vercel의 `CRON_SECRET`으로 일일 크론(수집함 원문 30일 정리)을 반드시 함께 켠다.
- 데이터는 전부 가상이다. `npm run seed:demo` 가 「김하늘 · 이바다 가족」 더미 데이터를 넣고,
  `node scripts/seed-demo.mjs --reset` 이 지운다.

---

## Project Conventions

### Git Rules
- 커밋 메시지는 한국어로 작성한다. 화면명·기능명·변경 목적을 구체적으로 적는다.
  예: `현금흐름 출금예정 표에 잔액 열 추가`, `거래관리 지출 팝업 할부 회차 검증`
- 작업이 끝나면 즉시 커밋한다. 미커밋 상태로 작업을 종료하지 않는다.
- push와 배포는 사용자가 명시적으로 요청할 때만 수행한다.
- 하나의 커밋에는 하나의 목적(기능, 버그 수정, 리팩터링)만 담는다.

### Supabase 마이그레이션
- 최초 설치는 위 "초기 설정 도우미" 또는 `SETUP.md` 를 따른다.
- 스키마를 바꾸면 `supabase/migrations/` 에 새 마이그레이션 파일을 만들고 `npx supabase db push` 로 적용한다.
- DB 스키마를 바꾸는 코드(컬럼 신규/삭제, 제약 변경 등)는 항상 마이그레이션 + 적용까지 한 사이클로 끝낸다.

### Vercel 자동 실행(크론)
- **무료(Hobby) 플랜은 크론을 하루 한 번까지만 허용한다.** 하루 두 번 이상 도는 식을 `vercel.json` 에
  넣으면 배포가 `This cron expression would run more than once via...` 로 **실패한다**.
- 그래서 기본값에는 `/api/household/inbox/purge-raw`(매일 1회, 수집함 원문 30일 정리) 하나만 둔다.
  이 엔드포인트는 `Authorization: Bearer <CRON_SECRET>` 로 보호되므로 배포 시 `CRON_SECRET` 을 등록한다.

### Font
- Pretendard만 사용한다. Geist, Inter 등 다른 폰트를 추가하지 않는다.

### UI Pattern: List -> Popup (가계부 기본)
- **목록 상단 등록 버튼·행 클릭 모두 Dialog(팝업)** 로 입력·수정·삭제한다. 목록에 수정/삭제 버튼은 노출하지 않는다.
- 팝업 1개가 등록·수정을 겸한다: `target=null` 이면 등록, 있으면 수정. 수정 모드에서만 푸터 왼쪽에 삭제 버튼.
- 마스터(분류·계좌·인물 등)는 **목록이 이미 로드한 것을 props 로 내려준다**(팝업에서 재조회 금지).
  등록 모드는 `is_active` 로 거르고, 수정 모드는 거르지 않는다(비활성 마스터를 이미 참조 중일 수 있다).
- 삭제는 `confirm()` 이후 `onSaved()` 로 목록만 새로고침(페이지 이동 없음).
- 적용 리소스: 지출·수입·통장이동·할부·대출·정기지출·계좌·인물·수집함.
- 대량 입력이 필요한 리소스(지출·수입·통장이동·할부)는 **엑셀 붙여넣기 일괄등록 페이지(`/new`)를 별도로 유지하고,**
  등록 팝업 푸터의 '여러 건 입력 (엑셀)' 링크로 연결한다.

### UI Pattern: StatCard
- 카드는 라벨 + 값(+ 데스크톱 아이콘)만 표시한다. 설명글(3번째 줄)은 넣지 않는다.
- 카드 높이는 내용만큼만. 최소 높이를 강제하지 않는다.
- 모바일: 라벨과 값만 표시(아이콘은 `hidden md:flex` 로 데스크톱 전용).
- 금액 StatCard는 `mobileValue` prop에 `formatAmountInMan()`으로 만 단위 표시.

### UI Pattern: 표
- 셀 안 글자를 `truncate` 로 자르지 않는다. 길이를 예측할 수 없는 텍스트(항목명·계좌명·메모)는 줄바꿈시킨다.
- 열 폭은 내용에 맞춘다(`hh-board.tsx` 의 `HH_COL` 척도). `w-[N%]` 같은 비율 폭은 쓰지 않는다.
- 자세한 화면 규칙은 `docs/UI_UX_GUIDELINES.md` 참고.

### 데이터는 전부 가상으로
- 이 샘플의 인물·계좌·거래·테스트 픽스처는 **가공의 「김하늘 · 이바다 가족」** 데이터다.
  실제 사람 이름·실제 계좌번호·실제 결제 문자를 코드·더미 데이터·문서·커밋 메시지에 넣지 않는다.
- `.env.local`·`outputs/`·`backups/` 는 열거나 커밋하지 않는다.

### 가계부 설계 문서
- 기능을 추가/수정하기 전에 `docs/household/` 의 설계 문서(02·03·05)를 먼저 확인한다.
  코드 주석의 `설계 NN` 은 만들 때 남긴 작업 기록 번호이고, 그 문서들은 이 예제에 들어 있지 않다.
  주석 속 스크립트·문서 경로 가운데 이 예제에 없는 것이 있다(측정·진단·일회성 등록 스크립트 등).
- 새 기능은 동일하게 `docs/household/NN_제목.md` 설계서를 만들어 합의한 뒤 구현한다.
