-- 1. PostGIS 확장 기능 활성화 (위치 정보 geometry 타입 저장을 위해 필요)
-- ST_SetSRID, ST_MakePoint, ST_X, ST_Y 같은 공간 함수를 사용하려면 PostGIS가 필요합니다.
create extension if not exists postgis;

-- 2. reports 테이블 생성
-- 사용자 앱이 보낸 위험 요소 신고와 관리자 처리 상태를 저장하는 핵심 테이블입니다.
create table public.reports (
    -- item_id는 신고 한 건의 고유 ID입니다. 앱에서 UUID를 보내지 않으면 DB 기본값으로 생성됩니다.
    item_id uuid not null default gen_random_uuid(),
    created_at timestamp with time zone not null default now(),
    -- 현재 백엔드는 user_id를 device_id 컬럼에 저장합니다.
    device_id uuid null,
    hazard_type text not null,
    risk_level integer not null,
    image_url text not null,
    description text null,
    label text null,
    status text not null default 'new',
    distance double precision null,
    direction text null,
    -- PostGIS Point 타입입니다. SRID 4326은 일반 GPS 위도/경도 좌표계를 뜻합니다.
    location geometry(Point, 4326) null,
    -- latitude/longitude 컬럼은 호환성/조회 편의를 위해 남아 있지만, 현재 CRUD는 location에서 ST_X/Y를 주로 사용합니다.
    latitude double precision null,
    longitude double precision null,
    -- 현재 delete API는 deleted_at 대신 status='Hidden'으로 숨김 처리합니다.
    deleted_at timestamp with time zone null,
    
    constraint reports_pkey primary key (item_id)
);

-- 3. Row Level Security(RLS) 해제 
-- 로컬 테스트 시 복잡한 로그인 권한 없이 접근하기 위해 RLS를 해제합니다.
-- 운영 환경에서는 anon key로 직접 읽는 adminUI 구조를 고려해 RLS 정책을 다시 설계해야 합니다.
alter table public.reports disable row level security;

-- 4. 실시간(Realtime) 감지 기능 활성화 
-- 대시보드에서 실시간으로 새 신고를 받아오기 위해 필요합니다.
-- App.tsx의 supabase.channel(...).on('postgres_changes') 구독이 이 publication을 통해 INSERT를 받습니다.
alter publication supabase_realtime add table public.reports;
