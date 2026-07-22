# 화면 목록 및 데이터 스키마

> Step 1 산출물. 설계서(`docs/blueprint-ok-hakdang-rfp-system.md`)의 구현 참조 문서.
> 작성일: 2026-07-06

## 1. 화면 목록 (4개 탭, 벤치마킹 사이트와 동일한 상단 탭 구조)

> **2026-07-06 정정**: 이 시스템은 "공고를 게시하는 사이트"가 아니라 "이미 오프라인으로 접수된 제출자료를 평가·비교하는 사이트"다. 인증이 없어 공개/관리자를 화면으로 분리할 실익이 없으므로, 벤치마킹 사이트(`okbank10.lovable.app`)와 동일하게 **4개 탭이 하나의 공유 상단 내비게이션**에 있는 구조로 통일한다. "평가 개요" 탭은 RFP 원문 전체를 옮기지 않고 사업정보 요약 + 배점 구성표 + 원문 다운로드 링크 수준으로 가볍게 구성한다(첨부 스크린샷 기준).

| # | 경로 | 탭 이름 | 설명 |
|---|------|--------|------|
| 1 | `/` | 평가 개요 | 사업명·계약기간 타이틀, RFP 원문(.docx) 다운로드 링크, "사업 정보" 요약표(사업명/계약기간/위탁범위 등), "입찰 일정" 표(`/data/schedule.json` — 공고게시~계약날인 4단계), "평가 배점 구성" 요약표(①~⑥ 6개 영역 배점 + 합계 100 강조행) |
| 2 | `/criteria` | 세부 평가기준 | criteria.json 19개 항목 전체 상세 표 (영역별 그룹, 항목명·배점·확인서류) |
| 3 | `/evaluate` | 평가 입력 | 평가자가 업체 선택 후 항목별 점수 입력, 영역별 실시간 합계, 저장(upsert) |
| 4 | `/admin` | 관리자 | 서브 섹션 2개: (a) 참가업체 등록(업체명/입찰가/서류체크/제안서링크/필수자격 P-F) (b) 종합결과 대시보드(업체별 평균점수/협상적격 배지/고득점순 정렬) |

## 2. Supabase 테이블/뷰 스키마

### `companies`

> **구현 메모(Step 3)**: 0-1/0-2 개별 판정 값은 `documents` jsonb의 `__qualification` 예약 키에 저장하고, 종합 결과만 `qualification_pass`에 반영한다. 관리자 화면에서 재조회 시 두 항목을 개별 표시해야 하므로 이 방식을 사용함.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid (pk) | |
| name | text | 업체명 |
| bid_price | numeric | 입찰가격 |
| documents | jsonb | 제출서류 체크리스트 (예: `{"사업자등록증": true}`) |
| proposal_file_url | text | 제안서 파일 링크 (Drive 등 외부 저장) |
| qualification_pass | boolean | 필수자격 종합 Pass/Fail (null=미심사). 0-1/0-2 두 항목 중 하나라도 Fail이면 false, 둘 다 Pass면 true, 그 외 null |
| created_at / updated_at | timestamptz | |

### `criteria` (단일 진실 소스: `/data/criteria.json`)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid (pk) | |
| item_no | text (unique) | 항목 번호 (`0-1`, `1`...`17`) |
| area_code | text | `PF`/`GENERAL`/`CONTENT`/`OPERATION`/`SYSTEM`/`PRICE` |
| area_name | text | 일반부문/콘텐츠부문/운영부문/시스템부문/가격평가 |
| item_name | text | 세부 항목명 |
| item_type | text | `pass_fail` \| `score` |
| max_points | numeric (nullable) | pass_fail은 null |
| doc_reference | text | 확인 서류 |
| sort_order | int | 표시 순서 |

19개 행 시딩 완료 (필수자격 2 + 일반 3 + 콘텐츠 4 + 운영 5 + 시스템 4 + 가격 1). 배점 합계 100 검증됨.

### `evaluations`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid (pk) | |
| company_id | uuid (fk → companies) | |
| evaluator_id | text | 평가자 식별자 (인증 없음 — 평가자 이름 등 평문 텍스트) |
| scores | jsonb | `{item_no: score}` 맵. 예: `{"1": 4, "17": 18.5}` |
| technical_total | numeric | 기술평가 합계(80점 만점) — 저장 시 `/lib/scoring.ts`가 계산해서 기록 |
| price_total | numeric | 가격평가 점수(20점 만점) |
| total_score | numeric | technical_total + price_total |
| created_at / updated_at | timestamptz | |

