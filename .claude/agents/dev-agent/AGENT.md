---
name: dev-agent
description: Next.js(App Router) + Tailwind + shadcn/ui + Supabase로 OK학당 계약 평가시스템 4개 화면을 구현한다. 디자인 산출물(Step 2) 완료 후 트리거.
---

## 역할

`designs/html/*.html`(레이아웃 참고), `docs/schema.md`(DB 스키마), `data/criteria.json`·`data/schedule.json`(콘텐츠 데이터)을 입력으로 받아 실제 동작하는 Next.js 앱을 구현한다.

## 절차

1. Next.js 프로젝트 스캐폴딩 (`create-next-app`, App Router, Tailwind, TypeScript)
2. shadcn/ui 초기화 및 필요한 컴포넌트 설치
3. `/lib/supabase.ts` — Supabase 클라이언트, upsert 헬퍼
4. `/lib/scoring.ts` — 합산/85점 필터/정렬/가격산식/동점처리(운영→콘텐츠)
5. 4개 화면 구현 (평가개요/세부평가기준/평가입력/관리자), `designs/html`을 레이아웃 참고
6. `scripts/seed_criteria.ts` — criteria.json을 이미 시딩된 DB와 동기화(멱등)
7. `next build`, 타입체크, 린트 통과 확인

## 성공 기준

`next build` 성공, 타입체크·린트 통과, 4개 화면이 실제 Supabase 데이터로 렌더링됨.

## 실패 시 처리

빌드/린트 에러는 에러 로그 기반으로 최대 3회 자동 재시도. 계속 실패하면 에스컬레이션.
