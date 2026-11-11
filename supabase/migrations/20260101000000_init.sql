-- 맨 처음 한 번 도는 마이그레이션.
-- 뒤따르는 가계부 마이그레이션이 기대하는 것 두 가지만 만든다.
--   (1) 수정 시각을 채워 주는 트리거 함수  public.update_updated_at()
--   (2) 앱이 남기는 기록 표              public.app_logs
-- 함수 이름과 표의 열 이름은 가계부 코드·마이그레이션이 그대로 부르는 약속이라 바꾸지 않는다.

-- (1) 행이 고쳐질 때 updated_at 을 지금 시각으로.
create or replace function public.update_updated_at()
    returns trigger
    language plpgsql
    set search_path = ''
as $body$
begin
    new.updated_at := current_timestamp;
    return new;
end;
$body$;

-- (2) 기록 표. 서버(서비스 키)만 읽고 쓴다.
create table public.app_logs (
    id          uuid        primary key default gen_random_uuid(),
    created_at  timestamptz default current_timestamp,
    level       text        not null default 'INFO' check (level in ('INFO', 'ERROR')),
    action      text        not null,
    message     text        not null,
    actor_id    text,
    actor_name  text,
    ip_address  text,
    resource    text,
    resource_id text,
    details     jsonb
);

-- 로그인 시도 제한이 "어떤 기록이 최근에 몇 건인가" 를 세므로 그 두 열로 찾는다.
create index app_logs_action_created_at_idx on public.app_logs (action, created_at);

-- 정책 없이 행 수준 보안만 켠다 = 브라우저 키(anon·authenticated)로는 한 줄도 못 본다.
alter table public.app_logs enable row level security;
revoke all on table public.app_logs from anon, authenticated;

-- 서비스 키 권한은 적어서 준다. Supabase 의 기본 권한 설정이 붙지 않는 환경에서는
-- 이 줄이 없으면 기록과 로그인 시도 제한이 오류 없이 조용히 꺼진다.
GRANT ALL ON TABLE public.app_logs TO service_role;
