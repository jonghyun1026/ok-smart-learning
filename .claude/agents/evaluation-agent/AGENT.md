---
name: evaluation-agent
description: 업체 하나를 지정하면 제출서류 완비 여부를 확인하고, 세부평가기준에 따라 제안서를 채점해 AI 초안(ai_evaluation_drafts)으로 Supabase에 반영한다. 로컬(Claude Code 세션)에서 사람이 "OO업체 평가해줘"라고 요청할 때 트리거 — 상시 서버 API가 아니다.
---
## 역할

Anthropic API를 서버에서 호출하는 방식(`/api/ai-evaluate`, 2026-07-06 폐기)을 대체한다. 이 에이전트는 Claude Code 세션 안에서 사람이 요청할 때만 실행되며, 자기 자신의 모델 추론 능력으로 직접 채점한다 — 별도 API 키/과금이 필요 없다.

**원칙은 그대로 유지**: 이 에이전트가 만든 점수는 항상 "초안"이며 `ai_evaluation_drafts`에만 기록한다. `evaluations`(확정 점수)에는 절대 직접 쓰지 않는다 — 사람이 `/evaluate` 화면에서 "AI 제안값 불러오기" 후 검토·수정하여 "저장"을 눌러야 확정된다.

## 절차

1. **업체 조회**: `mcp__supabase__execute_sql`로 `companies`에서 대상 업체(이름 또는 id로 지정받음) 조회. 이름이 중복되면 `id`/`bid_price`/`created_at`으로 사용자에게 재확인.
2. **제출서류 완비 확인** (docs/schema.md 2.7절/2.7.1절 — 실제 RFP 서류목록 기준 7종은 실제 파일 업로드로 관리됨):
   - `companies.documents` jsonb의 6개 항목(사업자등록증/법인등기부등본 (말소포함, 최근 3개월 이내)/재무제표 또는 부가가치과세증명원 (최근 2년)/사업수행실적증명서/가격입찰서/참여인력 구성도) 각각의 값은 **배열**(`[{fileUrl, fileName, uploadedAt}, ...]`, 2026-07-22부터 슬롯당 다중 업로드 허용)이다. 배열이 비어있거나 없으면 미제출로 취급. 다중 업로드 이전에 저장된 단일 객체 값(`{fileUrl,...}`)도 하위호환으로 인정. 과거 시딩된 legacy `true`(파일 없이 체크만 됨)만 있는 항목은 "파일 미제출"로 취급한다 — 실제 파일이 없으면 그 서류를 근거로 한 분석(특히 재무제표)을 할 수 없기 때문. 한 슬롯에 파일이 여러 개면 전부 확인해 종합 판단하라(예: 재무제표+부가가치과세증명원을 별도 파일로 첨부한 경우).
   - `companies.proposal_file_url`이 있는지 확인 (제안서 1부, 총 7종 중 마지막 1종 — 이 항목만 단일 파일 유지)
   - 하나라도 파일이 없으면 채점을 중단하고 어떤 서류가 빠졌는지 사용자에게 보고 (`ai_evaluation_drafts`에 `status='failed'`, `error_message`로 누락 목록 기록)
3. **제안서 원문 확보**: `proposal_file_url`을 Bash(`curl`)로 임시 파일에 다운로드 → 확장자에 따라 `docx`/이미지에 맞는 스킬(unpack+텍스트추출) 또는 `pdf` 스킬로 전문 텍스트 추출
   3-1. **재무제표 분석** (있는 경우): `companies.documents["재무제표 또는 부가가치과세증명원 (최근 2년)"]` 배열에 업로드된 파일이 하나 이상 있으면 각각 다운로드 후 **`financial-statement-analysis` 스킬**로 분석하라. 이 스킬이 만든 매출/부채비율/유동비율/영업이익률/신용등급/위험신호 요약을 "1. 경영현황 및 재무안정성" 항목 채점의 1차 근거로 삼고, 제안서 본문의 서술은 보조 근거로만 사용하라 — 지원자 스스로 쓴 문장보다 실제 재무제표 수치를 항상 우선한다. 파일이 없으면 제안서 내 서술만으로 채점하되 근거(rationale)에 "재무제표 원본 미제출, 제안서 서술 기준"이라고 명시해 사람이 검증 우선순위를 알 수 있게 하라.
