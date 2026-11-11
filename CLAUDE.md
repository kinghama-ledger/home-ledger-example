# 우리 집 가계부 — Claude Code 작업 안내

책 「엑셀 가계부, 8년 쓰고 졸업했습니다」의 실습 예제다. Next.js 16 과 Supabase 로 만든 한 가족용 가계부이고,
들어 있는 인물·계좌·거래는 전부 가상(김하늘·이바다 가족)이다.

이 폴더를 여는 사람은 대개 책을 펴 놓고 따라 하는 초보자다. 터미널 낱말은 풀어서 말하고, 한 번에 한 가지만 시킨다.

| 절 | 내용 |
|---|---|
| 1 | 사용자가 하는 말과 그때 할 일 |
| 2 | 설치 |
| 3 | 배포 |
| 4 | 증상별 처방 |
| 5 | 코드 지도 |
| 6 | 작업 규칙 |

---

## 1. 이런 말을 들으면

책이 독자에게 그대로 치라고 알려 준 말들이다. 비슷한 말도 같은 뜻으로 받는다.

| 사용자의 말 | 할 일 |
|---|---|
| `<저장소 주소> 설치해줘` · `초기 설정 도와줘` · `/setup` | 2절을 처음부터 |
| `이어서 설치해줘` · `했어` | 2절의 표에서 "끝났는지 보는 법"으로 어디까지 됐는지 확인하고, 안 된 첫 단계부터 |
| `가계부 켜줘` | `npm run dev` 를 뒤에서 띄우고 `http://localhost:3000` 을 열라고 알린다. 로그인 ID 는 `admin`, 비밀번호는 설치 때 적어 둔 것 |
| `관리자 비밀번호를 다시 만들어줘` | `npm run setup:admin` (ID 를 바꿔 만든 사람은 `npm run setup:admin -- 그ID`). 새로 나온 비밀번호를 보여 주고 적게 한다(2-9) |
| `로그인 없이 화면이 열리고 자료가 비어 있어. 연결을 확인해줘` | 4절의 같은 줄 |
| `배포해줘` · `다시 배포해줘` · `이어서 배포해줘` | 3절. "다시"는 3-5 만, "이어서"는 안 된 단계부터 |
| `바뀌지 않는 배포 주소 알려줘` | 3-6 의 짧은 주소 |
| `배포 주소가 안 열려. 배포 기록을 보고 고쳐줘` | 4절의 같은 줄 |
| `예제 저장소의 최신 코드를 받아서 다시 배포해줘` | 예제 저장소(리모트 `template`, 없으면 `origin`)의 `main` 을 받아 합친다 → `npm install` → `npx supabase db push --yes` → 3-5. 사용자가 고친 파일과 부딪히면 무엇이 부딪혔는지 보여 주고 묻는다 |
| `가상 데이터만 지워줘` | 1) 가계부 표(`hh_*`)를 `backups/` 아래 파일로 내려받고 위치와 되돌리는 법을 알린다. 안 되면 멈춘다 2) 지울 것을 보여 준다 — `node scripts/seed-demo.mjs --reset` 이 지우는 것은 시드가 넣은 가상 행뿐이다 3) 좋다고 하면 실행. 관리자 계정·문자수집 토큰·사용자가 넣은 자료는 건드리지 않는다 |
| `앱 알림을 수집함으로 보내는 MacroDroid 설정값 알려줘` | `docs/household/MACRODROID_GALAXY.md` 와 `src/app/api/household/inbox/` 를 읽고 주소·헤더·본문을 알려 준다. 토큰 값은 묻지도 찍지도 않는다 |
| `방금 오류를 쉬운 말로 설명하고 고쳐줘` | 오류 원문을 읽고, 무슨 일인지 한두 문장으로 말한 뒤 고친다 |

---

## 2. 설치

책 실습 2 의 흐름이다. 사용자는 빈 폴더(보통 `my-ledger`)에서 Claude Code 를 열고 저장소 주소와 함께 "설치해줘"라고 친다.
끝나면 PC 에서 가계부가 열리고, 화면에 접속 주소·로그인 ID·비밀번호가 나와 있어야 한다.

### 2-0. 진행하는 법

