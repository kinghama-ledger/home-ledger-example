-- hh_transaction_inbox.dedup_hash 에 남던 문자·알림 원문 평문을 sha256 으로 바꾼다.
-- 코드(src/lib/household/sms.ts skipDedupKey·notificationDedupKey)가 새로 만드는 값과 바이트 단위로 같게 만든다.
--   skip|<원문 앞 80자>|YYYY-MM-DD        → skip|<sha256hex(앞 80자)>|YYYY-MM-DD
--   <title>|<text>|YYYY-MM-DD HH:MM (알림) → noti|<sha256hex(기존 값 전체)>
-- 접두(skip|)는 유지한다 — scripts/test_skip_trace.mjs 가 확인하고, trace| 접두 LIKE 조회(inbox/page.tsx)는 대상이 아니다.
--
-- 배포 순서: 코드 배포 → 이 마이그레이션. 그 사이 같은 문자·알림이 다시 들어오면 새 형식 행이 이미 있어
-- 옛 행을 변환하면 UNIQUE(owner_auth_uid, dedup_hash) 에 걸린다. 그런 옛 행은 멈추지 않고 dedup_hash 를
-- NULL 로 비운다(UNIQUE 는 NULL 을 여러 개 허용, 중복 차단은 새 형식 행이 맡는다, 평문도 없어진다).
-- 재실행 안전: 변환된 값은 아래 옛 형식 조건에 다시 걸리지 않는다.
--
-- Node.js UTF-8 SHA-256 교차검증 벡터(scripts/test_sms_parser.mts 와 같은 값):
-- select encode(extensions.digest(convert_to('synthetic skip head', 'UTF8'), 'sha256'), 'hex');
-- 기대: c770c51a060dcf5da1b246c82597486772b7c4fa2443aef2422b81a5bc0a31f1
-- select encode(extensions.digest(convert_to('합성 알림|본문_100%|2026-09-28 09:30', 'UTF8'), 'sha256'), 'hex');
-- 기대: 28e9a310e1e9990f5acf7e0ba23fc9e438eee1ec3f30bd13ede4ce1c6c360b08

create extension if not exists pgcrypto with schema extensions;

do $migration$
declare
  n_nulled bigint;
  n_converted bigint;
  n_noti_left bigint;
begin
  -- pgcrypto 가 extensions 가 아니라 public 에 깔린 옛 DB 도 있다. 어느 쪽이든 digest 를 찾도록 이 블록 동안만 경로를 넓힌다.
  perform set_config('search_path', 'public, extensions', true);

  -- 스냅샷~UPDATE 사이에 새 형식 행이 들어와 UNIQUE 에 걸리지 않게, 이 블록 동안 수집 INSERT 를 잠깐 기다리게 한다(읽기는 막지 않는다).
  lock table hh_transaction_inbox in share row exclusive mode;

  -- 옛 skip 형식: 가운데(앞 80자)가 이미 64자 hex 인 것은 변환된 값이다.
  create temp table _dedup_conv on commit drop as
  select id, owner_auth_uid,
         'skip|'
         || encode(digest(convert_to(substring(dedup_hash from 6 for length(dedup_hash) - 16), 'UTF8'), 'sha256'), 'hex')
         || '|' || right(dedup_hash, 10) as new_hash
  from hh_transaction_inbox
  where dedup_hash ~ '^skip\|.*\|[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    and dedup_hash !~ '^skip\|[0-9a-f]{64}\|[0-9]{4}-[0-9]{2}-[0-9]{2}$';

  -- 옛 알림 형식: source=notification 이고 title|text|minuteKey(YYYY-MM-DD HH:MM) 구조(구분자 2개 이상)인 것만.
  -- 이 구조가 아닌 notification 행(시험 잔여물·수동 보정 등)은 건드리지 않고 개수만 알린다.
  insert into _dedup_conv
  select id, owner_auth_uid,
         'noti|' || encode(digest(convert_to(dedup_hash, 'UTF8'), 'sha256'), 'hex')
  from hh_transaction_inbox
  where source = 'notification'
    and dedup_hash ~ '^.*\|.*\|[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}$'
    and dedup_hash !~ '^(skip|trace)\|';

  -- 새 형식 행이 이미 있는(배포 사이 구간 재수신) 옛 행은 비운다. 변환 대상끼리 같은 값이 되는 경우도 하나만 남긴다.
  update hh_transaction_inbox t set dedup_hash = null
  from _dedup_conv c
  where t.id = c.id
    and (
      exists (select 1 from hh_transaction_inbox o
              where o.owner_auth_uid = c.owner_auth_uid and o.dedup_hash = c.new_hash and o.id <> c.id)
      or exists (select 1 from _dedup_conv c2
                 where c2.owner_auth_uid = c.owner_auth_uid and c2.new_hash = c.new_hash and c2.id < c.id)
    );
  get diagnostics n_nulled = row_count;

  update hh_transaction_inbox t set dedup_hash = c.new_hash
  from _dedup_conv c
  where t.id = c.id and t.dedup_hash is not null;
  get diagnostics n_converted = row_count;

  select count(*) into n_noti_left from hh_transaction_inbox
  where source = 'notification' and dedup_hash is not null
    and dedup_hash !~ '^(skip|trace|noti)\|';

  raise notice 'dedup_hash migration: converted % rows, nulled % colliding old rows, % notification rows left untouched (non-standard format)',
    n_converted, n_nulled, n_noti_left;
end
$migration$;