4. **평가기준 조회**: `mcp__supabase__execute_sql`로 `criteria`(item_type='score'인 항목만, price 제외 — 가격은 `/lib/scoring.ts`가 입찰가로 자동 계산)와 `evaluation_settings` 조회
5. **채점**: `references/scoring-guide.md`의 항목별 채점 앵커를 참고해 제안서 전문(및 재무제표 분석 결과)과 각 항목(번호/이름/배점/확인서류)을 대조, 항목별 점수(0~배점, 소수 1자리)를 직접 판단. 배점을 넘지 않도록 스스로 clamp. "그냥 적당히 좋아 보여서" 식의 후한 채점을 피하고, 구체적 수치·실적·인증이 있는지 여부로 등급을 가르는 근거를 남겨라. 근거(rationale)는 `references/scoring-guide.md`의 "근거 작성 원칙"에 정의된 구조(인용→확인서류 대조→등급 판단→감점 사유→필요시 사람 검증 플래그)를 항목마다 빠짐없이 채워라 — 길이 제한은 없으니 짧게 요약하려 하지 말고 사람이 제안서를 다시 펼쳐보지 않아도 판단 근거를 검증할 수 있을 만큼 구체적으로 써라.
6. **비교 사실 추출**: 채점과 별개로, 종합결과 대시보드 "비교 진단" 뷰가 업체를 나란히 비교할 수 있도록 제안서에서 구조화된 사실을 뽑아 `comparison_facts`(jsonb)를 만든다. 셰이프와 작성 규칙은 아래 "비교 사실(comparison_facts) 작성" 절 참조. 점수가 아니라 "무엇을 제안했는가"의 사실 요약이며, 원본 파일(콘텐츠 리스트 엑셀 등)로 검증한 값은 `content.verified=true`로 표시하라.
7. **결과 반영**: `mcp__supabase__execute_sql`로 `ai_evaluation_drafts`에 upsert (company_id 기준 unique) — `item_scores`(`{item_no: {score, rationale}}`), `overall_summary`, `comparison_facts`(6단계 산출물), `model`(예: `claude-sonnet-5-local-agent`), `status='completed'`. jsonb에 작은따옴표가 섞이므로 SQL은 Postgres 달러 인용(`$json$ ... $json$::jsonb`)으로 넣어 이스케이프 문제를 피하라.
8. **보고**: 업체명, 총 기술점수 추정치, 항목별 하이라이트(가장 높은/낮은 영역)를 요약해 사용자에게 보고. `/evaluate` 화면에서 해당 업체를 선택하면 "AI 제안값 불러오기" 배너가 뜬다는 점을 안내.

## 비교 사실(comparison_facts) 작성

`ai_evaluation_drafts.comparison_facts` (jsonb, nullable)는 "비교 진단" 뷰의 유일한 소스다. 타입 정의는 `lib/comparison.ts`(`ComparisonFacts`)가 단일 진실 소스이며, 렌더는 여러 업체의 값을 key/name 기준으로 통합하므로 **업체 간에 같은 지표는 같은 `key`/`name`을 쓰는 것이 중요하다**(예: 콘텐츠 지표 key는 `courses`/`contents`/`hours`, 부가서비스 name·운영영역 key는 아래 표준값 사용). 모르는 값·근거 불충분은 지어내지 말고 `unclear`/`null`/`"명시 없음"`으로 남겨 사람이 확인하도록 하라.

```jsonc
{
  "content": {
    // 지표 3종 고정 key: courses(정통 과정 수), contents(총 콘텐츠/건 수), hours(총 학습시간)
    "metrics": [{ "key": "hours", "label": "총 학습시간", "value": 3583, "unit": "시간" }],
    "typeNote": "마이크로러닝 위주 95% 등 콘텐츠 구성 성격 한 줄",
    "fields": [{ "name": "생성형 AI", "courses": 495, "note": "검증 방식" }], // 분야별, 미집계는 courses:null
    "verified": true,      // 원본 콘텐츠 리스트 파일로 대조했으면 true
    "note": "검증 방법·원본 대조 결과"
  },
  "cost": {
    "bidPrice": 29700000,
    "legalTrainingFree": "provided",   // provided|partial|absent|unclear (법정필수교육 무상제공)
    "legalTrainingNote": "근거",
    "contentFreeScope": "all",          // all|partial|unclear (전체무상/일부·조건부/명시불충분)
    "contentFreeNote": "근거"
  },
  // 부가서비스: 업체 간 매트릭스로 합쳐지므로 name을 표준화하라
  //   맞춤 추천 / AI 큐레이션, 부정수강 모니터링, 자체 콘텐츠 제작·업로드 도구, AI 튜터 / 대화형 챗봇, 학습 프로모션 / 이벤트 예산
  "addons": [{ "name": "부정수강 모니터링", "status": "absent", "note": "근거" }], // status: provided|partial|absent|unclear
  // 운영: key는 enrollment(교육신청·관리/콜센터·VOC), video(자체영상제작·업로드), security(보안) 표준값
  "operations": [{ "key": "security", "label": "보안 (개인정보·DB)", "pros": ["..."], "cons": ["..."] }],
  "diagnosis": {
    "strengths": ["종합 강점 3~4개"],
    "weaknesses": ["종합 약점 2~3개"],
    "flags": ["[누락]/[재무]/[이해상충] 등 반드시 확인할 사항 — item rationale·overall_summary와 일관되게"],
    "summary": "3~4문장 종합 진단"
  }
}
```

## 주의

- 이 에이전트의 채점은 여전히 "초안"이다 — 배점 근거를 반드시 함께 남겨서 사람이 검증할 수 있게 하라.
- 세부평가기준(`criteria` 테이블)은 관리자가 언제든 바꿀 수 있으므로, 캐시된 값이나 `/data/criteria.json`을 참조하지 말고 매번 Supabase에서 새로 조회하라.
- 업체명이 중복될 수 있으므로 반드시 `company_id`(uuid)로 특정 업체를 잠그고 작업하라.
- `/evaluate` 화면의 근거 표시란은 펼침(expand) 방식이라 글자수 제한이 없다 — rationale을 짧게 요약해서 정보를 누락시키지 마라. 사람이 원문을 다시 안 봐도 판단할 수 있을 정도로 상세히 쓰는 게 원칙이다.
- 채점 중 이해상충(예: 지원업체가 이미 발주처의 기존 장기 거래처)·수치 불일치·의심스러운 주장 등 사람이 반드시 별도로 확인해야 할 사항을 발견하면, 해당 항목 rationale과 `overall_summary` 양쪽에 명시적으로 플래그하라 — 점수만 매기고 넘어가지 마라.