| 원칙 | 내용 |
|---|---|
| 한 단계씩 | 한 단계를 하고, 결과를 눈으로 확인하고, 다음으로 간다. 여러 단계를 한꺼번에 설명하지 않는다 |
| 운영체제부터 | 윈도우인지 맥인지 먼저 알아내고 그쪽 명령만 말한다 |
| 내가 하는 일 | 브라우저 인증과 설치 승인 창을 뺀 모든 명령은 Claude 가 직접 실행한다. 키를 화면에서 복사해 오라고 시키지 않는다 |
| 사용자가 하는 일 1 — 로그인 | `npx supabase login` · `gh auth login` · `vercel login` 은 **사용자가 터미널 창을 새로 열어** 프로젝트 폴더로 들어간 뒤(`cd my-ledger`) 직접 친다. Claude Code 안에서 돌리면 브라우저가 열리지 않고 토큰을 넣으라고 나와 초보자가 막힌다. 끝나면 원래 창에서 "했어"라고 치게 한다 |
| 사용자가 하는 일 2 — 승인 창 | Git·Node.js 를 깔 때 윈도우 확인 창(예), 맥 설치 창(설치·계속, 맥 로그인 비밀번호)은 사용자가 누른다. 무엇이 뜰지 미리 말해 준다 |
| 묻는 말 | 물어야 할 때는 책의 표와 같은 말로 묻는다: "Git·Node.js 를 설치할까요?", "Supabase 프로젝트를 어디에 만들까요?", "내 GitHub 에 비공개 저장소를 만들어 코드를 백업할까요?" |
| 비밀값 | DB 비밀번호·서비스 키·토큰은 `.env.local` 에만 쓰고 대화에 찍지 않는다. 하나뿐인 예외는 2-9 의 새 관리자 비밀번호 |
| 방금 깐 프로그램이 안 보일 때 | 열려 있던 창은 새로 깔린 프로그램을 모른다. `/exit` → 터미널을 새로 열어 `cd my-ledger` → `claude -c` → "이어서 설치해줘" 순서를 알려 준다 |
| 오류 | 원문을 읽고 쉬운 한국어로 원인과 할 일을 말한 뒤 다시 시도한다 |

### 2-1. 단계 한눈에

| 번호 | 단계 | 끝났는지 보는 법 | 누가 |
|---|---|---|---|
| 2-2 | 프로그램 점검·설치 | 버전 명령 5개가 모두 답한다 | Claude(승인 창은 사용자) |
| 2-3 | 코드 받기 | `package.json` 과 `node_modules/` 가 있다 | Claude |
| 2-4 | Supabase CLI | `npx supabase --version` | Claude |
| 2-5 | 내 GitHub 저장소(선택) | `git remote -v` 에 `template` 와 내 `origin` | 로그인은 사용자, 나머지 Claude |
| 2-6 | Supabase 로그인 | `npx supabase projects list` 가 목록을 준다 | 사용자 |
| 2-7 | 프로젝트 만들기와 `.env.local` | `.env.local` 에 주소·키 3개가 차 있다 | Claude |
| 2-8 | DB 올리기 | `npx supabase db push --yes` 가 올릴 것이 없다고 답한다 | Claude |
| 2-9 | 관리자 계정 | `npm run setup:admin` 이 로그인 ID 를 보여 준다 | Claude |
| 2-10 | 가상 자료 | `npm run seed:demo` 가 건수 표를 낸다 | Claude |
| 2-11 | 켜기와 끝 화면 | `http://localhost:3000` 이 로그인 화면을 준다 | Claude |

### 2-2. 프로그램 점검·설치

`git --version`, `node -v`, `npm -v`, `gh --version`, `vercel --version` 을 먼저 돌려 본다. Node.js 는 20.9 이상이어야 한다.
없는 것만 깐다.

| 프로그램 | 윈도우 | 맥 |
|---|---|---|
| Git | `winget install --id Git.Git -e` | `xcode-select --install` (명령어 라인 개발자 도구 설치 창이 뜬다) |
| Node.js | `winget install --id OpenJS.NodeJS.LTS -e` | Homebrew 가 있으면 `brew install node`, 없으면 nodejs.org 의 LTS 설치 파일 |
| GitHub CLI | `winget install --id GitHub.cli -e` | `brew install gh`, 없으면 cli.github.com 의 설치 파일 |
| Vercel CLI | `npm install -g vercel` | 같다 |

