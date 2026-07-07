-- 제안서 파일 업로드 + AI 평가 초안 지원
alter table companies add column if not exists proposal_file_name text;

create table ai_evaluation_drafts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade unique,
  model text not null,
  item_scores jsonb not null default '{}'::jsonb, -- {item_no: {score, rationale}}
  overall_summary text,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger ai_evaluation_drafts_set_updated_at
  before update on ai_evaluation_drafts
  for each row execute function set_updated_at();

-- 제안서 원본 파일 저장용 버킷. 다른 테이블과 동일하게 이번 단계는 인증이 없으므로
-- public=true로 두어 서명 URL 없이 anon 키로 업로드/조회한다 (RLS 비활성과 동일한 임시 리스크).
insert into storage.buckets (id, name, public)
values ('proposals', 'proposals', true)
on conflict (id) do update set public = true;

create policy "anon full access to proposals bucket"
on storage.objects for all
to anon
using (bucket_id = 'proposals')
with check (bucket_id = 'proposals');