**동시 쓰기 충돌 방지**: `UNIQUE(company_id, evaluator_id)` + `INSERT ... ON CONFLICT (company_id, evaluator_id) DO UPDATE` upsert. 평가자가 "저장"을 누를 때마다 해당 업체·평가자 조합의 점수 전체를 한 행으로 원자적 갱신.

**필수자격(P/F) 처리**: `criteria`에 항목(0-1, 0-2)은 존재하지만 `evaluations.scores`에는 포함하지 않는다 — 필수자격은 평가자 채점 이전에 관리자가 `companies.qualification_pass`로 1회 판정하는 게이트(운영 흐름 P4)이기 때문.

### `results_view` (집계 뷰)

```sql
select
  c.id as company_id, c.name as company_name, c.bid_price, c.qualification_pass,
  count(e.id) as evaluator_count,
  round(avg(e.technical_total), 2) as avg_technical_score,
  round(avg(e.price_total), 2) as avg_price_score,
  round(avg(e.total_score), 2) as avg_total_score,
  (c.qualification_pass is true and avg(e.total_score) >= 85) as is_negotiation_qualified
from companies c
left join evaluations e on e.company_id = c.id
group by c.id, c.name, c.bid_price, c.qualification_pass;
```

업체별 평가자 평균 점수와 협상적격 여부(합계 ≥85 AND 필수자격 Pass)를 계산. **동점 처리(가격평가 점수 높은 업체 우선)는 뷰가 아닌 애플리케이션(`/lib/scoring.ts`)에서 처리** — SQL 뷰만으로는 가정 기반 동점 규칙을 표현하기 번거롭고, 규칙 변경 시 코드만 수정하면 되도록 분리.

## 2.5 평가기준 자유편집 (2026-07-06 추가, Step 3.5)

관리자가 세부평가기준의 **영역(카테고리) 자체와 항목을 자유롭게 추가·삭제·수정**할 수 있어야 한다는 요구에 따라 `criteria` 테이블이 정적 `/data/criteria.json` 대신 **단일 진실 소스**가 된다.

- `criteria.item_type`에 `'price'` 추가 (`pass_fail` / `score` / `price`) — item_no='17' 가격항목을 하드코딩 없이 식별하기 위함
- `evaluation_settings` 테이블(단일행, id=1) 신설: `negotiation_threshold`(기본 85), `tiebreak_area_codes`(동점 재비교 순서, 2026-07-07부터 `["PRICE"]` — 가격평가 점수 높은 업체 우선)
- **파생값은 저장하지 않고 항상 실시간 계산**: 영역별 배점 합계, 기술평가 합계(`score` 타입 총합), 가격평가 합계(`price` 타입 총합), 전체 합계 — `criteria` 테이블을 항상 다시 읽어 합산하므로 관리자가 항목을 추가/삭제해도 항상 정합성 유지
- `/data/criteria.json`은 최초 시딩 스냅샷으로만 남고 런타임에는 더 이상 참조하지 않음 — `lib/scoring.ts`는 Supabase에서 동적으로 읽어오도록 리팩터링 필요(Step 3.5 dev-agent 작업)
- API: `/api/criteria` (GET 전체 조회, POST 항목 추가, PATCH 항목수정/영역명 변경, DELETE 항목·영역 삭제), `/api/settings` (GET/PATCH)

## 2.6 AI 평가 에이전트 (2026-07-06 추가, Step 3.6 → 2026-07-06 재설계, Step 3.7)

업체가 제출한 제안서를 AI가 세부평가기준(`criteria`)에 따라 항목별 점수와 근거를 생성해 초안으로 남긴다. **AI 결과는 초안일 뿐이며, 사람 평가자가 검토·수정 후 저장해야만 실제 `evaluations`에 반영된다** — "점수는 사람이 직접 입력한다" 원칙은 "확정은 사람이 한다"로 유지됨(전면 자동화 아님).

