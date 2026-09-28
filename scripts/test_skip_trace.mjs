// 미인식(trace-unknown) 문자를 휴지통에 흔적으로 남기는 동작 검증 (설계 docs/household/56).
// 미인식 문구 → 휴지통(ignored) 적재·원문 보존 / 명백한 광고 → DB 미적재 / 반복 → dedup / 정리.
// 실행: BASE_URL=http://localhost:3000 node --env-file=.env.local scripts/test_skip_trace.mjs
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE = process.env.BASE_URL || "http://localhost:3000";
// ★표식은 **실행마다 새로 만들고 영문자만** 쓴다.
//   SQL LIKE 에서 `_` 는 '아무 한 글자', `%` 는 '아무 글자들'이다 — 표식에 들어 있으면
//   `%표식%` 이 표식이 없는 남의 행까지 고른다. 숫자도 뺐다(문자 해석이 금액·날짜로 읽지 않게).
const RUN_TAG = Array.from(randomBytes(16), (b) => "qxzjvw"[b % 6]).join("");
const MARK = `SKIPTRACETEST${RUN_TAG}`;
if (!/^[A-Za-z0-9]+$/.test(MARK)) throw new Error("MARK 에는 영숫자만 쓸 수 있다(LIKE 와일드카드 방지)");

const admin = createClient(url, service, { auth: { persistSession: false } });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log(`  ✅ ${m}`); } else { fail++; console.log(`  ❌ ${m}`); } };

const { data: anyRow } = await admin.from("hh_category").select("owner_auth_uid").limit(1).single();
const owner = anyRow.owner_auth_uid;

const raw = `${MARK}_${Math.random().toString(16).slice(2)}`;
const tokenHash = createHash("sha256").update(raw).digest("hex");
const { data: tok, error: tErr } = await admin.from("hh_ingest_token").insert({ owner_auth_uid: owner, token_hash: tokenHash, label: MARK }).select("id").single();
if (tErr) { console.error("토큰 시드 실패:", tErr.message); process.exit(1); }

