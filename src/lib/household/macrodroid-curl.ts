// MacroDroid 의 HTTP 요청 화면 'cURL 명령어 가져오기'에 붙여 넣는 한 줄. (설정 > 문자수집의 '한 번에 복사')
// 붙여 넣으면 요청 종류(POST)·주소·본문·헤더 두 개가 한 번에 채워진다 — MacroDroid 6.0 실제 폰에서 확인한 꼴이다.
// 꼴을 바꾸면 가져오기가 조용히 어긋날 수 있으니 scripts/test_macrodroid_curl.mts 가 글자까지 고정한다.

/** 문자 내용을 뜻하는 MacroDroid 의 표시. 보낼 때 받은 문자 원문으로 바뀐다. */
export const MACRODROID_SMS_BODY = "[sms_message]";

export function macroDroidCurl(ingestUrl: string, token: string): string {
  // 작은따옴표로 감싸므로 값에 작은따옴표가 있으면 한 줄이 깨진다. 주소(origin + 고정 경로)와 16진수 토큰에는 들어올 수 없다.
  if (ingestUrl.includes("'") || token.includes("'")) throw new Error("주소·토큰에 작은따옴표가 있어 한 줄로 만들 수 없습니다.");
  return `curl -X POST '${ingestUrl}' -H 'Content-Type: text/plain' -H 'X-Ingest-Token: ${token}' -d '${MACRODROID_SMS_BODY}'`;
}