- `winget` 이 없는 윈도우는 nodejs.org 와 git-scm.com 의 설치 파일로 안내한다.
- 깐 뒤에는 버전 명령으로 다시 확인한다. 못 찾으면 2-0 의 "방금 깐 프로그램이 안 보일 때".
- GitHub CLI 는 2-5 에서, Vercel CLI 는 3절에서만 쓴다. PC 에서 켜 보는 데는 Git 과 Node.js 면 된다.

### 2-3. 코드 받기

- 폴더에 이미 `package.json` 이 있으면 받는 일은 건너뛰고 `npm install` 만 확인한다.
- 폴더가 비어 있으면 **끝에 점을 붙여** 지금 폴더에 바로 받는다. 점이 빠지면 폴더가 한 겹 더 생겨 책의 `cd my-ledger` 와 어긋난다.

  ```bash
  git clone https://github.com/kinghama-ledger/home-ledger-example.git .
  npm install
  ```

- 폴더에 다른 파일이 있으면 지우지 말고, 하위 폴더 이름을 정해 거기에 받은 뒤 그 폴더에서 이어 간다. 사용자에게 폴더가 바뀐 것을 알린다.

### 2-4. Supabase CLI

전역으로 깔지 않는다. 프로젝트 안에 깔고 늘 `npx supabase …` 로 부른다.

```bash
npm install supabase --save-dev
npx supabase --version
```

`package.json` 과 잠금 파일이 바뀌는 것은 정상이다.

### 2-5. 내 GitHub 저장소 (선택)

"내 GitHub 에 비공개 저장소를 만들어 코드를 백업할까요?"라고 묻는다. 싫다고 하거나 계정이 없으면 건너뛴다.

1. `gh auth status` 로 로그인을 본다. 안 돼 있으면 사용자가 새 창에서 `gh auth login` (GitHub.com → HTTPS → 브라우저로 로그인).
2. 저장소 이름을 정한다. 영문 소문자·숫자·하이픈만 쓴다. 폴더 이름이 그 꼴이면 폴더 이름을, 한글이거나 `home-ledger-example` 이면 다른 이름(예: `my-ledger`)을 제안해 확인받는다.
3. 실행한다.

   ```bash
   git remote rename origin template
   gh repo create <이름> --private --source=. --push
   ```

4. 같은 이름이 이미 있으면 다른 이름으로 다시 한다. 끝나면 `origin` 은 내 저장소, `template` 은 예제 저장소라고 알려 준다.

### 2-6. Supabase 로그인

사용자에게 시킨다: 터미널 창을 하나 더 열고 `cd my-ledger` → `npx supabase login` → 엔터를 누르라고 하면 엔터 → 브라우저에서 허용 → 코드가 보이면 그 창에 친다 → 원래 창에서 "했어".

"했어"를 받으면 `npx supabase projects list` 로 확인한다. 전에 로그인한 PC 는 이 단계가 확인만으로 끝난다.

### 2-7. 프로젝트 만들기와 `.env.local`

1. `.env.example` 을 `.env.local` 로 복사한다(이미 있으면 그대로 쓴다).
2. DB 비밀번호를 만든다. 사용자에게 묻지 않는다. 영문·숫자만으로 24자 이상을 난수로 만들어 **화면에 찍지 않고** `.env.local` 의 `SUPABASE_DB_PASSWORD` 에 바로 쓴다.
3. `npx supabase orgs list -o json` 으로 조직을 본다. 하나면 그것을 쓰고, 여럿이면 "Supabase 프로젝트를 어디에 만들까요?"라고 물어 고르게 한다.
4. 만든다. 이름은 폴더 이름(영문이 아니면 `my-ledger`), 지역은 서울이다.

   ```bash
   npx supabase projects create "<이름>" --org-id <조직> --db-password <비밀번호> --region ap-northeast-2 -o json
   ```

