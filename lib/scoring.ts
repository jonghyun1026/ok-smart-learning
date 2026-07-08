import { getSupabaseClient } from "@/lib/supabase";
import type { CriteriaRow, EvaluationSettingsRow } from "@/lib/supabase";

/**
 * 평가기준 자유편집(docs/schema.md 2.5절) 대응.
 *
 * 이전 버전은 /data/criteria.json을 빌드타임에 정적 import해서 배점 상수를 만들었지만,
 * 이제 관리자가 Supabase의 criteria/evaluation_settings 테이블을 직접 CRUD할 수 있어야
 * 하므로 모든 배점·합계·기준값은 "저장하지 않고 매번 다시 계산"한다.
 *
 * 서버 컴포넌트는 getCriteriaData()를 직접 호출하고, 클라이언트 컴포넌트는
 * GET /api/criteria (buildCriteriaData의 결과를 그대로 JSON 직렬화)를 fetch해서
 * 동일한 CriteriaData 셰이프를 얻은 뒤 아래 순수 계산 함수들에 넘긴다.
 */

export type CriteriaItemType = "pass_fail" | "score" | "price";

export type CriteriaItem = {
  itemNo: string;
  areaCode: string;
  areaName: string;
  itemName: string;
  itemType: CriteriaItemType;
  maxPoints: number | null;
  docReference: string | null;
  sortOrder: number;
};

export type CriteriaArea = {
  code: string;
  /** 영역 내 모든 항목이 pass_fail이면 "pass_fail", 하나라도 score/price가 있으면 "score" */
  name: string;
  type: "pass_fail" | "score";
  /** score/price 항목 max_points 합 (pass_fail 항목은 0으로 취급) */
  maxPoints: number;
  items: CriteriaItem[];
};

export type EvaluationSettings = {
  negotiationThreshold: number;
  tiebreakAreaCodes: string[];
};

export type CriteriaData = {
  areas: CriteriaArea[];
  items: CriteriaItem[];
  settings: EvaluationSettings;
  /** item_no -> max_points (score/price 타입만) */
  itemMaxPoints: Record<string, number>;
  /** item_type === 'price' 인 item_no 목록 (하드코딩 "17" 대신 동적 식별) */
  priceItemNos: string[];
  /** item_type === 'score' 인 항목이 하나라도 있는 영역 코드 (가격 영역 제외) */
  technicalAreaCodes: string[];
  /** item_type === 'price' 인 항목이 있는 영역 코드 */
  priceAreaCodes: string[];
  /** 필수자격을 제외한 채점 대상 영역 (score 타입 영역, 가격 포함) */
  scoreAreaCodes: string[];
  /** 전체 합계 (score+price max_points 합, pass_fail 제외) */
  grandTotalPoints: number;
  /** 기술평가 합계 (score 타입 항목 max_points 합) */
  technicalTotalPoints: number;
  /** 가격평가 합계 (price 타입 항목 max_points 합) */
  priceTotalPoints: number;
  /** 평가입력 화면에서 실제 숫자 입력을 받는 항목 (score 타입만, 가격/필수자격 제외) */
  manualScoreItemNos: string[];
};

const DEFAULT_SETTINGS: EvaluationSettings = {
  negotiationThreshold: 85,
  tiebreakAreaCodes: ["PRICE"],
};

