import type { CriteriaRow } from "@/lib/supabase";

/**
 * 평가기준 관리 API(app/api/criteria/**)에서 공용으로 쓰는 생성 규칙 헬퍼.
 * criteria 테이블에는 별도 "영역" 테이블이 없고 area_code는 criteria 행에 딸린
 * 값이므로, 새 영역을 만들 때는 해당 area_code를 가진 첫 항목을 함께 생성한다.
 */

/** 기존 item_no 중 숫자로 시작하는 값의 최댓값 + 1 을 다음 item_no로 사용한다 (기존 "1".."17" 규칙과 호환) */
export function nextItemNo(existing: CriteriaRow[]): string {
  let max = 0;
  for (const row of existing) {
    const parsed = parseInt(row.item_no, 10);
    if (Number.isFinite(parsed) && parsed > max) max = parsed;
  }
  return String(max + 1);
}

export function nextSortOrder(existing: CriteriaRow[]): number {
  let max = -1;
  for (const row of existing) {
    if (row.sort_order > max) max = row.sort_order;
  }
  return max + 1;
}

/** 한글/공백 포함 영역명으로부터 area_code를 자동 생성하고, 기존 코드와 중복되지 않게 접미사를 붙인다. */
export function generateAreaCode(areaName: string, existingCodes: Set<string>): string {
  const base =
    areaName
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "AREA";

  let candidate = base;
  let suffix = 1;
  while (existingCodes.has(candidate)) {
    suffix += 1;
    candidate = `${base}_${suffix}`;
  }
  return candidate;
}
