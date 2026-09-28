# 우리 집 가계부 설치 가이드 (로컬 실행)

처음 설치하는 분도 **이 문서만 따라 하면** 내 컴퓨터에서 우리 집 가계부를 실행하고 로그인할 수 있습니다.
설치는 크게 6단계이고, 보통 **10~15분이면** 끝납니다.

> 🔐 설치 과정에서 만드는 기본 계정은 `admin` / `jadong!`입니다. 이 값은 공개된 예제값이므로 **인터넷에 배포하기 전에 반드시 마이페이지에서 비밀번호를 변경하세요.**

## 전체 흐름 한눈에

```
0. 필요한 프로그램 설치 (git · Node.js · GitHub CLI · Vercel CLI)
1. 코드 받기 (git clone) + npm install + Supabase CLI 설치 + 내 GitHub 저장소 만들기 (gh)
2. Supabase 로그인 → 프로젝트 만들기
3. 키 조회 → .env.local 작성 → DB 테이블 생성 (db push)
4. 첫 관리자 계정 만들기 (setup:admin)   ← 회원가입 화면이 없으므로 이 단계로 로그인 계정을 만듭니다
   + 더미 데이터 넣기 (seed:demo)         ← 가상 가족의 데이터로 화면이 채워진 채 시작
5. 실행 (npm run dev) → http://localhost:3000 로그인
6. (선택) Vercel 로 인터넷에 배포
7. (선택) 폰 문자 자동수집 켜기
```

> 💡 **왜 CLI 를 쓸까요?** GitHub·Supabase·Vercel 은 전부 CLI(명령줄 도구)를 제공합니다.
> CLI 를 쓰면 저장소 생성 → DB 프로젝트 생성·연결 → 배포까지 전 과정을
> **브라우저 대시보드 없이 명령으로** 끝낼 수 있고, Claude Code 가 이 명령들을 대신 실행해 줍니다.

### 낱말 풀이

| 낱말 | 뜻 |
|------|----|
| CLI | 글자로 명령을 쳐서 쓰는 도구. 터미널(PowerShell, cmd, 맥의 터미널)에서 실행합니다. |
| 리모트(remote) | 내 컴퓨터의 코드와 연결된 인터넷 저장소. `origin`, `template` 은 그 저장소에 붙인 이름입니다. |
| project ref | Supabase 가 프로젝트마다 붙이는 고유한 영문·숫자 이름. 주소 `https://<ref>.supabase.co` 에 들어갑니다. |
| anon 키 / service_role 키 | Supabase 에 접속할 때 쓰는 열쇠 두 개. anon 은 화면용, service_role 은 관리용이라 **남에게 보이면 안 됩니다.** |
| RLS | 로그인한 사람이 자기 데이터만 보게 막는 DB 규칙(Row Level Security). |
| 비대화형 | 중간에 묻고 답하는 과정 없이 한 번에 끝나는 명령 실행 방식. 브라우저 로그인처럼 사람이 눌러야 하는 명령은 여기에 맞지 않습니다. |
| 크론(cron) | 정해진 시각마다 자동으로 실행되는 작업. |

---

## ✨ 가장 쉬운 방법 — Claude Code 에게 맡기기

위 단계를 직접 안 하고 싶으면, **Claude Code 가 처음부터 끝까지 대신** 해 줍니다.

- **아직 URL밖에 없다면:** 빈 폴더를 하나 만들어 Claude Code 로 열고 이렇게 말하세요. 클론부터 알아서 합니다.
  > **"https://github.com/kinghama-ledger/home-ledger-example.git 설치해줘"**
- **이미 이 폴더를 클론했다면:** 폴더를 Claude Code 로 열고
  > **"설치해줘"** (또는 `초기 설정 도와줘`, `/setup`)