5. 결과에서 프로젝트 ref 를 얻고, `npx supabase projects list -o json` 의 상태가 `ACTIVE_HEALTHY` 가 될 때까지 기다린다(1~2분).
6. `npx supabase projects api-keys --project-ref <ref> -o json` 으로 `anon` 과 `service_role` 키를 받아 `.env.local` 을 채운다.

   | 이름 | 값 |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` 키 |
   | `SUPABASE_SERVICE_ROLE_KEY` | `service_role` 키 |
   | `NEXT_PUBLIC_AUTH_EMAIL_DOMAIN` | `example.com` 그대로 |

- **무료 플랜 한도.** 켜진 프로젝트는 2개까지다(내가 소유자·관리자인 조직을 합쳐서). 한도로 거절되면 Supabase 화면에서 안 쓰는 프로젝트를 **Pause project** 로 멈추고 "이어서 설치해줘"라고 치면 된다고 알린다. 멈춘 프로젝트의 앱은 열리지 않는다는 것도 말한다.
- 사용자가 이미 있는 프로젝트를 쓰겠다고 하면 목록에서 고르게 하고, 그 DB 비밀번호만 한 번 받아 `.env.local` 에 쓴다. 다른 앱이 쓰는 프로젝트에 얹으면 표가 섞이니 새로 만드는 쪽을 권한다.

### 2-8. DB 올리기

```bash
npx supabase link --project-ref <ref> -p <SUPABASE_DB_PASSWORD 값>
npx supabase db push --yes
```

기록 표(`app_logs`)와 가계부 표(`hh_*`)가 생긴다. "준비 중"이나 연결 오류가 나면 1~2분 뒤 다시 한다.

### 2-9. 관리자 계정

이 앱에는 회원가입 화면이 없다. 계정은 이 명령으로 만든 하나를 쓴다.

```bash
npm run setup:admin
```

| 경우 | 동작 |
|---|---|
| 그냥 실행 | ID `admin`, 비밀번호는 무작위 12자. 화면에 한 번 나오고 어디에도 저장되지 않는다 |
| 다시 실행 | 같은 계정의 비밀번호가 새 무작위 값으로 바뀐다(잊었을 때 쓰는 방법) |
| 다른 ID | `npm run setup:admin -- 그ID`. 영문·숫자와 `.` `_` `-` 만, 64자까지(`@` 는 못 쓴다). 켤 때 안내는 마지막으로 만든 ID 를 스스로 기억한다(`.admin-login-id`, git 에 안 올라감). 가상 자료는 `.env.local` 의 `ADMIN_LOGIN_ID` 를 보므로 거기에도 적어 두게 한다 |
| 비밀번호를 직접 정함 | `.env.local` 의 `ADMIN_PASSWORD` 를 권한다(둘째 인자로 주면 터미널 기록에 남는다). 6~200자. 이 값은 화면에 다시 나오지 않으니 Claude 도 되풀이해 말하지 않는다 |

**방금 새로 만들어진 무작위 비밀번호는 사용자에게 그대로 보여 주고 "지금 적어 두세요"라고 말한다.** 비밀값을 대화에 찍지 않는다는 규칙의 하나뿐인 예외다. 2-11 의 끝 화면에서 한 번 더 보여 준다.

### 2-10. 가상 자료

묻지 않고 넣는다(사용자가 빈 가계부로 시작하겠다고 먼저 말했을 때만 건너뛴다).

```bash
npm run seed:demo
```

가상 가족(김하늘·이바다)의 계좌·카드·대출·정기지출과 넉 달 치 거래가 들어간다. 실제 사람·거래와 관계없다고 알린다. 지울 때는 `node scripts/seed-demo.mjs --reset`.

### 2-11. 켜기와 끝 화면

`npm run dev` 를 뒤에서 띄운다(켜지기 직전에 접속 안내가 터미널에 나온다 — 비밀번호 값은 나오지 않는다). `http://localhost:3000` 이 답하는지 확인한 뒤, 아래 꼴로 마무리한다. **세 가지를 반드시 한데 모아 보여 준다.**

```
접속 정보 — 비밀번호는 지금 적어 두세요
- 주소: http://localhost:3000
- 로그인 ID: admin (이메일이 아니라 ID 그대로 입력)
- 비밀번호: <2-9 에서 새로 나온 값>
```

덧붙일 말.

