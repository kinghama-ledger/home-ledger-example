-- 표·뷰·함수의 접근 권한을 이 파일에서 명시한다.
--
-- 왜 필요한가
--   예전 Supabase 프로젝트는 public 스키마에 표를 만들면 API 역할(anon·authenticated·service_role)에
--   모든 권한이 저절로 붙었다. 2026년부터 새로 만드는 프로젝트는 이 자동 부여가 꺼져 있을 수 있다
--   (프로젝트 설정의 "새 표와 함수를 자동으로 노출"). 꺼진 프로젝트에서는 앞의 마이그레이션이 만든
--   가계부 표에 아무 권한이 없어, 로그인해도 "permission denied for table hh_..." 로 화면이 비고
--   `npm run seed:demo` 도 실패한다.
--
-- 무엇을 하는가
--   프로젝트가 어느 쪽 설정이든 결과가 같아지도록, 먼저 걷어 내고 필요한 만큼만 다시 준다.
--     · 로그인하지 않은 요청(anon)  : 가계부 표·뷰에 권한 없음
--     · 로그인한 사용자(authenticated): 읽기·넣기·고치기·지우기. 실제로 닿는 행은 RLS 정책이 정한다
--     · 서버 작업(service_role)       : 전부 (문자수집·가상 자료·계정 만들기)
--   TRUNCATE 는 RLS 가 막지 못하므로 로그인한 사용자에게 주지 않는다.
--
-- 여러 번 실행해도 결과가 같다. 이미 설치한 DB 에 다시 올려도 자료는 바뀌지 않는다.

-- ── 가계부 표 ────────────────────────────────────────────────
do $$
declare
  t text;
  tables constant text[] := array[
    'hh_account', 'hh_budget', 'hh_cashflow_override', 'hh_category', 'hh_import_log',
    'hh_ingest_token', 'hh_installment', 'hh_loan', 'hh_merchant_map', 'hh_payment_entry',
    'hh_payment_method', 'hh_payment_month_close', 'hh_person', 'hh_scheduled_payment',
    'hh_transaction', 'hh_transaction_inbox'
  ];
begin
  foreach t in array tables loop
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end $$;

-- 개선 게시판은 지우기를 막아 둔 표다(20260909000000). 그 결정을 그대로 둔다.
revoke all on table public.hh_improvement from anon, authenticated;
grant select, insert, update on table public.hh_improvement to authenticated;
grant all on table public.hh_improvement to service_role;

-- ── 집계 뷰 (읽기 전용, security_invoker 라 밑의 표 정책을 그대로 따른다) ──
do $$
declare
  v text;
  views constant text[] := array['hh_account_balance', 'hh_loan_balance', 'hh_monthly_summary'];
begin
  foreach v in array views loop
    execute format('revoke all on table public.%I from anon, authenticated, service_role', v);
    execute format('grant select on table public.%I to authenticated', v);
    execute format('grant select on table public.%I to service_role', v);
  end loop;
end $$;

-- ── 기록 표: 서버만 (20260809000000 의 결정을 다시 확인) ────────
revoke all on table public.app_logs from anon, authenticated;
grant all on table public.app_logs to service_role;

-- ── 함수 ─────────────────────────────────────────────────────
-- 화면이 부르는 것: 로그인한 사용자만.
revoke execute on function public.hh_create_payments(jsonb, text) from public, anon;
revoke execute on function public.hh_confirm_inbox(uuid) from public, anon;
revoke execute on function public.hh_revert_inbox(uuid) from public, anon;
grant execute on function public.hh_create_payments(jsonb, text) to authenticated, service_role;
grant execute on function public.hh_confirm_inbox(uuid) to authenticated, service_role;
grant execute on function public.hh_revert_inbox(uuid) to authenticated, service_role;

-- 문자수집 서버만 부르는 것 (20260903000000 의 결정을 다시 확인).
revoke execute on function public.hh_sweep_demote_losers(uuid, uuid, uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.hh_sweep_demote_losers(uuid, uuid, uuid, uuid[]) to service_role;

-- 트리거 함수(update_updated_at, hh_block_closed_month)는 표를 고치는 쪽의 권한으로 불리므로
-- 표에 쓸 수 있는 두 역할에 실행 권한을 준다.
grant execute on function public.update_updated_at() to authenticated, service_role;
grant execute on function public.hh_block_closed_month() to authenticated, service_role;