/** criteria 테이블 원본 행 + evaluation_settings 행을 받아 런타임 계산 상수를 조립한다. */
export function buildCriteriaData(
  rows: CriteriaRow[],
  settingsRow?: Pick<EvaluationSettingsRow, "negotiation_threshold" | "tiebreak_area_codes"> | null
): CriteriaData {
  const sorted = [...rows].sort((a, b) => a.sort_order - b.sort_order);

  const items: CriteriaItem[] = sorted.map((r) => ({
    itemNo: r.item_no,
    areaCode: r.area_code,
    areaName: r.area_name,
    itemName: r.item_name,
    itemType: r.item_type,
    maxPoints: r.max_points,
    docReference: r.doc_reference,
    sortOrder: r.sort_order,
  }));

  const areaOrder: string[] = [];
  const areaMap = new Map<string, CriteriaArea>();
  for (const item of items) {
    let area = areaMap.get(item.areaCode);
    if (!area) {
      area = { code: item.areaCode, name: item.areaName, type: "pass_fail", maxPoints: 0, items: [] };
      areaMap.set(item.areaCode, area);
      areaOrder.push(item.areaCode);
    }
    area.items.push(item);
    area.name = item.areaName;
  }

  const areas = areaOrder.map((code) => areaMap.get(code)!);
  for (const area of areas) {
    const hasScored = area.items.some((i) => i.itemType === "score" || i.itemType === "price");
    area.type = hasScored ? "score" : "pass_fail";
    area.maxPoints = area.items.reduce(
      (sum, i) => sum + (i.itemType !== "pass_fail" && typeof i.maxPoints === "number" ? i.maxPoints : 0),
      0
    );
  }

  const itemMaxPoints: Record<string, number> = {};
  for (const item of items) {
    if (item.itemType !== "pass_fail" && typeof item.maxPoints === "number") {
      itemMaxPoints[item.itemNo] = item.maxPoints;
    }
  }

  const priceItemNos = items.filter((i) => i.itemType === "price").map((i) => i.itemNo);
  const priceAreaCodesSet = new Set(items.filter((i) => i.itemType === "price").map((i) => i.areaCode));
  const priceAreaCodes = Array.from(priceAreaCodesSet);
  const technicalAreaCodes = areas
    .filter((a) => a.type === "score" && !priceAreaCodesSet.has(a.code))
    .map((a) => a.code);
  const scoreAreaCodes = areas.filter((a) => a.type === "score").map((a) => a.code);
  const manualScoreItemNos = items.filter((i) => i.itemType === "score").map((i) => i.itemNo);

  const technicalTotalPoints = items.reduce(
    (sum, i) => sum + (i.itemType === "score" && typeof i.maxPoints === "number" ? i.maxPoints : 0),
    0
  );
  const priceTotalPoints = items.reduce(
    (sum, i) => sum + (i.itemType === "price" && typeof i.maxPoints === "number" ? i.maxPoints : 0),
    0
  );
  const grandTotalPoints = technicalTotalPoints + priceTotalPoints;

  const settings: EvaluationSettings = settingsRow
    ? {
        negotiationThreshold: Number(settingsRow.negotiation_threshold),
        tiebreakAreaCodes: Array.isArray(settingsRow.tiebreak_area_codes)
          ? settingsRow.tiebreak_area_codes
          : DEFAULT_SETTINGS.tiebreakAreaCodes,
      }
    : DEFAULT_SETTINGS;

  return {
    areas,
    items,
    settings,
    itemMaxPoints,
    priceItemNos,
    technicalAreaCodes,
    priceAreaCodes,
    scoreAreaCodes,
    grandTotalPoints,
    technicalTotalPoints,
    priceTotalPoints,
    manualScoreItemNos,
  };
}

/**
 * Supabase에서 criteria 전체 + evaluation_settings(id=1)을 조회해 CriteriaData를 조립한다.
 * 서버 컴포넌트(`/`, `/criteria`)와 서버 라우트(API)에서 직접 호출한다.
 * 클라이언트 컴포넌트는 이 함수를 그대로 노출하는 GET /api/criteria를 fetch해서 사용한다.
 */
export async function getCriteriaData(): Promise<CriteriaData> {
  const supabase = getSupabaseClient();
  const [{ data: criteriaRows, error: criteriaError }, { data: settingsRow, error: settingsError }] =
    await Promise.all([
      supabase.from("criteria").select("*").order("sort_order", { ascending: true }),
      supabase.from("evaluation_settings").select("*").eq("id", 1).maybeSingle(),
    ]);

  if (criteriaError) throw new Error(criteriaError.message);
  if (settingsError) throw new Error(settingsError.message);

  return buildCriteriaData((criteriaRows ?? []) as CriteriaRow[], settingsRow ?? null);
}

/** 0~max 범위로 점수를 clamp (소수 1자리까지 허용) */
export function clampScore(data: CriteriaData, itemNo: string, value: number): number {
  const max = data.itemMaxPoints[itemNo];
  if (max === undefined) return 0;
  if (Number.isNaN(value)) return 0;
  return Math.min(Math.max(value, 0), max);
}

/**
 * 입찰가격 환산 점수 = priceTotalPoints × 최저입찰가 ÷ 해당업체입찰가, 소수 둘째자리 반올림, 상한 priceTotalPoints.
 */