- 비밀번호는 어디에도 저장되지 않는다. 잊으면 "관리자 비밀번호를 다시 만들어줘"라고 하면 된다.
- 로그인한 뒤 왼쪽 아래 이름 → 마이페이지에서 바꿀 수 있다. 6자 이상.
- 첫 화면인 수집함은 비어 있는 것이 정상이다(문자 자동수집은 배포한 뒤에 켜는 선택 기능). 왼쪽 메뉴의 **현금흐름**부터 눌러 보라고 권한다.
- 폰에서도 쓰려면 "배포해줘".

비밀번호를 직접 정한 사용자에게는 값 대신 "직접 정하신 비밀번호"라고 쓴다.

---

## 3. 배포

책 실습 3 의 흐름이다. 설치(2절)가 끝난 폴더에서 "배포해줘"로 시작한다. 끝나면 `접속 주소: https://<프로젝트>.vercel.app` 한 줄이 나와야 한다.

| 번호 | 단계 | 내용 |
|---|---|---|
| 3-1 | 로그인 확인 | `vercel whoami`. 안 돼 있으면 사용자가 새 터미널 창에서 `cd my-ledger` → `vercel login`, 끝나면 "했어". `vercel` 을 못 찾으면 `npm install -g vercel`, 그래도 못 찾으면 창을 새로 열어 `claude -c` → "이어서 배포해줘" |
| 3-2 | 비밀번호 | 올리면 주소를 아는 누구나 로그인 화면까지 온다. 아직 설치 때 비밀번호 그대로라면 마이페이지에서 바꾸고 오라고 알린다(책 3-1). 이미 바꿨다고 하면 넘어간다 |
| 3-3 | 프로젝트 연결 | `vercel link --yes`. Vercel 프로젝트 이름은 소문자 영숫자와 `.` `_` `-` 만 된다. 폴더 이름이 한글이거나 대문자·공백이 있으면 `vercel link --yes --project <영문 이름>` 으로 이름을 정해 주고 그 이름을 알려 준다. 이미 있는 다른 프로젝트와 겹치지 않게 한다 |
| 3-4 | 환경변수 | 아래 표 |
| 3-5 | 올리기 | `vercel deploy --prod --yes`. 실패하면 기록을 읽고 고쳐 다시 올린다(대개 환경변수가 빠진 것) |
| 3-6 | 확인과 끝 화면 | 짧은 주소 `https://<프로젝트>.vercel.app` 가 열리는지 요청을 보내 확인하고 `접속 주소: https://<프로젝트>.vercel.app` 로 알린다. 배포 출력에 나오는 임의 글자가 붙은 긴 주소는 배포할 때마다 바뀌므로 알려 주지 않는다 |

**3-4. 환경변수.** `.env.local` 에서 읽어 값이 화면에 보이지 않게 넣는다.

```bash
printf '%s' "<값>" | vercel env add <이름> production
```

| 이름 | 언제 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 항상 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 항상 |
| `SUPABASE_SERVICE_ROLE_KEY` | 항상 |
| `NEXT_PUBLIC_AUTH_EMAIL_DOMAIN` | 항상 |
| `CRON_SECRET` | 문자수집을 켤 사람은 반드시. 긴 난수를 만들어 `.env.local` 과 Vercel 양쪽에 넣는다. 매일 한 번 30일 지난 문자 원문을 지우는 작업이 이 값으로 인증한다 |

- 이미 있는 이름이면 `vercel env rm <이름> production -y` 로 지우고 다시 넣는다.
- 값 없이 `vercel env add` 만 치면 입력을 기다리며 멈춘다. 반드시 위처럼 값을 흘려 넣는다.
- Vercel 이 플러그인을 깔겠느냐고 물으면 깔지 않는다(책은 독자에게 `No` 를 고르게 한다).

끝에 함께 알릴 것.

- PC 의 가계부와 배포본은 같은 Supabase DB 를 본다. 자료가 같다.
- 코드를 고친 뒤에는 "다시 배포해줘".
- 문자 자동수집을 켜려면 이 주소가 필요하다(책 실습 4, `docs/household/MACRODROID_GALAXY.md`).
- 무료(Hobby) 플랜의 크론은 하루 한 번까지다. `vercel.json` 의 기본값은 그 안에 있다.

