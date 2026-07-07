-- OK학당 재계약 입찰·평가 시스템 초기 스키마
-- 이번 단계는 인증이 없어 서버(서비스 롤 키)에서만 접근 -> RLS 비활성 상태로 둔다.
-- 향후 인증 도입 시 반드시 RLS를 활성화할 것 (CLAUDE.md에 리스크로 명시).

create extension if not exists pgcrypto;

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- 참가업체
create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  bid_price numeric,
  documents jsonb not null default '{}'::jsonb,
  proposal_file_url text,
  qualification_pass boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger companies_set_updated_at
  before update on companies
  for each row execute function set_updated_at();

-- 세부 평가기준표 (단일 진실 소스: /data/criteria.json)
create table criteria (
  id uuid primary key default gen_random_uuid(),
  item_no text not null unique,
  area_code text not null,
  area_name text not null,
  item_name text not null,
  item_type text not null check (item_type in ('pass_fail', 'score')),
  max_points numeric,
  doc_reference text,
  sort_order int not null
);

-- 평가자별 점수 입력 (company_id + evaluator_id 당 1행, upsert로 원자적 갱신)
-- scores: {"1": 4, "2": 3, ... "17": 18.5} 형태의 item_no -> 점수 맵
-- technical_total/price_total/total_score는 저장 시 애플리케이션(lib/scoring.ts)이 계산해 함께 기록한다.
create table evaluations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  evaluator_id text not null,
  scores jsonb not null default '{}'::jsonb,
  technical_total numeric not null default 0,
  price_total numeric not null default 0,
  total_score numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, evaluator_id)
);

create trigger evaluations_set_updated_at
  before update on evaluations
  for each row execute function set_updated_at();

create index evaluations_company_id_idx on evaluations (company_id);

-- 집계용 뷰: 업체별 평가자 평균 점수 및 협상적격 여부
create view results_view as
select
  c.id as company_id,
  c.name as company_name,
  c.bid_price,
  c.qualification_pass,
  count(e.id) as evaluator_count,
  round(avg(e.technical_total), 2) as avg_technical_score,
  round(avg(e.price_total), 2) as avg_price_score,
  round(avg(e.total_score), 2) as avg_total_score,
  (c.qualification_pass is true and avg(e.total_score) >= 85) as is_negotiation_qualified
from companies c
left join evaluations e on e.company_id = c.id
group by c.id, c.name, c.bid_price, c.qualification_pass;