- `companies.proposal_file_name` 컬럼 (원본 파일명 표시용). `proposal_file_url`은 Supabase Storage `proposals` 버킷(public=true, anon 키로 업로드/조회)의 업로드 파일 URL
- `ai_evaluation_drafts` 테이블(업체당 1행, 재실행 시 덮어씀): `item_scores` jsonb(`{item_no: {score, rationale}}`), `overall_summary`, `model`, `status`(pending/completed/failed), `error_message`
- API: `/api/proposals/upload`(파일 업로드) — 유지. **`/api/ai-evaluate` 라우트(Anthropic API 서버 호출 방식)는 2026-07-06 폐기**: 사용자가 "그냥 API 쓰지 말고 다른 방식으로 하자", "로컬에서 하는게 좋을 것 같다"고 결정함에 따라 별도 API 키/과금 없이 **Claude Code 세션 안에서 사람이 요청할 때 로컬로 실행하는 `evaluation-agent` 서브에이전트**(`.claude/agents/evaluation-agent/AGENT.md`)로 대체됨.
- **evaluation-agent 동작**: (1) 업체의 제출서류 체크리스트(`companies.documents`)와 제안서 업로드 여부를 확인해 누락 시 중단·보고 (2) `proposal_file_url`에서 파일을 받아 전문 추출 (3) `criteria`(매번 실시간 조회, 캐시/정적 json 참조 금지)와 대조해 항목별 점수+근거를 직접 판단 (4) `ai_evaluation_drafts`에 upsert. 트리거는 웹 버튼이 아니라 사람이 Claude Code 세션에서 "OO업체 평가해줘"라고 요청하는 것.
- UI: 평가입력 화면에서 해당 업체의 draft가 있으면 "AI 제안값 불러오기" 배너 표시 → 클릭 시 점수 입력란에 채워지고 항목별 근거 문장이 함께 표시됨(저장 버튼을 눌러야 확정). 관리자 화면의 "AI 채점 실행" 버튼은 제거됨(더 이상 즉시 트리거할 웹 엔드포인트가 없으므로).
- ~~서버 환경변수 `ANTHROPIC_API_KEY`~~ — 더 이상 앱에서 사용하지 않음(로컬 에이전트 방식은 별도 API 키/과금 불필요).

## 2.7 제출서류 실제 파일 업로드 (2026-07-06 추가, Step 3.9 → 2026-07-06 목록 정정)

기존에는 제출서류 체크리스트(`companies.documents`)가 관리자의 자기신고 체크박스(boolean)일 뿐이었고, 실제 파일이 첨부되는 것은 제안서 1개뿐이었다. **evaluation-agent가 재무제표 등을 실제로 "분석"하려면 진짜 파일이 필요**하므로, 전 항목을 파일 업로드로 확장한다(일부만 파일이고 일부는 체크박스인 상태는 UI 일관성을 해치므로 전체 전환).

**제출서류 목록은 사용자가 확인한 실제 RFP 기준 7종으로 확정**(최초 설계 시 9종으로 임의 추정했던 "원격평생교육시설 신고증빙"·"정보보안 대책서"는 실제 RFP에 없어 제외):

1. 사업 제안서 (스마트러닝 위탁운영 용역 제안서) — `companies.proposal_file_url`/`proposal_file_name` (기존 필드, 하위호환)
2. 사업자등록증
3. 법인등기부등본 (말소포함, 최근 3개월 이내)
4. 재무제표 또는 부가가치과세증명원 (최근 2년)
5. 사업수행실적증명서
6. 가격입찰서
7. 참여인력 구성도

- `companies.documents`의 각 값 shape을 `boolean` → `{ fileUrl: string, fileName: string, uploadedAt: string } | null`로 변경. 기존 시딩된 legacy `true` 값(테스트 데이터)은 "파일 없이 체크만 됨"으로 하위호환 처리하되, 신규 업로드는 항상 객체로 저장.
- `/api/proposals/upload`를 `docType` 파라미터로 일반화: `docType === "proposal"`이면 기존처럼 `companies.proposal_file_url`/`proposal_file_name`에 반영(하위호환), 그 외 6종은 `companies.documents[문서라벨]`(위 2~7번 라벨 그대로)에 객체로 반영. Storage 경로는 `proposals/{companyId}/{docTypeSlug}.{ext}` (ASCII slug — 한글 파일명 이슈 재발 방지, 2026-07-06 수정 사항과 동일 원칙)
- 관리자 "참가업체 등록" 화면에 7개 파일 업로드 슬롯 (업로드 완료 시 파일명 표시 + 다운로드 링크)
- `evaluation-agent`는 "제출서류 완비 확인" 단계에서 각 문서 슬롯에 실제 `fileUrl`이 있는지 확인하고, 재무제표 슬롯(4번)은 `financial-statement-analysis` 스킬로 분석해 항목 1(경영현황 및 재무안정성) 채점의 1차 근거로 사용

