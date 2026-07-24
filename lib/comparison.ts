/**
 * 종합결과 대시보드 "비교 진단" 뷰가 렌더하는 구조화된 비교 사실.
 *
 * 이 데이터는 점수(item_scores)와 별개로, evaluation-agent가 제안서에서 뽑아낸
 * 정성·정량 사실을 담는다. `ai_evaluation_drafts.comparison_facts` (jsonb, nullable) 컬럼에
 * 저장되며, 컬럼이 비어 있는(구버전) 초안도 있을 수 있으므로 렌더 측에서 항상 null-safe하게
 * 다뤄야 한다. 모든 값은 AI 초안이므로 "사람 검증 대상"이라는 원칙(CLAUDE.md)이 그대로 적용된다.
 *
 * criteria가 관리자에 의해 바뀌어도 이 사실 셰이프 자체는 criteria 항목번호에 종속되지 않는다
 * (항목 점수가 아니라 제안서 사실의 요약이므로). 다만 note에 "(항목7 3.2/5)"처럼 근거 항목을
 * 참조 표기할 수 있는데 이는 사람이 원본을 찾아가기 위한 힌트일 뿐 하드 의존이 아니다.
 */

export type FactStatus = "provided" | "partial" | "absent" | "unclear";
export type ContentFreeScope = "all" | "partial" | "unclear";

/** 콘텐츠 규모 비교용 정량 지표 1건 (과정 수·콘텐츠 수·총 시간 등) */
export type ContentMetric = {
  key: string;
  label: string;
  value: number | null;
  unit: string;
};

/**
 * 분야별 과정 수 (예: 생성형 AI 153, 법정필수교육 131).
 * track: 이러닝 과정 vs 마이크로러닝 구분. 원본 과정리스트 엑셀 전수 집계 기준이며,
 * 휴넷은 제안서가 시트로 분리 제공, 유밥은 과정 학습시간 15분 이하를 마이크로러닝으로 구분한다.
 * (미지정 시 track 없음 — 구버전 데이터 호환)
 */
export type ContentField = {
  name: string;
  courses: number | null;
  track?: "elearning" | "micro";
  note?: string;
};

export type OperationArea = {
  key: string;
  label: string;
  pros: string[];
  cons: string[];
};

export type AddonFact = {
  name: string;
  status: FactStatus;
  note?: string;
};

export type ComparisonFacts = {
  content: {
    metrics: ContentMetric[];
    typeNote: string;
    fields: ContentField[];
    verified: boolean;
    note?: string;
  };
  cost: {
    bidPrice: number | null;
    legalTrainingFree: FactStatus;
    legalTrainingNote?: string;
    contentFreeScope: ContentFreeScope;
    contentFreeNote?: string;
  };
  addons: AddonFact[];
  operations: OperationArea[];
  diagnosis: {
    strengths: string[];
    weaknesses: string[];
    flags: string[];
    summary: string;
  };
};

export const FACT_STATUS_META: Record<
  FactStatus,
  { label: string; tone: "green" | "amber" | "red" | "neutral" }
> = {
  provided: { label: "제공", tone: "green" },
  partial: { label: "부분", tone: "amber" },
  absent: { label: "없음", tone: "red" },
  unclear: { label: "불명확", tone: "neutral" },
};

export const CONTENT_FREE_META: Record<
  ContentFreeScope,
  { label: string; tone: "green" | "amber" | "neutral" }
> = {
  all: { label: "전체 무상", tone: "green" },
  partial: { label: "일부/조건부", tone: "amber" },
  unclear: { label: "명시 불충분", tone: "neutral" },
};