const insertedIds = [];
async function postSms(text, { token = raw } = {}) {
  const h = { "Content-Type": "text/plain; charset=utf-8" };
  if (token) h["X-Ingest-Token"] = token;
  const res = await fetch(`${BASE}/api/household/inbox/sms`, { method: "POST", headers: h, body: text });
  const json = await res.json().catch(() => ({}));
  if (json.id) insertedIds.push(json.id);
  return { status: res.status, json };
}
async function postNotif(body, { token = raw } = {}) {
  const h = { "Content-Type": "application/json" };
  if (token) h["X-Ingest-Token"] = token;
  const res = await fetch(`${BASE}/api/household/inbox`, { method: "POST", headers: h, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (json.id) insertedIds.push(json.id);
  return { status: res.status, json };
}

console.log(`엔드포인트=${BASE}\n`);

// 1) 미인식 SMS(거래 키워드 없음·광고 아님) → 휴지통(ignored)에 흔적으로 남김
const unknownText = `${MARK} 택배가 방금 도착했습니다. 문 앞을 확인하세요.`;
const r1 = await postSms(unknownText);
ok(r1.status === 201 && r1.json.traced === true, `미인식 SMS traced 201 (status=${r1.status}, traced=${r1.json.traced})`);
ok(!!r1.json.id, "★응답에 id 가 있다 — 없으면 휴지통 행이 안 만들어진 것이다(설계 199)");
if (r1.json.id) {
  const { data: row } = await admin.from("hh_transaction_inbox").select("*").eq("id", r1.json.id).single();
  ok(row?.status === "ignored", `status=ignored (got ${row?.status})`);
  ok(row?.guessed_kind === "unknown", `guessed_kind=unknown (got ${row?.guessed_kind})`);
  ok(row?.source === "sms", `source=sms (got ${row?.source})`);
  ok(row?.raw_text === unknownText, "raw_text 원문 보존");
  ok(typeof row?.dedup_hash === "string" && row.dedup_hash.startsWith("skip|"), `dedup_hash=skip|… (got ${row?.dedup_hash?.slice(0, 12)})`);
}

// 2) 같은 미인식 문구 반복 → dedup(중복 억제)
const r1dup = await postSms(unknownText);
ok(r1dup.json.duplicate === true, `미인식 반복 dedup 억제 (duplicate=${r1dup.json.duplicate})`);

// 3) 명백한 광고(광고 표기) → DB 미적재(흔적없이 skip)
const adText = `(광고) ${MARK} 시원한 커피가 공짜! 지금 확인하세요`;
const r2 = await postSms(adText);
ok(r2.status === 200 && r2.json.skipped === true && !r2.json.traced, `광고 skip 200·미적재 (status=${r2.status}, traced=${r2.json.traced})`);
const { count: adCount } = await admin.from("hh_transaction_inbox").select("*", { count: "exact", head: true }).eq("owner_auth_uid", owner).eq("raw_text", adText);
ok(adCount === 0, `광고는 DB에 흔적 없음 (${adCount}건)`);

// 4) 주식 시세(📈) → DB 미적재
const stockText = `${MARK} 📈 주식 가격이 5% 올랐어요 (29,518원)`;
const r3 = await postSms(stockText);
ok(r3.status === 200 && !r3.json.traced, `주식 시세 skip 200·미적재 (status=${r3.status})`);

// 5) 정상 거래 → 여전히 pending 적재(회귀 없음)
const okText = `[Web발신] 삼성카드 승인 9,212원 일시불 ${MARK} 2027.01.15 14:30 마커가맹점`;
const r4 = await postSms(okText);
ok(r4.status === 201 && r4.json.traced !== true, `정상 거래 pending 적재(traced 아님) (status=${r4.status})`);
ok(!!r4.json.id, "★응답에 id 가 있다 — 없으면 수집행이 안 만들어진 것이다(설계 199)");
if (r4.json.id) {
  const { data: row } = await admin.from("hh_transaction_inbox").select("status").eq("id", r4.json.id).single();
  ok(row?.status === "pending", `정상 거래 status=pending (got ${row?.status})`);
}

// 6) 알림(notification) 경로도 미인식 → 휴지통 + raw_meta 보존
const notifUnknown = { source: "macrodroid", app: "카카오톡", title: `${MARK} 알림`, text: "오늘 점심 뭐 먹지?", receivedAt: "2027-01-15T10:30:00+09:00" };
const r5 = await postNotif(notifUnknown);
ok(r5.status === 201 && r5.json.traced === true, `미인식 알림 traced 201 (status=${r5.status})`);
ok(!!r5.json.id, "★응답에 id 가 있다 — 없으면 휴지통 행이 안 만들어진 것이다(설계 199)");
if (r5.json.id) {
  const { data: row } = await admin.from("hh_transaction_inbox").select("*").eq("id", r5.json.id).single();
  ok(row?.status === "ignored" && row?.source === "notification", `알림 status=ignored·source=notification`);
  ok(row?.raw_meta?.app === "카카오톡", `알림 raw_meta.app 보존 (got ${row?.raw_meta?.app})`);
}

// 정리 — 지우는 것은 **id 로만** 한다(조건으로 한꺼번에 지우지 않는다).
const cleanupErrors = [];
// 응답에 id 가 없던 내 행이 있으면 이번 실행의 표식으로 찾아 목록에 더한다.
const { data: strays, error: strayErr } = await admin.from("hh_transaction_inbox").select("id").eq("owner_auth_uid", owner).like("raw_text", `%${MARK}%`);
if (strayErr) cleanupErrors.push(`남은 행 조회: ${strayErr.message}`);
for (const r of strays ?? []) if (!insertedIds.includes(r.id)) insertedIds.push(r.id);
// 지우기 직전 확인 — 원문에 이번 실행의 표식이 든 행만 지운다.
const { data: mine, error: mineErr } = insertedIds.length
  ? await admin.from("hh_transaction_inbox").select("id").eq("owner_auth_uid", owner).in("id", insertedIds).like("raw_text", `%${MARK}%`)
  : { data: [], error: null };
if (mineErr) cleanupErrors.push(`삭제 전 확인: ${mineErr.message}`);
const deletable = mineErr ? [] : (mine ?? []).map((r) => r.id);
const refused = insertedIds.filter((id) => !deletable.includes(id));
if (refused.length) cleanupErrors.push(`표식이 없어 지우지 않은 id ${refused.length}건: ${refused.join(", ")}`);
for (const id of deletable) {
  const { error } = await admin.from("hh_transaction_inbox").delete().eq("owner_auth_uid", owner).eq("id", id);
  if (error) cleanupErrors.push(`수집행 삭제(${id}): ${error.message}`);
}
const { error: tokDelErr } = await admin.from("hh_ingest_token").delete().eq("id", tok.id);
if (tokDelErr) cleanupErrors.push(`임시 토큰 삭제: ${tokDelErr.message}`);
for (const e of cleanupErrors) console.error(`  ⚠️ 정리 오류 — ${e}`);
ok(cleanupErrors.length === 0, `정리 중 오류 없음 (${cleanupErrors.length}건)`);
const { count: left, error: leftErr } = await admin.from("hh_transaction_inbox").select("*", { count: "exact", head: true }).eq("owner_auth_uid", owner).like("raw_text", `%${MARK}%`);
ok(!leftErr && left === 0, `잔여 테스트행 0건 (${leftErr ? `조회 실패: ${leftErr.message}` : left})`);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
