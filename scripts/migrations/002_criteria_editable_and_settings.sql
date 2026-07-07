-- 평가기준 자유편집(영역/항목 추가삭제) 지원을 위한 확장
-- 1) item_type에 'price'를 추가해 자동계산되는 가격항목을 하드코딩(item_no='17') 없이 식별 가능하게 함
alter table criteria drop constraint criteria_item_type_check;
alter table criteria add constraint criteria_item_type_check
  check (item_type in ('pass_fail', 'score', 'price'));

update criteria set item_type = 'price' where item_no = '17';

-- 2) 전역 평가설정(협상적격 기준점, 동점 재비교 순서)을 관리자가 조정할 수 있도록 단일행 테이블 생성
create table evaluation_settings (
  id int primary key default 1,
  negotiation_threshold numeric not null default 85,
  tiebreak_area_codes jsonb not null default '["OPERATION", "CONTENT"]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint single_row check (id = 1)
);

create trigger evaluation_settings_set_updated_at
  before update on evaluation_settings
  for each row execute function set_updated_at();

insert into evaluation_settings (id, negotiation_threshold, tiebreak_area_codes)
values (1, 85, '["OPERATION", "CONTENT"]'::jsonb);