---

## 4. 증상별 처방

| 증상 | 원인 | 할 일 |
|---|---|---|
| `git`·`node`·`gh`·`vercel` 을 못 찾는다 | 방금 깔아서 열려 있는 창이 모른다 | `/exit` → 새 창 → `cd my-ledger` → `claude -c` → "이어서 설치해줘"(배포 중이면 "이어서 배포해줘") |
| 로그인 명령이 브라우저 대신 토큰·코드를 묻는다 | Claude Code 안에서 돌렸다 | 사용자가 새 터미널 창에서 직접. `gh` 가 기기 코드를 보여 주면 브라우저에 그 코드를 넣으면 된다 |
| `npx supabase` 가 안 돈다 | 프로젝트 폴더 밖이거나 2-4 를 안 했다 | 폴더를 확인하고 `npm install supabase --save-dev` |
| 프로젝트 만들기·키 받기가 인증 오류 | Supabase 로그인이 안 됐다 | 2-6 |
| 프로젝트 만들기가 한도로 거절 | 무료 플랜은 켜진 프로젝트 2개까지 | 안 쓰는 것을 **Pause project** → "이어서 설치해줘" |
| `db push` 가 준비 중·연결 오류 | 새 프로젝트가 아직 뜨는 중 | 1~2분 뒤 `link` 부터 다시 |
| `gh repo create` 가 이름이 이미 있다고 한다 | 같은 이름의 저장소가 있다 | 다른 이름으로 |
| `setup:admin` 이 접속 값이 없다고 한다 | `.env.local` 의 주소나 서비스 키가 비었다 | 2-7 의 6번 |
| `setup:admin` 이 비밀번호가 짧다고 한다 | 6자 미만 | 6자 이상으로 |
| `seed:demo` 가 실패한다 | 관리자 계정이 없거나 서비스 키가 비었다 | 2-9 를 먼저, `.env.local` 확인 |
| 로그인이 안 된다 | 이메일을 넣었거나 비밀번호가 다르다 | ID 는 `admin` 다섯 글자. 비밀번호를 잊었으면 `npm run setup:admin` 으로 새로 만든다. 틀린 시도가 많으면 잠시 막히니 조금 기다렸다 한다 |
| 화면 대신 "Supabase 접속 값이 없습니다" 오류(500) | `.env.local` 이 없거나 주소·`anon` 키가 비었다 | 2-7 의 6번을 하고 `npm run dev` 를 다시 켠다 |
| 로그인 없이 화면이 열리고 자료가 비어 있다 | 앱이 Supabase 에 닿지 못했다. 인증 서버에 연결이 안 될 때는 쓰던 사람을 내쫓지 않으려고 화면을 막지 않는데, 자료는 못 불러와 빈다 | 1) `.env.local` 의 주소가 `npx supabase projects list` 의 ref 와 맞는지 2) 프로젝트가 멈췄으면(오래 안 쓰면 Supabase 가 재운다) supabase.com 에서 **Restore** 를 누르고 몇 분 기다리게 한다 3) `npm run dev` 를 다시 켠다 |
| 수집함이 비어 있다 | 문자 자동수집을 안 켰다 | 정상이다. 거래관리에서 직접 넣을 수 있다 |
| 저장이 안 되고 "마스킹 모드에서는 저장하지 않습니다"가 뜬다 · 수집함 대신 안내문이 보인다 | 마스킹 모드가 켜져 있다(주소에 `?mask=on` 을 붙여 들어왔거나 버튼을 눌렀다) | 왼쪽 아래 **마스킹 ON** 버튼이나 `Ctrl/⌘ + Shift + M` 으로 끈다 |
| 배포는 됐는데 주소가 안 열린다 · 오류 화면 | 환경변수가 빠졌거나 빌드가 실패했다 | `vercel env ls` 로 4개를 확인하고, `vercel inspect <주소> --logs` 나 `vercel logs` 로 기록을 읽어 고친 뒤 3-5 |
| 배포가 크론 식 때문에 거절된다 | 무료 플랜은 하루 한 번까지 | `vercel.json` 의 크론을 하루 한 번으로 되돌린다 |
| 폰 문자가 다시 배포한 뒤 안 들어온다 | 폰에 긴(임시) 주소가 들어 있다 | 3-6 의 짧은 주소로 바꾸게 한다 |