export function calcPriceScore(
  data: CriteriaData,
  companyBidPrice: number,
  lowestBidPrice: number
): number {
  if (!companyBidPrice || companyBidPrice <= 0 || !lowestBidPrice || lowestBidPrice <= 0) {
    return 0;
  }
  const raw = (data.priceTotalPoints * lowestBidPrice) / companyBidPrice;
  const rounded = Math.round(raw * 100) / 100;
  return Math.min(rounded, data.priceTotalPoints);
}

/** scores(item_no -> 점수) 중 특정 영역(area_code)의 소계 */
export function calcAreaSubtotal(
  data: CriteriaData,
  scores: Record<string, number>,
  areaCode: string
): number {
  const area = data.areas.find((a) => a.code === areaCode);
  if (!area) return 0;
  return area.items.reduce((sum, item) => {
    if (item.itemType === "pass_fail") return sum;
    const v = scores[item.itemNo];
    return sum + (typeof v === "number" && !Number.isNaN(v) ? v : 0);
  }, 0);
}

/** 기술평가 합계 (가격 영역 제외한 score 영역들의 합) */
export function calcTechnicalTotal(data: CriteriaData, scores: Record<string, number>): number {
  return data.technicalAreaCodes.reduce((sum, code) => sum + calcAreaSubtotal(data, scores, code), 0);
}

/**
 * 평가입력 화면 저장 시 사용하는 종합 계산.
 * manualScores에는 가격 항목을 포함하지 않아도 되며, 가격 항목은 bidPrice/lowestBidPrice로
 * 자동 계산해 채워 넣는다. (가격항목이 여러 개인 경우 동일한 환산점수를 모두 배정 —
 * 설계상 가격 타입 항목은 1개를 가정한다.)
 */
export function calcTotals(
  data: CriteriaData,
  params: {
    manualScores: Record<string, number>;
    companyBidPrice: number;
    lowestBidPrice: number;
  }
) {
  const priceScore = calcPriceScore(data, params.companyBidPrice, params.lowestBidPrice);
  const scoresWithPrice: Record<string, number> = { ...params.manualScores };
  for (const no of data.priceItemNos) {
    scoresWithPrice[no] = priceScore;
  }

  const technicalTotal = calcTechnicalTotal(data, scoresWithPrice);
  const priceTotal = data.priceAreaCodes.reduce(
    (sum, code) => sum + calcAreaSubtotal(data, scoresWithPrice, code),
    0
  );
  const totalScore = Math.round((technicalTotal + priceTotal) * 100) / 100;

  const areaSubtotals: Record<string, number> = {};
  for (const area of data.areas) {
    if (area.type === "score") {
      areaSubtotals[area.code] = calcAreaSubtotal(data, scoresWithPrice, area.code);
    }
  }

  return {
    scores: scoresWithPrice,
    areaSubtotals,
    technicalTotal: Math.round(technicalTotal * 100) / 100,
    priceTotal: Math.round(priceTotal * 100) / 100,
    totalScore,
  };
}

export function isNegotiationQualified(
  data: CriteriaData,
  totalScore: number | null | undefined,
  qualificationPass: boolean | null | undefined
): boolean {
  return (
    qualificationPass === true &&
    typeof totalScore === "number" &&
    totalScore >= data.settings.negotiationThreshold
  );
}

/**
 * 총점 내림차순 정렬. 동점 시 settings.tiebreakAreaCodes 순서로 areaScores 값을 비교해 재정렬한다.
 * areaScores가 없으면 동점 그대로 둔다.
 */
export function rankCompanies<
  T extends { totalScore: number | null | undefined; areaScores?: Partial<Record<string, number>> }
>(data: CriteriaData, items: T[]): T[] {
  return [...items].sort((a, b) => {
    const at = a.totalScore ?? -Infinity;
    const bt = b.totalScore ?? -Infinity;
    if (bt !== at) return bt - at;
    for (const areaCode of data.settings.tiebreakAreaCodes) {
      const av = a.areaScores?.[areaCode] ?? 0;
      const bv = b.areaScores?.[areaCode] ?? 0;
      if (bv !== av) return bv - av;
    }
    return 0;
  });
}