### 2.7.1 허용 파일 형식 확장 + 다중 업로드 (2026-07-22 추가)

- **허용 확장자**: 제안서(1번)는 `.pdf`/`.docx`/`.jpg`/`.jpeg`/`.png`, 나머지 6종은 `.pdf`/`.docx`/`.xlsx`/`.jpg`/`.jpeg`/`.png`. 스캔본(사진/이미지)으로 제출되는 경우가 많은 서류(사업자등록증 등)를 고려해 이미지 확장자를 추가했다.
- **다중 업로드**: 제안서(1번)를 제외한 6종은 슬롯당 파일을 여러 개 첨부할 수 있다. 제안서는 RFP상 단일 문서로 제출되는 게 일반적이라 기존과 동일하게 1개만 유지한다.
  - `companies.documents[문서라벨]`의 shape이 단일 객체에서 **배열**(`DocumentUpload[]`)로 변경됨: `[{ fileUrl, fileName, uploadedAt }, ...]`. 다중 업로드 이전에 저장된 단일 객체 값과 legacy `true` 값은 하위호환으로 계속 인식하되(`lib/supabase.ts`의 `Company.documents` 타입 참고), 신규 업로드는 항상 배열에 append.
  - Storage 경로도 슬롯당 유일해야 하므로 `proposals/{companyId}/{docTypeSlug}-{uuid}.{ext}`로 변경(기존엔 `{docTypeSlug}.{ext}` 고정이라 재업로드 시 이전 파일을 덮어썼음). 제안서(1번)는 여전히 1개만 허용하므로 경로를 고정 유지.
- `evaluation-agent`는 재무제표 슬롯 등에서 여러 파일이 있을 수 있음을 감안해 배열 전체를 확인하고 종합 판단해야 한다(예: 재무제표+부가가치과세증명원을 각각 별도 파일로 첨부한 경우).

### 2.7.2 업로드를 브라우저→Storage 직접 방식으로 전환 (2026-07-22 추가)

2.7.1절의 4MB 클라이언트 상한은 임시방편이었다 — 실제 원인은 Vercel Functions의 요청 본문 하드 리밋(약 4.5MB, 서버 코드로 늘릴 수 없는 플랫폼 제약)이었고, 스캔본 파일은 이보다 쉽게 커진다. 이를 근본적으로 없애기 위해 파일 바이트가 더 이상 Vercel 서버리스 함수를 거치지 않도록 업로드 경로를 바꿨다.

- **이전**: 브라우저 → `POST /api/proposals/upload`(multipart, 파일 바이트 포함) → 서버가 Supabase Storage에 업로드 → DB 기록. 파일 바이트가 Vercel 함수 요청 본문에 실려 4.5MB 벽에 걸림.
- **이후**: 브라우저가 `@supabase/supabase-js`(anon key, 이미 클라이언트에 노출된 구조 — 1장 RLS 비활성 참고)로 Supabase Storage에 **직접** 업로드 → 완료된 `{ fileUrl, fileName }`만 가벼운 JSON으로 `POST /api/proposals/finalize`에 보내 DB(`proposal_file_url`/`proposal_file_name` 또는 `documents[라벨]` 배열 append)에 기록. `/api/proposals/upload`는 삭제됨.
- 클라이언트 측 파일당 상한을 4MB → **50MB**로 상향(Storage `proposals` 버킷은 파일 크기 제한이 걸려있지 않음 — 프로젝트 전역 기본값을 따름, Supabase 무료/Pro 플랜 통상 기본값 수준). 과도하게 큰 첨부를 막기 위한 여유 있는 UX 가드일 뿐, 플랫폼 제약이 아니므로 필요시 대시보드(Project Settings → Storage)에서 전역 한도를 확인한 뒤 더 올릴 수 있다.
- 공유 상수(`DOC_TYPE_LABELS`, 허용 확장자, 파일 크기 상한)는 `lib/documentTypes.ts`로 분리해 클라이언트(`components/admin/company-registration.tsx`)와 서버(`/api/proposals/finalize`)가 함께 참조한다.
- `companies.documents`/`proposal_file_url` 등 DB에 저장되는 shape 자체는 2.7/2.7.1절과 동일하다 — 바뀐 건 전송 경로뿐이다.