---

## 5. 코드 지도

| 자리 | 내용 |
|---|---|
| `src/app/dashboard/household/` | 가계부 화면 — 수집함·현금흐름·통장내역·대출관리·거래관리(지출·수입·통장이동)·통계·설정·시스템개선 |
| `src/components/household/`, `src/lib/household/` | 가계부 부품과 계산·문자 해석 |
| `src/app/api/household/` | 문자·알림을 받는 주소와 원문 정리 크론 |
| `src/lib/backend/` | Supabase 연결. `browserDb()` 화면용, `requestDb()` 요청 쿠키용, `serviceDb()` 서비스 키용(서버 전용). 접속 값은 `env.ts` 한곳에서 읽는다 |
| `src/lib/account/` | 로그인 사용자 확인(`getSignedInUser`, `denyAccess`), 인증 서버 장애 판정, 이름·로그인 ID 꺼내기 |
| `src/proxy.ts` | 요청 문지기. 화면 요청마다 세션을 검증해 로그인 안 된 사람을 `/login` 으로 보낸다. 주소의 `?mask=on` 을 마스킹 쿠키로 바꾸고, 마스킹 중인 브라우저의 저장 요청(API)을 막는다 |
| `src/lib/privacy/`, `src/components/privacy/` | 마스킹 모드. `mask.ts` 가짜 값 만들기, `demo-link.ts` 주소로 켜기·막을 요청과 화면 규칙, `mode-store.ts` 켜짐 상태, `privacy-mode.tsx` 버튼·표시·화면 문 |
| `src/app/api/auth/login`, `src/app/api/account/{password,profile}` | 로그인(시도 제한 포함), 비밀번호·이름·로그인 ID 변경 |
| `src/app/dashboard/my/` | 마이페이지 |
| `supabase/migrations/` | DB 구조. 맨 앞 파일이 기록 표, 나머지가 가계부 |
| `scripts/` | `setup-admin.mjs`(관리자 계정), `seed-demo.mjs`(가상 자료), `dev-banner.mjs`(켤 때 안내), `lib/admin-account.mjs`(ID·비밀번호 규칙), `test_*`(시험) |
| `src/lib/audit/` | 기록. `server.ts` 서버용(`auditInfo`·`auditError`), `client.ts` 화면용(`reportEvent`), `actions.ts` 화면에서 남길 수 있는 이름 목록 — 화면에 새 기록을 넣을 때 여기에 이름을 먼저 추가한다 |
| `src/lib/site/meta.ts`, `src/app/manifest.ts` | 앱 이름·아이콘·테마색·검색 차단과 홈 화면 추가 정보 |

알아 둘 것.

- 계정은 Supabase Auth 의 사용자 하나다. 로그인 ID `admin` 은 안에서 `admin@<NEXT_PUBLIC_AUTH_EMAIL_DOMAIN>` 이메일로 바뀐다. 화면에 보이는 이름은 그 계정 정보의 `display_name` 이고, 없으면 "관리자"다. 계정을 담는 표는 따로 없다.
- 가계부 표는 모두 `owner_auth_uid` 로 주인을 가린다(본인 행만 읽고 쓴다).
- 거래 네 종류(수입, 지출, 통장이동, 카드·대출 납부)가 표 하나(`hh_transaction`)에 들어가고, 잔액·할부·대출 상환·다음 달 출금 예정은 거기서 계산한다.
- 밖과 이어지는 곳은 폰 문자 자동수집 하나뿐이다(선택). 폰의 MacroDroid 가 `POST /api/household/inbox/sms` 로 보내고, 헤더 `X-Ingest-Token` 으로 인증한다. 토큰은 환경변수가 아니라 앱의 설정 → 문자수집에서 발급하며 서버에는 해시만 남는다.
- 접속 값이 없어도 `npm run build` 는 통과해야 한다. 환경변수는 모듈 맨 위가 아니라 함수 안에서 읽는다.
- 이 저장소의 Next.js 는 16 이다. 요청을 가로채는 파일의 이름과 규약이 예전과 다르니, 손대기 전에 `node_modules/next/dist/docs/` 의 해당 문서를 읽는다(`AGENTS.md` 참고).

