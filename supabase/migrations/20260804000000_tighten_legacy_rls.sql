-- 설계 146: 레거시 테이블의 무제한 RLS 정책 정리
--
-- [배경] 2026-08-04 보안 점검에서 실측:
--   · Supabase 공개 회원가입이 열려 있었다 (GET /auth/v1/settings → disable_signup: false)
--   · 레거시 CRM 테이블 정책이 USING (true) 또는 auth.role() = 'authenticated' 라
--     "로그인만 하면 전부 허용" 이었다.
--   · 두 개가 겹쳐, 외부인이 아무 이메일로 가입만 하면 employees 1행
--     (사용자 login_id·이름·auth_uid)을 읽고 수정·삭제까지 할 수 있었다.
--   · 가계부 데이터(hh_*)는 auth.uid() = owner_auth_uid 로 스코프돼 있어 영향 없었다.
--     (익명키 REST 조회 실측 → 전부 [] 반환)
--
-- [조치] public 스키마에서 위 조건에 해당하는 정책을 모두 제거한다.
--   · hh_* 가계부 테이블은 이미 소유자 스코프라 대상에서 제외한다.
--   · 정책이 하나도 남지 않은 테이블은 RLS 가 전부 차단하고, 서버의 service_role 만 접근한다.
--   · 대상 테이블 목록을 이 파일에 적어두지 않는다 — DB 의 실제 정책에서 조건으로 골라낸다.
--     (목록을 박아두면 원본이 바뀌었을 때 이 파일이 조용히 거짓말을 한다)
--
-- [기존 설치 DB] employees 표가 남아 있으면 본인 행 SELECT 정책만 유지한다.
--   새 설치 DB에는 이 표가 없으므로 정책 생성과 검증을 건너뛴다.
--
-- [되돌리기] 파일 하단 REVERT 주석 참조.

-- 1) 무제한 정책 제거
DO $$
DECLARE
    r       record;
    dropped int := 0;
BEGIN
    FOR r IN
        SELECT tablename, policyname
          FROM pg_policies
         WHERE schemaname = 'public'
           AND tablename NOT LIKE 'hh!_%' ESCAPE '!'
           AND (
                    btrim(coalesce(qual, ''))       IN ('true', '(true)')
                 OR btrim(coalesce(with_check, '')) IN ('true', '(true)')
                 OR coalesce(qual, '')       LIKE '%auth.role() = ''authenticated''%'
                 OR coalesce(with_check, '') LIKE '%auth.role() = ''authenticated''%'
               )
    LOOP
        EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
        dropped := dropped + 1;
        RAISE NOTICE '[설계146] DROP POLICY % ON %', r.policyname, r.tablename;
    END LOOP;
    RAISE NOTICE '[설계146] 제거한 무제한 정책: % 건', dropped;
END $$;

-- 2) employees — 기존 설치 DB에 표가 있을 때만 본인 행 조회를 허용
DO $$
BEGIN
    IF to_regclass('public.employees') IS NOT NULL THEN
        EXECUTE 'DROP POLICY IF EXISTS employees_self_select ON public.employees';
        EXECUTE 'CREATE POLICY employees_self_select ON public.employees
            FOR SELECT TO authenticated
            USING (auth.uid() = auth_uid)';
    END IF;
END $$;

-- 3) 검증 — 조건이 안 맞으면 예외를 던져 이 마이그레이션 전체를 롤백시킨다
DO $$
DECLARE
    leftover int;
    self_ok  int;
BEGIN
    SELECT count(*) INTO leftover
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename NOT LIKE 'hh!_%' ESCAPE '!'
       AND (
                btrim(coalesce(qual, ''))       IN ('true', '(true)')
             OR btrim(coalesce(with_check, '')) IN ('true', '(true)')
             OR coalesce(qual, '')       LIKE '%auth.role() = ''authenticated''%'
             OR coalesce(with_check, '') LIKE '%auth.role() = ''authenticated''%'
           );
    IF leftover > 0 THEN
        RAISE EXCEPTION '[설계146] 무제한 정책이 아직 % 건 남았다 — 롤백한다', leftover;
    END IF;

    IF to_regclass('public.employees') IS NOT NULL THEN
        SELECT count(*) INTO self_ok
          FROM pg_policies
         WHERE schemaname = 'public'
           AND tablename  = 'employees'
           AND policyname = 'employees_self_select';
        IF self_ok <> 1 THEN
            RAISE EXCEPTION '[설계146] employees 본인조회 정책이 없다 — 롤백한다';
        END IF;
    END IF;

    RAISE NOTICE '[설계146] 검증 통과 — 무제한 정책 0건, employees 표가 있으면 본인조회 정책 1건';
END $$;

-- ─────────────────────────────────────────────────────────────
-- REVERT (앱이 깨졌을 때만)
--
-- 기존 설치 DB에서 employees 정책을 되돌려야 하는 경우:
--     DROP POLICY IF EXISTS employees_self_select ON public.employees;
--     CREATE POLICY "Authenticated users can view employees" ON public.employees
--         FOR SELECT USING (auth.role() = 'authenticated');
--
-- ─────────────────────────────────────────────────────────────