그러면 Claude 가 OS(Windows/맥)를 확인해 필요한 프로그램을 깔고, 클론·설치·DB 생성·관리자 계정·더미 데이터까지
**한 단계씩 같이** 진행한 뒤, 마지막에 **로그인 ID 와 비밀번호**를 알려 줍니다.
(git·Node 설치 시 승인 팝업/마법사는 클릭 한두 번만 직접 해 주면 됩니다.)

> 막히면 언제든 **Claude Code 에게 에러 메시지를 그대로 붙여넣고** 물어보세요.
> 예: "SETUP.md 3단계 `npx supabase db push` 에서 에러가 났어. 같이 봐줘."

아래는 **직접(수동) 설치**하는 분을 위한 단계별 안내입니다.

---

## 0. 필요한 프로그램 (4가지)

| 필요한 것 | Windows | macOS |
|-----------|---------|-------|
| **git** (코드 받기) | `winget install --id Git.Git -e` | `git --version` 실행 → 설치창 뜨면 진행 (또는 `xcode-select --install`) |
| **Node.js 20.9+** (빌드·실행) | `winget install --id OpenJS.NodeJS.LTS -e` | `brew install node` / 없으면 [nodejs.org](https://nodejs.org) LTS |
| **GitHub CLI** (내 저장소 만들기) | `winget install --id GitHub.cli -e` | `brew install gh` |
| **Vercel CLI** (인터넷 배포) | `npm install -g vercel` | `npm install -g vercel` |

- 잘 깔렸는지 확인: `git --version`, `node -v`(v20.9 이상), `gh --version`, `vercel --version` 이 모두 버전을 출력하면 OK.
- **Supabase CLI** 는 여기서 설치하지 않습니다. 1단계에서 코드를 받은 뒤 프로젝트 폴더 안에 설치합니다.
- `winget` 이 없으면(구형 Windows) [nodejs.org](https://nodejs.org)·[git-scm.com](https://git-scm.com) 에서 설치파일로 받으세요.
- Vercel CLI 는 **Node 를 먼저 깐 뒤** 설치됩니다(`npm` 이 필요).
- 계정 3개(모두 무료)가 필요합니다: **GitHub**(github.com) · **Supabase**(supabase.com) · **Vercel**(vercel.com, GitHub 계정으로 가입 가능).
  각 로그인은 필요한 단계에서 CLI 가 브라우저를 열어 처리합니다.
- 최소한으로 가려면 git·Node 2개만으로도 **로컬 실행까지는** 됩니다.
  GitHub CLI 는 내 저장소 백업(1단계), Vercel CLI 는 배포(6단계)에 쓰입니다.

> 💡 git·Node 설치는 승인 팝업(Windows UAC)이나 설치 마법사가 떠서 **클릭 한두 번은 직접** 해야 합니다.
> 설치한 직후에는 **터미널 창을 새로 열어야** 방금 깐 명령이 잡힙니다.

---

## 1. 코드 받기 & 내 저장소 만들기

먼저 **프로젝트로 쓸 빈 폴더를** 만들고 그 안에서 클론합니다. 끝의 **점(`.`)** 이 "지금 폴더에 바로 받아라"는 뜻입니다.

```bash
mkdir my-ledger        # 폴더 이름은 영문 소문자·숫자·하이픈으로 (나중에 저장소·배포 이름으로 다시 씁니다)
cd my-ledger
git clone https://github.com/kinghama-ledger/home-ledger-example.git .
npm install
```

> - 이후 모든 명령은 **이 폴더 안에서** 실행합니다.
> - 점을 빠뜨리면 `home-ledger-example/` 라는 폴더가 한 겹 더 생겨 사람마다 경로가 달라지고, 다음 단계의 저장소 이름이
>   원본과 같아져 헷갈립니다. 이미 그렇게 됐다면 `cd home-ledger-example` 로 들어가서 계속하면 됩니다.
> - ZIP 파일로 내려받지 말고 `git clone` 으로 받으세요. 1-2 의 내 저장소 만들기와 원본 업데이트 받기가 git 저장소를 전제로 합니다.
>   (ZIP 으로 받은 폴더에서 `npm install` 을 하면 `fatal: not in a git directory` 라는 줄이 보이지만 설치는 계속됩니다.)

### 1-1. Supabase CLI 설치 (처음 한 번)

Supabase CLI 는 전역으로 깔지 않고 **이 프로젝트 안에** 설치합니다. 처음 한 번만 실행합니다.

```bash
npm install supabase --save-dev
npx supabase --version      # 버전이 나오면 OK
```

> - 이후 Supabase 명령은 모두 앞에 `npx` 를 붙여 `npx supabase …` 로 실행합니다.
> - 이 명령을 실행하면 `package.json` 과 `package-lock.json` 이 바뀝니다. 정상입니다.
> - `npx supabase` 가 실행되지 않으면 프로젝트 폴더 안인지 확인하고 `npm install supabase --save-dev` 를 다시 실행하세요.

### 1-2. 내 GitHub 저장소 만들기 (권장)

이어서 **내 GitHub 저장소(비공개)로 연결**합니다. 앞으로 고친 내용을 커밋·백업하고, Vercel 연동에도 쓰는 내 소유 저장소입니다.

```bash
# 1) GitHub 로그인 (처음 한 번, 브라우저가 열립니다 — 일반 터미널에서 실행)
gh auth login

# 2) 원본 샘플 리모트는 'template' 라는 이름으로 남겨두고
git remote rename origin template

# 3) 내 계정에 비공개 저장소를 만들고 코드를 올립니다 (origin = 내 저장소)
gh repo create my-ledger --private --source=. --push
```

> - 이후 커밋은 `git push` 만 하면 **내 저장소**로 올라갑니다.
> - 원본 샘플이 업데이트되면 `git pull template main` 으로 받아올 수 있습니다.
> - 급하면 이 부분(내 저장소 만들기)은 건너뛰고 나중에 해도 됩니다 —
>   Claude Code 에게 **"내 GitHub 저장소 만들어줘"** 라고 하면 위 절차를 대신 해 줍니다.

---

## 2. Supabase 로그인 & 프로젝트 만들기 (CLI 로 한 번에)

대시보드에서 키를 손으로 복사할 필요 없이, **CLI 로 로그인 → 프로젝트 생성 → 키 조회**까지 끝냅니다.

> ⚠️ `npx supabase login` 은 **일반 터미널(또는 cmd)에서 직접** 실행하세요. 그래야 브라우저가 열립니다.
> Claude Code 안에서 `!` 로 실행하면 비대화형이라 브라우저 대신 **"토큰을 입력하라"** 고 나와서 막힙니다.

```bash
# 1) 로그인 (일반 터미널에서 실행 → 브라우저가 열려 인증합니다)
npx supabase login

# 2) 내 조직 ID 확인 (ID 열의 값을 복사)
npx supabase orgs list

# 3) 새 프로젝트 생성 — 비밀번호는 직접 정하고 꼭 메모하세요. 한국이면 리전은 ap-northeast-2(서울) 권장
#    (한 줄로 입력하세요 — Windows/맥 동일)
npx supabase projects create "home-ledger-example" --org-id <조직-ID> --db-password <원하는-DB비밀번호> --region ap-northeast-2

# 4) 생성된 project ref 확인 (REFERENCE ID 열의 값을 복사)
npx supabase projects list
```

> 새 프로젝트는 준비에 **1~2분** 걸립니다. (이미 쓰던 빈 프로젝트가 있으면 3번을 건너뛰고 4번에서 ref 만 골라도 됩니다.)

> 💰 **무료 플랜 안내:** Supabase 무료 플랜은 **내가 소유자 또는 관리자인 모든 조직을 합쳐 활성 프로젝트 2개까지**입니다.
> 한도에 걸리면 안 쓰는 프로젝트를 일시정지(pause)하거나 삭제한 뒤 다시 만드세요.

---

## 3. 키 조회 & DB 만들기

```bash
# 1) 환경변수 파일 만들기   (Windows cmd 라면 'copy .env.example .env.local')
cp .env.example .env.local

# 2) anon / service_role 키 조회 (대시보드 복사 불필요)
npx supabase projects api-keys --project-ref <내-project-ref>
```

`.env.local` 을 열어 위에서 받은 값으로 아래를 채웁니다 (URL 은 `https://<ref>.supabase.co`):

```
NEXT_PUBLIC_SUPABASE_URL=https://<내-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon 키>
SUPABASE_SERVICE_ROLE_KEY=<service_role 키>     # 🔒 비밀값 — 외부 공유 금지
SUPABASE_DB_PASSWORD=<2단계에서 정한 DB 비밀번호>   # 🔒 재연결용 기록(앱은 사용 안 함)
NEXT_PUBLIC_AUTH_EMAIL_DOMAIN=example.com         # 기본값 그대로 두면 됩니다
```

이어서 DB(테이블·정책)를 생성합니다:

```bash
# 내 프로젝트와 연결 (2단계에서 정한 DB 비밀번호 입력)
npx supabase link --project-ref <내-project-ref>

# 테이블/정책 생성 — 'Do you want to push...' 물으면 Y 입력
npx supabase db push
```

> ✅ 성공하면 Supabase 대시보드의 **Table Editor** 에 표가 여러 개 생깁니다.
> 가계부가 쓰는 표는 이름이 `hh_` 로 시작하는 것(`hh_transaction`, `hh_account`, `hh_loan`, `hh_installment`, `hh_transaction_inbox` 등)과
> `employees`(로그인 계정), `app_logs`(사용 기록)입니다.
> 그 밖의 표(고객·계약·견적 같은 이름)는 바탕이 된 템플릿에서 함께 만들어진 것으로, 비어 있고 가계부는 쓰지 않습니다.

---

## 4. 첫 관리자 계정 만들기 ⭐ (로그인하려면 꼭 필요)

> **우리 집 가계부에는 회원가입 화면이 없습니다.** 개인 가계부이므로 아래 명령으로 만드는
> **관리자 계정 1개**로 로그인해 사용합니다.

```bash
npm run setup:admin
```

실행하면 **외우기 쉬운 기본 계정**이 만들어집니다:

```
========================================
  🔑 관리자 계정 준비 완료!
  👤 로그인 ID : admin
  🔒 비밀번호  : jadong!
========================================
```

| 로그인 ID | 비밀번호 |
|-----------|----------|
| **admin** | **jadong!** |

> 다른 값으로 만들고 싶으면 `npm run setup:admin -- 원하는ID 원하는비밀번호` (비밀번호는 **6자 이상**).
> 같은 명령을 다시 실행하면 비밀번호가 재설정됩니다.

### 4-2. 더미 데이터 넣기 (권장)

빈 가계부는 화면이 텅 비어 있어 무엇을 하는 앱인지 알기 어렵습니다. 아래 한 줄로 **가상 가족의 데이터**를 넣으세요.

```bash
npm run seed:demo
```

들어가는 것(약):

- 인물 3명
- 계좌 4개 — 은행 3 + 지역화폐 예시 지갑 1(`한빛페이(김하늘)`)
- 결제수단 5개 — 현금 1 + 카드 3 + 지갑 1
- 대출 3건 · 정기지출·수입 13건 · 할부 2건
- 넉 달 치 거래 약 200건 — 지난 3개월과 이번 달 오늘까지

거래 건수는 실행한 날짜에 따라 달라집니다. 정확한 건수는 시드가 끝날 때 출력하는 표(`신규 N건`)를 보세요.
전부 가공의 **「김하늘 · 이바다 가족」** 데이터입니다. 실제 사람·계좌·거래와 관계가 없으니 마음껏 고치고 지워도 됩니다.

> 연습이 끝나고 **내 데이터로 새로 시작**하고 싶으면 더미 데이터만 지웁니다:
> ```bash
> node scripts/seed-demo.mjs --reset
> ```
> (관리자 계정과 테이블은 그대로 남습니다.)

---

## 5. 실행 & 로그인

```bash
npm run dev
```

서버가 켜질 때 터미널에 **기본 로그인(`admin` / `jadong!`)** 이 배너로 강조 표시됩니다.
브라우저에서 **http://localhost:3000** 접속 → 로그인 화면에서:

- **로그인 ID**: `admin`  ← 이메일이 아니라 **ID** 를 그대로 입력합니다
- **비밀번호**: `jadong!`

🎉 로그인 성공! 이제 우리 집 가계부가 내 컴퓨터에서 돌아갑니다.
(서버를 끄려면 터미널에서 `Ctrl + C`, 다시 켜려면 `npm run dev`)

> 🔐 **로그인했으면 비밀번호부터 바꾸세요.** 왼쪽 사이드바 **맨 아래의 '내 이름'을 클릭** →
> **마이페이지**에서 비밀번호를 변경할 수 있습니다. 기본값 `jadong!` 은 누구나 아는 값이라, 인터넷에 배포하기 전에는 반드시 바꿔야 합니다.

### 처음 둘러보기 (더미 데이터를 넣었다면)

1. **현금흐름** — 이번 달·다음 달에 통장에서 빠져나갈 돈이 날짜순으로 보입니다. 이 앱의 핵심 화면입니다.
2. **거래관리** — 수입·지출·통장이동 탭. 행을 클릭하면 팝업에서 수정, 상단 버튼으로 등록.
   여러 건을 한 번에 넣을 땐 팝업 아래 '여러 건 입력 (엑셀)' 링크로 붙여넣기.
3. **대출관리 · 통장내역 · 통계** — 등록한 데이터가 자동으로 집계됩니다.
4. **설정** — 계좌·지출항목 분류·인물·정기지출·예산을 여기서 관리합니다.
5. **수집함** — 상단 '토스 이자' 버튼은 이름에 '토스뱅크'가 든 계좌가 있을 때 쓰는 예시 기능입니다. 더미 데이터에는 그 계좌가 없어 "토스뱅크 계좌를 찾지 못했습니다"라고 나오는 것이 정상입니다(README 참고).
6. **후불교통 예시 규칙** — 은행 출금 문자의 '우리카드결제대금'은 후불교통 요금으로 보고 지출로 분류합니다. 그 카드를 일반 신용카드로 쓴다면 README 의 안내대로 규칙을 빼세요.

---

## ✅ 설치 완료 체크리스트

- [ ] `git --version` / `node -v`(20.9+) / `gh --version` / `vercel --version` 이 모두 나온다
- [ ] `npm install` 이 에러 없이 끝났다
- [ ] `npm install supabase --save-dev` 뒤에 `npx supabase --version` 이 버전을 출력한다
- [ ] (권장) `gh repo create ... --source=. --push` 로 내 GitHub 저장소가 만들어졌다
- [ ] `npx supabase db push` 가 에러 없이 끝났고, Table Editor 에 테이블이 보인다
- [ ] `npm run setup:admin` 으로 기본 계정(**admin / jadong!**)이 생성됐다
- [ ] (권장) `npm run seed:demo` 로 더미 데이터가 들어갔다
- [ ] `npm run dev` 후 http://localhost:3000 에서 **admin / jadong!** 로 로그인된다
- [ ] 로그인 후 사이드바 하단 '내 이름' → 마이페이지에서 **비밀번호를 변경했다**

---

## 6. (선택) Vercel 로 인터넷에 배포하기

로컬(`npm run dev`)로만 써도 충분하지만, 배포하면 **어디서나(휴대폰 포함) 접속**할 수 있습니다.
7단계의 문자 자동수집을 쓰려면 폰이 접속할 주소가 필요하므로 **배포가 먼저**입니다.
Claude Code 에게 **"배포해줘"** 라고 하면 아래 절차를 대신 진행해 줍니다. 직접 하려면:

```bash
# 1) 로그인 (처음 한 번, 브라우저가 열립니다 — 일반 터미널에서 실행)
vercel login

# 2) 프로젝트 생성·연결 (첫 실행 시 자동 생성)
#    ⚠️ 폴더 이름이 한글이거나 대문자·공백이 있으면 실패합니다 → --project 로 영문 이름을 지정
vercel link --yes --project my-ledger

# 3) 환경변수 등록 — .env.local 의 4개 값을 그대로 넣습니다 (각 명령 실행 후 값 붙여넣기)
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add NEXT_PUBLIC_AUTH_EMAIL_DOMAIN production

# 4) 배포
vercel --prod
```

끝나면 `https://<프로젝트명>.vercel.app` 주소가 나옵니다. 알아두세요:

- 🔐 **배포하면 그 주소를 아는 누구나 로그인 화면까지는 접근할 수 있습니다.**
  기본 비밀번호(`jadong!`)를 쓰고 있다면 **배포 전에 반드시 변경**하세요(마이페이지).
- **DB 는 그대로 Supabase** 를 쓰므로 로컬과 배포본이 **같은 데이터**를 봅니다.
- 코드를 고친 뒤에는 `vercel --prod` 만 다시 실행하면 재배포됩니다.
- **크론(자동 실행)**: `vercel.json` 에 **매일 1회** 도는 크론이 하나 들어 있습니다
  (`/api/household/inbox/purge-raw` — 수집함에 들어온 문자 원문을 30일 뒤 지워 개인정보를 남기지 않는 정리 작업).
  무료(Hobby) 플랜에서 동작합니다. **문자수집을 켤 때는 `CRON_SECRET` 환경변수 등록이 필수입니다.** 이 값이 없으면 30일이 지난 문자 원문 정리가 실행되지 않습니다:
  ```bash
  vercel env add CRON_SECRET production     # 아무 긴 임의 문자열
  ```
  무료 플랜은 크론을 **하루 1회까지만** 허용하니
  더 자주 도는 식을 추가하면 배포가 실패합니다.

---

## 7. (선택) 폰 문자 자동수집 켜기

**기본 샘플은 이 단계 없이도 완전히 동작합니다.** 수입·지출·통장이동은 화면에서 직접 입력하거나
엑셀 붙여넣기로 일괄 등록하면 됩니다. 이 단계는 "카드 결제 문자가 올 때마다 폰이 알아서 가계부에 넣어 주는"
자동화를 원할 때만 보세요. 직접 입력만으로도 가계부는 동작하며, 문자 자동수집은 **선택 기능**입니다.

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
| **배포된 주소** | 폰이 인터넷으로 접속해야 하므로 6단계의 Vercel 배포가 먼저 필요합니다. (`localhost` 는 폰에서 안 보입니다.) |
| **문자수집 토큰** | 앱에 로그인 → **[설정] ▸ 문자수집** 탭 → **토큰 발급**. 발급 화면에서 **딱 한 번만** 보이니 바로 복사하세요. (서버에는 해시만 저장됩니다.) |
| **`CRON_SECRET`** | 6단계에서 Vercel 환경변수로 등록합니다. 문자 원문을 30일 뒤 지우는 작업에 필요합니다. |

- 토큰은 폰이 보내는 요청의 **헤더 `X-Ingest-Token`** 에 넣습니다. 환경변수(`.env.local`)에 넣는 값이 아닙니다.
- 토큰이 새면 남이 내 수집함에 문자를 넣을 수 있으니, 의심되면 설정 화면에서 삭제하고 다시 발급하세요.

### 절차 (요약)

1. 6단계대로 배포하고 배포 주소를 확인합니다.
2. 배포본에 로그인 → **[설정] ▸ 문자수집** 에서 토큰을 발급해 복사합니다.
   같은 화면의 '결제문자 자동수집 설정 방법'을 펼치면 폰 앱에 넣을 **URL · 헤더 · 본문 예시**가 나옵니다.
3. 폰에서 MacroDroid 매크로를 만듭니다 — 발동(트리거)은 "메시지를 받으면", 동작(액션)은 "HTTP 요청"(요청 종류 POST).
   단계별 안내: **[docs/household/MACRODROID_GALAXY.md](./docs/household/MACRODROID_GALAXY.md)** (화면 그림은 책 부록 D 에 있습니다)
4. 테스트 문자를 한 통 받아 **수집함**에 들어오는지 확인합니다.

- 요청 형식(JSON/form/plain)·응답 코드·문제 해결 전체: **[docs/household/SMS_FORWARDING.md](./docs/household/SMS_FORWARDING.md)**
- 예전 경로 `/api/household/sms` 도 같은 동작을 합니다(권장은 `/api/household/inbox/sms`).

> ⚠️ 이 기능은 **내 폰의 실제 결제 문자**를 다룹니다. 더미 데이터 연습과 달리 진짜 개인 금융정보가 서버에 들어가므로,
> 켜기 전에 반드시 기본 비밀번호를 바꾸고, 배포 주소와 토큰을 남과 공유하지 마세요.

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
| `npm run test:table-render` | 화면만 엶(사용 기록이 남음) | dev 서버, `E2E_LOGIN_PASSWORD` |

- `scripts/` 폴더에는 `npm` 명령으로 등록되지 않은 시험 파일(`test_*.mjs` 등)이 더 있고, 그 가운데에도 DB 에 쓰고 지우는 것이 있습니다. 같은 주의가 적용됩니다.
- `E2E_LOGIN_PASSWORD` 가 없으면 로그인하는 시험은 `로그인 실패: Invalid login credentials` 로 멈춥니다. 값은 `.env.local` 에 적습니다(`.env.example` 참고).

---

## 자주 막히는 곳

- **`npx supabase` 가 실행되지 않음** → 프로젝트 폴더 안인지 확인하고 `npm install supabase --save-dev` 를 다시 실행하세요.
- **`npx supabase login` 이 브라우저 대신 토큰을 입력하라고 함** → Claude Code 안이 아니라 **새 터미널 창**에서 직접 실행하세요.
- **`npx supabase db push` 에서 권한/연결 오류** → `npx supabase login` 과
  `npx supabase link --project-ref ...` 를 다시 확인하세요. 새 프로젝트면 준비(1~2분)를 기다린 뒤 재시도.
- **`npx supabase projects create` 가 프로젝트 수 제한으로 실패** → 무료 플랜은 내가 소유자·관리자인 조직을 합쳐 활성 프로젝트 2개입니다.
  안 쓰는 프로젝트를 일시정지/삭제하거나, 다른 조직을 만들어 거기에 생성하세요.
- **로그인이 안 됨** → 1) 이메일이 아니라 **ID `admin` / 비밀번호 `jadong!`** 로 시도했는지 확인,
  2) `npm run setup:admin` 을 다시 실행해 기본 계정을 재생성(비밀번호 재설정)한 뒤 다시 시도.
- **비밀번호가 너무 짧다는 오류** → 비밀번호는 **6자 이상**이어야 합니다.
- **`npm run build`/실행 실패** → `.env.local` 에 Supabase 값(URL/anon/service_role)이 채워졌는지 확인.
- **`npm run seed:demo` 가 실패** → 4단계의 `setup:admin` 을 먼저 실행했는지, `.env.local` 의 `SUPABASE_SERVICE_ROLE_KEY` 가 채워졌는지 확인.
- **수집함이 비어 있음** → 문자수집(7단계)을 안 켰다면 정상입니다. 거래관리에서 직접 입력하세요.

무엇이든 막히면 **Claude Code 에게 에러 메시지를 그대로 붙여넣고 물어보세요.**
