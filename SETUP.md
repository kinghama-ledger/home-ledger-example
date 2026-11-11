# 설치 안내 — 손으로 직접 할 때

이 문서는 명령을 직접 치며 설치하려는 분을 위한 것입니다. 책 「엑셀 가계부, 8년 쓰고 졸업했습니다」의 실습 2·3 은
같은 일을 Claude Code 에게 맡기는 방법을 그림과 함께 설명합니다.

| 방법 | 하는 일 |
|---|---|
| Claude Code 에게 맡기기 | 빈 폴더에서 Claude Code 를 열고 `https://github.com/kinghama-ledger/home-ledger-example.git 설치해줘` 라고 칩니다. 이미 받은 폴더라면 `초기 설정 도와줘` 나 `/setup`. 중간에 멈췄으면 `이어서 설치해줘` |
| 직접 하기 | 아래 1번부터 차례로 |

끝나면 `http://localhost:3000` 에서 ID `admin` 으로 로그인됩니다. **비밀번호는 5번에서 화면에 한 번 나옵니다. 그때 적어 두세요.**

## 미리 알아 둘 것

| 항목 | 내용 |
|---|---|
| 계정 | GitHub · Supabase · Vercel. 모두 무료로 됩니다. Vercel 은 인터넷에 올릴 때만 필요합니다 |
| Supabase 에서 | 가입만 하고 프로젝트는 만들지 않습니다. 프로젝트는 3번에서 명령으로 만듭니다 |
| 터미널 | 윈도우는 PowerShell, 맥은 터미널. 모든 명령은 프로젝트 폴더 안에서 칩니다 |
| 걸리는 시간 | 프로그램이 깔려 있으면 15분쯤 |

| 낱말 | 뜻 |
|---|---|
| ref | Supabase 가 프로젝트마다 붙이는 영문·숫자 이름. 주소 `https://<ref>.supabase.co` 에 들어갑니다 |
| anon 키 · service_role 키 | Supabase 접속 열쇠 둘. 앞의 것은 화면용, 뒤의 것은 관리용이라 남에게 보이면 안 됩니다 |
| 리모트 | 내 PC 의 코드와 이어진 인터넷 저장소. `origin`·`template` 은 거기 붙인 이름입니다 |
| 크론 | 정해진 시각마다 저절로 도는 작업 |

---

## 1. 프로그램 깔기

| 프로그램 | 쓰임 | 윈도우 | 맥 |
|---|---|---|---|
| Git | 코드 받기 | `winget install --id Git.Git -e` | `xcode-select --install` |
| Node.js 20.9 이상 | 앱 실행 | `winget install --id OpenJS.NodeJS.LTS -e` | `brew install node` 또는 nodejs.org 의 LTS 설치 파일 |
| GitHub CLI | 내 저장소 만들기(선택) | `winget install --id GitHub.cli -e` | `brew install gh` |
| Vercel CLI | 인터넷에 올리기(선택) | `npm install -g vercel` | 같습니다 |

확인합니다. 모두 버전을 답하면 됩니다.

```bash
git --version
node -v
npm -v
gh --version
vercel --version
```

- 깔자마자 못 찾는다고 나오면 터미널 창을 닫고 새로 엽니다.
- 윈도우 확인 창은 **예**, 맥의 개발자 도구 설치 창은 **설치**를 누릅니다.
- `winget` 이 없으면 nodejs.org 와 git-scm.com 에서 설치 파일을 받습니다.

## 2. 코드 받기

빈 폴더를 만들어 그 안에 받습니다. `git clone` 줄 **끝의 점**이 "지금 폴더에 바로"라는 뜻입니다.

```bash
mkdir my-ledger
cd my-ledger
git clone https://github.com/kinghama-ledger/home-ledger-example.git .
npm install
npm install supabase --save-dev
npx supabase --version
```

- 폴더 이름은 영문 소문자·숫자·하이픈으로 짓습니다. 나중에 저장소와 배포 이름으로 다시 씁니다.
- 점을 빼먹어 `home-ledger-example` 폴더가 한 겹 생겼다면 그 안으로 들어가 이어 가면 됩니다.
- Supabase CLI 는 이 프로젝트 안에만 깝니다. 그래서 늘 `npx supabase …` 로 부릅니다. `package.json` 이 바뀌는 것은 정상입니다.
- ZIP 으로 받지 않습니다. 아래의 내 저장소 만들기와 새 판 받기가 Git 저장소여야 됩니다.

