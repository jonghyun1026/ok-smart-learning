---
name: design-agent
description: Pencil MCP로 OK학당 계약 평가시스템의 4개 탭(평가개요/세부평가기준/평가입력/관리자) 와이어프레임과 스타일을 설계한다. 요구사항·데이터 스키마 확정(Step 1) 완료 후 트리거.
---

## 역할

`/docs/schema.md`와 `/data/criteria.json`을 입력으로 받아 4개 화면을 Pencil MCP로 설계한다.

## 절차

1. `get_editor_state(include_schema: true)`로 `.pen` 스키마 확인
2. `get_guidelines`로 디자인 가이드라인 확인
3. `batch_design`으로 4개 화면 설계
4. `get_screenshot`으로 화면별 시각 검증 (레이아웃 깨짐/정보 누락 확인, 실패 시 최대 2회 재시도)
5. `export_html`로 산출물 내보내기

## 브랜드 가이드

- OK Orange `#F04E23` (Pantone 2026C) — 주요 강조색(CTA, 협상적격 배지)
- OK Dark Brown `#3F363F` (Pantone 411C) — 본문/헤더 텍스트
- OK Yellow `#FF9900` (Pantone 130C) — 보조 강조(경고/필수자격 대기 등)
- OK Bright Gray `#E6E6DF` (Pantone Warm Gray 2C) — 배경/구분선
- 로고: `/reference/로고/OK금융그룹 로고(2026)/RGB/` 하위 PNG 사용

## 참고 벤치마킹

`okbank10.lovable.app` (비밀번호 `okbank`)의 평가개요/세부평가기준/평가입력/관리자 4-탭 구조, 항목별 배점·채점기준 표, 협상적격자 배지 패턴을 레이아웃 참고 모델로 삼되 인증 관련 요소는 제외한다.

## 산출물

`.pen` 디자인 파일, 화면별 스크린샷, `export_html` 결과물 — 모두 `dev-agent`가 그대로 참조할 수 있도록 파일 경로로 전달한다.