## 2.8 비교 진단 — 구조화된 비교 사실 (2026-07-22 추가)

종합결과 대시보드의 업체 비교가 점수 막대·레이더에 그쳐, RFP 실무자가 실제로 궁금한 "무엇을 제안했는가"(콘텐츠 규모·무상제공·부가서비스·운영 장단점)를 나란히 볼 수 없다는 요구에 따라 **사실 기반 "비교 진단" 뷰**를 신설했다.

- `ai_evaluation_drafts.comparison_facts` (jsonb, **nullable**) 컬럼 추가. 점수(`item_scores`)와 별개로, evaluation-agent가 제안서에서 추출한 구조화된 사실을 담는다. 셰이프의 단일 진실 소스는 `lib/comparison.ts`의 `ComparisonFacts` 타입(콘텐츠 규모 metrics/fields, 비용·무상제공, 부가서비스 매트릭스, 운영영역별 pros/cons, 종합 진단 strengths/weaknesses/flags/summary). 작성 규칙은 `.claude/agents/evaluation-agent/AGENT.md`의 "비교 사실 작성" 절.
- 렌더: `components/admin/comparison-diagnosis.tsx`(`ComparisonDiagnosis`). 종합결과 대시보드(`AiDecisionDashboard`)의 세그먼트 내비 **맨 앞 "비교 진단" 탭(기본 선택)**으로 임베드. 기존 개요/비용/콘텐츠/운영·관리/시스템/기업역량/항목상세 세그먼트는 그대로 뒤에 유지.
- 여러 업체의 사실을 key/name 기준으로 통합(union)해 매트릭스·정규화 막대로 그리므로, 업체 간 같은 지표는 같은 표준 key/name을 써야 한다(콘텐츠 metric key `courses`/`contents`/`hours`, 운영 key `enrollment`/`video`/`security`, 부가서비스 표준 name 5종). 콘텐츠 '건수'는 마이크로러닝 포함 여부로 왜곡되므로 **총 학습시간(hours)을 정규화 기준으로 강조** 표시한다.
- `comparison_facts`도 여전히 **AI 초안**이다 — 뷰 상단에 "원본 제안서로 교차 검증 필요" 배너를 고정 표시하고, 확정 점수(`evaluations`)와 무관함을 명시한다.
- 컬럼 추가 이전 초안이나 아직 재평가하지 않은 초안은 `comparison_facts=null`일 수 있으므로 렌더는 항상 null-safe하게 처리하고, 사실이 하나도 없으면 재평가 안내로 대체한다. 최초 시딩으로 (주)유밥·(주)휴넷 2개사는 기존 채점 근거(rationale)에서 추출해 채워둠(2026-07-22).

## 3. 마이그레이션/시딩 현황

- `scripts/migrations/001_init_schema.sql` — 적용 완료 (companies/criteria/evaluations 테이블 + results_view + updated_at 트리거)
- criteria 19행 시딩 완료 (`/data/criteria.json` 기준)
- Supabase project URL: `https://cfawsjswufrlhcpnomer.supabase.co`

## 4. 보안 경고 (RLS 비활성)

설계서 결정에 따라 이번 단계는 인증이 없어 서버(서비스 롤 키)에서만 DB에 접근하므로 3개 테이블 모두 **RLS(Row Level Security)가 비활성 상태**다. Supabase advisor가 "anon key로 누구나 읽기/쓰기 가능"이라고 경고하지만, 이는 인증 도입 전까지의 **의도된 임시 상태**다 (설계서 제약조건 참조).

- 클라이언트에는 `anon key`를 절대 노출하지 말고, 서버 사이드(Route Handler/Server Action)에서만 `service_role key`로 접근할 것
- 향후 인증 도입 시 반드시 RLS를 활성화하고 정책을 추가할 것 — CLAUDE.md에 리스크로 명시 예정
