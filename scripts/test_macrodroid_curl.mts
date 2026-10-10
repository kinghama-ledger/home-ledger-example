// 'MacroDroid 용 한 번에 복사'가 만드는 한 줄 회귀 테스트.
// 기대값은 MacroDroid 6.0 실제 폰의 'cURL 명령어 가져오기'에 붙여 넣어 요청 종류·주소·본문·헤더가 채워지는 것을 확인한 꼴이다.
const { macroDroidCurl, MACRODROID_SMS_BODY } = await import("../src/lib/household/macrodroid-curl");

let pass = 0;
let fail = 0;
function check(label: string, ok: boolean, detail = "") {
  if (ok) {
    pass += 1;
    console.log(`  OK ${label}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
  }
}

const url = "https://your-app.vercel.app/api/household/inbox/sms";
const token = "example-token-xxxxxxxxxxxxxxxx";
const line = macroDroidCurl(url, token);

check(
  "폰에서 확인한 꼴과 글자까지 같다",
  line === "curl -X POST 'https://your-app.vercel.app/api/household/inbox/sms' -H 'Content-Type: text/plain' -H 'X-Ingest-Token: example-token-xxxxxxxxxxxxxxxx' -d '[sms_message]'",
  line,
);
check("한 줄이다", !line.includes("\n"));
check("요청 종류는 POST", line.startsWith("curl -X POST '"));
check("주소가 그대로 들어간다", line.includes(`'${url}'`));
check("토큰은 X-Ingest-Token 헤더에", line.includes(`-H 'X-Ingest-Token: ${token}'`));
check("본문은 문자 내용 표시", line.endsWith(`-d '${MACRODROID_SMS_BODY}'`) && MACRODROID_SMS_BODY === "[sms_message]");

let threw = false;
try {
  macroDroidCurl(url, "to'ken");
} catch {
  threw = true;
}
check("작은따옴표가 든 값은 거절한다", threw);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