**내 GitHub 저장소에 백업하기 (선택).** 고친 코드를 내 비공개 저장소에 올려 둡니다.

```bash
gh auth login
git remote rename origin template
gh repo create my-ledger --private --source=. --push
```

이제 `git push` 는 내 저장소(`origin`)로 가고, 예제의 새 판은 `git pull template main` 으로 받습니다.

## 3. Supabase 프로젝트 만들기

```bash
npx supabase login
npx supabase orgs list
npx supabase projects create "my-ledger" --org-id <조직 ID> --db-password <DB 비밀번호> --region ap-northeast-2
npx supabase projects list
```

| 줄 | 설명 |
|---|---|
| `login` | 브라우저가 열립니다. 허용하고, 코드가 보이면 터미널에 칩니다. **Claude Code 안이 아니라 보통 터미널 창에서** 쳐야 브라우저가 열립니다 |
| `orgs list` | 조직 ID 를 봅니다 |
| `projects create` | DB 비밀번호는 영문·숫자로 길게 직접 정하고 적어 둡니다. `ap-northeast-2` 는 서울입니다 |
| `projects list` | 방금 만든 프로젝트의 ref 를 봅니다. 준비에 1~2분 걸립니다 |

무료 플랜은 켜진 프로젝트가 2개까지입니다(내가 소유자·관리자인 조직을 합쳐서). 거절되면 Supabase 화면에서 안 쓰는 프로젝트를 **Pause project** 로 멈춘 뒤 다시 만듭니다.

## 4. 접속 값 적고 DB 올리기

예시 파일을 복사해 `.env.local` 을 만듭니다(윈도우 cmd 는 `copy`).

```bash
cp .env.example .env.local
npx supabase projects api-keys --project-ref <ref>
```

`.env.local` 을 열어 채웁니다.

| 이름 | 넣을 값 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 방금 나온 `anon` 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | 방금 나온 `service_role` 키 (비밀) |
| `NEXT_PUBLIC_AUTH_EMAIL_DOMAIN` | `example.com` 그대로 |
| `SUPABASE_DB_PASSWORD` | 3번에서 정한 DB 비밀번호 (비밀, 앱은 쓰지 않고 다시 연결할 때를 위한 기록) |

DB 에 표를 만듭니다.

```bash
npx supabase link --project-ref <ref>
npx supabase db push
```

`link` 가 DB 비밀번호를 물으면 3번의 것을 넣고, `db push` 가 올려도 되느냐고 물으면 `Y`.
끝나면 Supabase 화면의 Table Editor 에 기록 표(`app_logs`)와 가계부 표(`hh_` 로 시작하는 것들)가 보입니다.

## 5. 계정 만들고 가상 자료 넣기

이 앱에는 회원가입 화면이 없습니다. 계정은 명령으로 하나 만듭니다.

```bash
npm run setup:admin
npm run seed:demo
```

| 명령 | 하는 일 |
|---|---|
| `npm run setup:admin` | 로그인 ID `admin` 계정을 만들고 **무작위 비밀번호 12자를 화면에 한 번** 보여 줍니다. 저장되지 않으니 바로 적습니다 |
| 같은 명령을 다시 | 비밀번호가 새 값으로 바뀌어 다시 나옵니다. 잊었을 때 이렇게 합니다 |
| `npm run setup:admin -- 아이디` | 다른 ID 로 만듭니다(영문·숫자와 `.` `_` `-`, 64자까지. `@` 는 쓸 수 없습니다). `.env.local` 의 `ADMIN_LOGIN_ID` 에도 그 ID 를 적어 둡니다 |
| `.env.local` 에 `ADMIN_PASSWORD=...` 를 적고 `npm run setup:admin` | 비밀번호를 직접 정합니다(6~200자). 이 값은 화면에 다시 나오지 않습니다. 명령 뒤에 `-- 아이디 비밀번호` 로 줄 수도 있지만 터미널 기록에 남으므로 권하지 않습니다 |
| `npm run seed:demo` | 가상 가족(김하늘·이바다)의 계좌·카드·대출·정기지출과 넉 달 치 거래를 넣습니다. 여러 번 돌려도 겹쳐 들어가지 않습니다 |
| `node scripts/seed-demo.mjs --reset` | 가상 자료만 지웁니다. 계정과 표는 남습니다 |

가상 자료는 실제 사람·계좌·거래와 관계가 없습니다. 마음껏 고치고 지워도 됩니다.

