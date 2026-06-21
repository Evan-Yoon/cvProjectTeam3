-- 1. PostGIS 확장 기능 활성화 (위치 정보 geometry 타입 저장을 위해 필요)
create extension if not exists postgis;

-- 2. reports 테이블 생성
create table public.reports (
    item_id uuid not null default gen_random_uuid(),
    created_at timestamp with time zone not null default now(),
    device_id uuid null,
    hazard_type text not null,
    risk_level integer not null,
    image_url text not null,
    description text null,
    label text null,
    status text not null default 'new',
    distance double precision null,
    direction text null,
    location geometry(Point, 4326) null,
    latitude double precision null,
    longitude double precision null,
    deleted_at timestamp with time zone null,
    
    constraint reports_pkey primary key (item_id)
);

-- 3. Row Level Security(RLS) 해제 
-- 로컬 테스트 시 복잡한 로그인 권한 없이 접근하기 위해 RLS를 해제합니다.
alter table public.reports disable row level security;

-- 4. 실시간(Realtime) 감지 기능 활성화 
-- 대시보드에서 실시간으로 새 신고를 받아오기 위해 필요합니다.
alter publication supabase_realtime add table public.reports;
