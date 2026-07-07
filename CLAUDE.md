# OK학당 입찰·평가 웹 시스템

## 프로젝트 개요

> **용어 주의**: 이 절차는 기존 업체가 재선정될 확률이 높을 뿐, 절차상으로는 "재계약(갱신)"이 아니라 공개경쟁입찰을 통한 신규 "계약" 선정 절차다. 화면·문서 어디에도 "재계약"이라는 표현을 쓰지 말 것 (2026-07-06 사용자 정정).

OK금융그룹 「2025~2026년 OK학당 스마트러닝 교육 위탁운영 용역」계약을 위해, 입찰공고 게시 → RFP 열람 → 참가업체 등록(오프라인 접수) → 평가자 점수 입력 → 자동 집계·협상적격자 산출을 수행하는 웹 시스템. 설계 근거는 `docs/blueprint-ok-hakdang-rfp-system.md` (구현 전 반드시 먼저 확인).

## 단일 진실 소스

- **세부 평가기준**: Supabase `criteria` 테이블(+ `evaluation_settings`)이 단일 진실 소스다. 관리자가 화면(`/admin` "평가기준 관리")에서 영역·항목·배점을 자유롭게 추가/수정/삭제할 수 있으므로, 배점 합계·기술/가격 총점 등은 절대 하드코딩하거나 캐시하지 말고 항상 실시간으로 다시 계산한다. `/data/criteria.json`은 최초 시딩 스냅샷일 뿐 런타임에 참조하지 않는다.
- **DB 스키마 문서**: `/docs/schema.md`

## 기술스택 규칙

Next.js(App Router) + Tailwind + shadcn/ui + Supabase(PostgreSQL) + Vercel. 신규 스킬 필요 시 반드시 `/skill-creator`로 생성 — SKILL.md 수동 작성 금지.

## Supabase 연동 가이드

- 테이블: `companies`/`criteria`/`evaluations` + 집계뷰 `results_view` (스키마는 `/docs/schema.md` 참조)
- 서버(Route Handler/Server Action)에서만 `service_role key` 사용, 클라이언트에 `anon key` 노출 금지, 커넥션은 Supabase pooler 엔드포인트 사용
- `evaluations`는 `UNIQUE(company_id, evaluator_id)` + `ON CONFLICT DO UPDATE` upsert로만 쓴다 (경쟁 조건 방지)
- **RLS 비활성 상태** — 인증이 없는 이번 단계의 의도된 임시 조치. Storage `proposals` 버킷도 동일하게 anon 키로 열려 있음. 인증 도입 시 반드시 모두 활성화할 것

## AI 평가 에이전트 가이드

- 채점은 서버 API(Anthropic 호출) 방식이 아니라 **로컬 `evaluation-agent` 서브에이전트**(`.claude/agents/evaluation-agent/AGENT.md`)로 수행한다 — 사람이 Claude Code 세션에서 "OO업체 평가해줘"라고 요청하면 실행되며, 별도 API 키/과금이 필요 없다 (2026-07-06 결정, `/api/ai-evaluate` 폐기).
- 업로드된 제안서(Storage `proposals` 버킷)를 읽어 `ai_evaluation_drafts`에 초안(점수+근거)을 저장한다. **AI 결과는 절대 `evaluations`에 직접 쓰지 않는다** — 사람 평가자가 평가입력 화면에서 초안을 검토·수정 후 "저장"을 눌러야만 확정된다.
- `criteria`는 관리자가 언제든 바꿀 수 있으므로 에이전트는 매번 Supabase에서 실시간 조회하고 캐시/정적 json을 참조하지 않는다.

## 인증 관련 주의사항

2026-07-07부터 **단일 공유 계정(ID/PW) 로그인 게이트**를 적용했다 (`lib/auth.ts`, `middleware.ts`, `app/login`, `app/api/login`, `app/api/logout`). 사용자별 계정·권한 구분은 없고 `.env.local`의 `ADMIN_USERNAME`/`ADMIN_PASSWORD` 한 쌍만 존재하며, 로그인 성공 시 서버가 HMAC 서명한 무상태 세션 쿠키(7일 만료)를 발급한다. `/login`·`/api/login`·`/api/logout`·정적 자산(확장자가 있는 `public` 파일: RFP·세부평가기준 안내 docx 등)은 게이트 대상에서 제외했다 — 이 문서들은 원래부터 공개 다운로드 대상이라 의도적으로 그대로 두었다.

이는 "URL 비공개 공유"보다 한 단계 개선된 최소 조치일 뿐, 실 운영 수준의 인증(사용자별 계정, 비밀번호 해시 저장, RLS 활성화 등)은 아니다. 실 운영 전 반드시 정식 인증 체계로 교체해야 하는 리스크로 남아 있다.

## 서브에이전트 위임 규칙

| 서브에이전트 | 트리거 | 산출물 전달 |
|---|---|---|
| `design-agent` | 요구사항·스키마 확정 후 | `.pen` 파일 + 스크린샷 (파일 경로 기반 전달) |
| `dev-agent` | 디자인 산출물 확보 후 | 소스 코드 커밋 |
| `test-agent` | 빌드 성공 후 | `/output/test-report.md` + 스크린샷 |

## CLAUDE.md 작성 원칙 (자기 검증)

1. **구현 전에 생각하라** — 배점 배분·가격산식·동점규칙(운영→콘텐츠)은 이번 설계에서 가정한 값이다. 실사용 전 담당자 검수 필요함을 숨기지 마라.
2. **단순함 우선** — 로그인/인증처럼 요청하지 않은 기능은 만들지 마라. AI 채점은 범위 안이지만 항상 "초안"이며 사람 확정 없이 점수를 확정 처리하는 지름길을 만들지 마라.
3. **수술적 변경** — 평가기준 수정 요청은 `/data/criteria.json`과 그 참조 부분만 고쳐라.
4. **목표 중심 실행** — 각 Step의 성공 기준(빌드 성공, 시나리오 전량 통과, 배점 합계 100)을 검증한 뒤에만 다음 단계로 진행하라.