## 6. 켜고 로그인하기

```bash
npm run dev
```

브라우저에서 `http://localhost:3000` 을 엽니다.

| 칸 | 넣을 것 |
|---|---|
| 로그인 ID | `admin` (이메일이 아닙니다) |
| 비밀번호 | 5번에서 적어 둔 것 |

- 첫 화면은 수집함이고, 비어 있는 것이 정상입니다. 왼쪽 메뉴의 **현금흐름**부터 눌러 보세요.
- 비밀번호는 왼쪽 아래 이름 → 마이페이지에서 바꿉니다.
- 화면을 남에게 보여 줄 때는 주소 뒤에 `?mask=on` 을 붙여 엽니다(예: `http://localhost:3000/dashboard?mask=on`). 금액·이름이 가짜 값으로 보이고, 켜져 있는 동안에는 저장되지 않습니다. 끌 때는 왼쪽 아래 **마스킹 ON** 버튼을 누릅니다.
- 끌 때는 터미널에서 `Ctrl + C`, 다시 켤 때는 `npm run dev`.

| 다 됐는지 | 확인 |
|---|---|
| 프로그램 | 1번의 버전 명령이 모두 답한다 |
| DB | `npx supabase db push` 가 더 올릴 것이 없다고 한다 |
| 계정 | 화면에 나온 비밀번호를 적어 두었다 |
| 화면 | `admin` 으로 로그인되고 현금흐름에 가상 자료가 보인다 |

---

## 7. 인터넷에 올리기 (선택)

폰에서 열거나 문자 자동수집을 쓰려면 올려야 합니다. Claude Code 에게는 `배포해줘` 한마디면 됩니다. 직접 한다면:

**먼저 비밀번호를 바꿉니다.** 올리면 주소를 아는 누구나 로그인 화면까지 올 수 있습니다. 마이페이지에서 남이 짐작하기 어려운 것으로 바꿉니다.

```bash
vercel login
vercel link --yes --project my-ledger
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add NEXT_PUBLIC_AUTH_EMAIL_DOMAIN production
vercel deploy --prod --yes
```

| 줄 | 설명 |
|---|---|
| `vercel link` | 프로젝트 이름은 소문자 영숫자와 `.` `_` `-` 만 됩니다. 폴더 이름이 한글이어도 `--project` 로 영문 이름을 주면 됩니다 |
| `vercel env add` | 줄마다 값을 물으면 `.env.local` 의 같은 이름 값을 붙여 넣습니다 |
| `vercel deploy --prod --yes` | 올립니다. 고친 뒤 다시 올릴 때도 이 줄입니다 |

- 내 주소는 `https://<프로젝트 이름>.vercel.app` 입니다. 명령 출력에 나오는 임의 글자가 붙은 긴 주소는 올릴 때마다 바뀌니 쓰지 않습니다.
- PC 의 가계부와 올린 가계부는 같은 DB 를 봅니다. 자료가 같습니다.
- `vercel.json` 에는 매일 한 번 도는 크론이 하나 있습니다(`/api/household/inbox/purge-raw` — 수집함의 문자 원문을 30일 뒤 지웁니다). **문자 자동수집을 켤 사람은 `CRON_SECRET` 을 꼭 등록합니다.** 아무 긴 임의 문자열이면 됩니다. 없으면 원문 정리가 돌지 않습니다.

  ```bash
  vercel env add CRON_SECRET production
  ```

- 무료(Hobby) 플랜의 크론은 하루 한 번까지입니다. 더 자주 도는 식을 넣으면 배포가 거절됩니다.

---

## 8. 폰 문자 자동수집 켜기 (선택)

**이 단계 없이도 가계부는 완전히 동작합니다.** 수입·지출·통장이동은 화면에서 직접 넣거나 엑셀 붙여넣기로 한꺼번에 넣으면 됩니다.
"카드 결제 문자가 올 때마다 폰이 알아서 가계부에 넣어 주는" 자동화를 원할 때만 보세요.

### 무엇이 되나요

1. 카드사·은행에서 **결제/입금 문자**가 폰에 도착합니다.
2. 폰의 자동화 앱(**MacroDroid**)이 그 문자를 이 앱의 주소로 보냅니다:
   `POST https://<내-배포-주소>/api/household/inbox/sms`