---

## 6. 작업 규칙

### 커밋·푸시

- 커밋 메시지는 한국어로, 어느 화면의 무엇을 왜 바꿨는지 적는다. 예: `현금흐름 출금예정 표에 잔액 열 추가`
- 커밋 하나에는 목적 하나.
- 일을 마치면 커밋해 둔다. 푸시와 배포는 사용자가 하라고 했을 때만 한다.

### DB 구조 바꾸기

`supabase/migrations/` 에 새 파일을 만들고 `npx supabase db push` 로 올리는 것까지가 한 벌이다. 이미 올라간 파일은 고치지 않는다.

### 크론

`vercel.json` 에는 `/api/household/inbox/purge-raw`(매일 한 번, 30일 지난 문자 원문 삭제) 하나만 둔다. 이 주소는 `Authorization: Bearer <CRON_SECRET>` 으로 지킨다. 무료 플랜은 하루에 두 번 이상 도는 식을 넣으면 배포가 거절된다.

### 글꼴

Pretendard 하나만 쓴다. 다른 글꼴을 들이지 않는다.

### 화면 — 목록에서 팝업으로

- 등록 버튼과 행 클릭 모두 대화상자(Dialog)를 연다. 목록에는 수정·삭제 버튼을 두지 않는다.
- 대화상자 하나가 등록과 수정을 겸한다. `target=null` 이면 등록, 있으면 수정. 삭제 버튼은 수정일 때만 아래 줄 왼쪽에.
- 분류·계좌·인물 같은 기준 자료는 목록이 불러온 것을 props 로 내려 준다(대화상자에서 다시 불러오지 않는다). 등록일 때는 `is_active` 로 거르고, 수정일 때는 거르지 않는다(꺼진 항목을 이미 쓰고 있을 수 있다).
- 삭제는 `confirm()` 뒤 `onSaved()` 로 목록만 새로 고친다.
- 해당: 지출·수입·통장이동·할부·대출·정기지출·계좌·인물·수집함.
- 여러 건을 넣는 지출·수입·통장이동·할부는 엑셀 붙여넣기 화면(`/new`)을 따로 두고, 등록 대화상자 아래 '여러 건 입력 (엑셀)' 링크로 잇는다.

### 화면 — 통계 카드

- 이름표와 값(PC 에서는 아이콘까지)만 둔다. 설명 줄을 넣지 않는다.
- 높이는 내용만큼. 최소 높이를 주지 않는다.
- 금액 카드는 좁은 화면용 `mobileValue` 에 `formatManwon()`(`@/lib/household/won-format`)으로 만원 단위를 넣는다.

### 화면 — 표

- 칸 안 글자를 `truncate` 로 자르지 않는다. 길이를 알 수 없는 글(항목명·계좌명·메모)은 줄을 바꾼다.
- 열 폭은 `hh-board.tsx` 의 `HH_COL` 척도에서 고른다. `w-[N%]` 같은 비율 폭은 쓰지 않는다.
- 색·대화상자·공식 ui 원본과 다른 곳은 `docs/ui-rules.md`.

### 자료는 전부 가상으로

- 인물·계좌·거래·시험 자료는 가공의 「김하늘 · 이바다 가족」이다. 실제 이름·계좌번호·결제 문자를 코드·문서·커밋 메시지에 넣지 않는다.
- `.env.local`·`outputs/`·`backups/` 는 커밋하지 않고, 시킨 일에 필요할 때만 연다. 설치·배포에서 `.env.local` 을 읽고 쓰는 것은 그 일의 일부지만, 그 안의 값을 대화에 옮기지 않는다.

### 설계 문서

- 기능을 더하거나 고치기 전에 `docs/household/` 의 02·03·05 를 먼저 읽는다.
- 코드 주석의 `설계 NN` 은 만들 때 남긴 작업 번호이고, 그 문서들은 이 예제에 들어 있지 않다. 주석이 가리키는 스크립트·문서 가운데 이 예제에 없는 것이 있다.
- 새 기능은 `docs/household/NN_제목.md` 설계서를 먼저 써서 합의한 뒤 만든다.