3. 서버가 종류(승인·취소·입금·출금·이체)·금액·가맹점을 추정해 **수집함의 검토 대기**에 쌓습니다.
4. 사용자가 **수집함**에서 확인·수정하고 확정하면 거래내역에 반영됩니다. 문자 원문은 30일 뒤 자동 삭제됩니다.

### 필요한 것

| 항목 | 설명 |
|------|------|
| **안드로이드 폰** | 문자를 읽어 보내는 앱이 안드로이드용입니다(아이폰은 문자 접근이 막혀 있어 불가). |
| **MacroDroid 앱** | Play 스토어에서 설치. "문자를 받으면 → HTTP 요청 전송" 매크로를 만듭니다. |
| **배포된 주소** | 폰이 인터넷으로 접속해야 하므로 7번의 배포가 먼저 필요합니다. (`localhost` 는 폰에서 안 보입니다.) |
| **문자수집 토큰** | 앱에 로그인 → **[설정] ▸ 문자수집** 탭 → **토큰 발급**. 발급 화면에서 **딱 한 번만** 보이니 바로 복사하세요. (서버에는 해시만 저장됩니다.) |
| **`CRON_SECRET`** | 7번에서 Vercel 환경변수로 등록합니다. 문자 원문을 30일 뒤 지우는 작업에 필요합니다. |

- 토큰은 폰이 보내는 요청의 **헤더 `X-Ingest-Token`** 에 넣습니다. 환경변수(`.env.local`)에 넣는 값이 아닙니다.
- 토큰이 새면 남이 내 수집함에 문자를 넣을 수 있으니, 의심되면 설정 화면에서 삭제하고 다시 발급하세요.

### 절차 (요약)

1. 7번대로 배포하고 배포 주소를 확인합니다.
2. **폰 브라우저로** 배포본에 로그인 → **[설정] ▸ 문자수집** 에서 **토큰 발급** → 노란 상자의 **MacroDroid 용 한 번에 복사**를 누릅니다.
   (수집함이 비어 있으면 첫 화면의 **문자 자동수집 설정** 단추로 바로 갈 수 있습니다.)
3. 폰에서 MacroDroid 매크로를 만듭니다 — 발동(트리거)은 "메시지를 받으면", 동작(액션)은 "HTTP 요청". HTTP 요청 화면 맨 위 제목 오른쪽 첫 번째 단추(네모 안으로 화살표)를 눌러 뜨는 **cURL 명령어 가져오기** 창에 방금 복사한 것을 붙여 넣으면 값이 한 번에 채워집니다.
   (칸마다 직접 넣으려면 [설정] ▸ 문자수집의 '결제문자 자동수집 설정 방법'을 펼치면 **URL · 헤더 · 본문 예시**가 나옵니다.)
   단계별 안내: **[docs/household/MACRODROID_GALAXY.md](./docs/household/MACRODROID_GALAXY.md)** (화면 그림은 책의 실습 4 에 있습니다)
4. 테스트 문자를 한 통 받아 **수집함**에 들어오는지 확인합니다.

- 요청 형식(JSON/form/plain)·응답 코드·문제 해결 전체: **[docs/household/SMS_FORWARDING.md](./docs/household/SMS_FORWARDING.md)**
- 예전 경로 `/api/household/sms` 도 같은 동작을 합니다(권장은 `/api/household/inbox/sms`).

> ⚠️ 이 기능은 **내 폰의 실제 결제 문자**를 다룹니다. 가상 자료 연습과 달리 진짜 개인 금융정보가 서버에 들어가므로,
> 로그인 비밀번호·배포 주소·토큰을 남과 공유하지 마세요.

---

## 시험을 돌리기 전에 (DB 에 쓰고 지우는 시험)

이 저장소의 시험 가운데에는 **DB 에 행을 넣었다가 지우는 것**이 있습니다.
**실제 데이터를 넣은 뒤에는 돌리지 마세요.** 돌리려면 시험용 Supabase 프로젝트를 따로 만들어 그 프로젝트의 값을 `.env.local` 에 넣고 돌립니다.

| 명령 | DB 에 하는 일 | 더 필요한 것 |
|------|---------------|--------------|
| `npm test` | 쓰지 않음 (`test:card-group` 만 연결 값이 있으면 읽기만 함) | 없음 |
| `npm run test:sms-ingest` | 수집함·토큰·가맹점 규칙에 넣고 지움 | dev 서버(`npm run dev`) |
| `npm run test:cross-sweep-live` | 수집함·토큰에 넣고 지움 | dev 서버, `BASE_URL`(기본값이 3100 포트) |
| `npm run test:sweep-rpc` | 수집함에 넣고 지움 | 없음 |
| `npm run test:inbox-cancel` | 거래·수집함에 넣고 지움 | `E2E_LOGIN_PASSWORD` |
| `npm run test:inbox-loan` | 거래·수집함에 넣고 지움 | `E2E_LOGIN_PASSWORD` |
| `npm run test:table-render` | 화면만 엶(로그인 기록이 한 줄 남음) | dev 서버, `E2E_LOGIN_PASSWORD` |

- `scripts/` 폴더에는 `npm` 명령으로 등록되지 않은 시험 파일(`test_*.mjs` 등)이 더 있고, 그 가운데에도 DB 에 쓰고 지우는 것이 있습니다. 같은 주의가 적용됩니다.
- `E2E_LOGIN_PASSWORD` 가 없으면 로그인하는 시험은 `로그인 실패: Invalid login credentials` 로 멈춥니다. 값은 `.env.local` 에 적습니다(`.env.example` 참고).
- `npm run setup:admin` 으로 비밀번호를 새로 만들었다면 `E2E_LOGIN_PASSWORD` 도 새 값으로 바꿉니다.

---

## 알려진 한계

| 항목 | 내용 |
|---|---|
| 로그인·비밀번호 확인 시도 제한 | 틀린 횟수를 세는 일과 적는 일이 따로라, 같은 순간에 한꺼번에 보낸 요청은 정해진 횟수를 그 수만큼 넘겨 시도될 수 있습니다. 하나씩 보내는 시도는 정해진 횟수에서 막힙니다. 가족끼리 쓰는 예제의 범위로 두었고, 여럿이 쓰는 서비스로 키울 때는 DB 함수로 세기와 적기를 한 번에 하도록 바꿔야 합니다 |

---

## 막혔을 때

| 증상 | 할 일 |
|---|---|
| 방금 깐 명령을 못 찾는다 | 터미널 창을 새로 엽니다 |
| `npx supabase` 가 안 된다 | 프로젝트 폴더 안인지 보고 `npm install supabase --save-dev` 를 다시 |
| `npx supabase login` 이 토큰을 넣으라고 한다 | Claude Code 안에서 친 것입니다. 보통 터미널 창에서 직접 칩니다. `gh auth login`·`vercel login` 도 같습니다 |
| 프로젝트를 못 만든다(개수 한도) | 켜진 프로젝트가 2개를 넘을 수 없습니다. 안 쓰는 것을 **Pause project** |
| `db push` 가 연결·권한 오류 | 새 프로젝트면 1~2분 기다립니다. 그래도 안 되면 `login` 과 `link` 를 다시 |
| 비밀번호가 짧다고 한다 | 6자 이상이어야 합니다 |
| `seed:demo` 가 실패한다 | `setup:admin` 을 먼저 했는지, `.env.local` 의 `SUPABASE_SERVICE_ROLE_KEY` 가 찼는지 봅니다 |
| 로그인이 안 된다 | 이메일이 아니라 `admin`. 비밀번호를 잊었으면 `npm run setup:admin` 을 다시 돌려 새로 나온 값으로. 여러 번 틀리면 잠시 막히니 조금 기다립니다 |
| 화면 대신 "Supabase 접속 값이 없습니다" 오류 | `.env.local` 이 없거나 주소·`anon` 키가 비었습니다. 4번대로 채우고 `npm run dev` 를 다시 켭니다 |
| 로그인하지 않았는데 화면이 열리고 자료가 비어 있다 | 앱이 Supabase 에 닿지 못한 것입니다. 연결이 끊겼을 때 쓰던 사람이 쫓겨나지 않도록 화면은 열어 두는데, 자료는 못 불러와 빕니다. `.env.local` 의 주소가 맞는지 보고, Supabase 화면에서 프로젝트가 멈춰(Paused) 있으면 **Restore** 를 누른 뒤 몇 분 기다렸다가 `npm run dev` 를 다시 켭니다 |
| 수집함이 비어 있다 | 문자 자동수집(8번)을 켜지 않았으면 정상입니다. 거래관리에서 직접 넣으세요 |
| 올렸는데 화면이 오류 | `vercel env ls` 로 환경변수 4개가 production 에 있는지 보고 다시 올립니다 |

그래도 안 풀리면 화면의 오류 글을 그대로 복사해 Claude Code 에 붙여 넣고 물어보세요.
