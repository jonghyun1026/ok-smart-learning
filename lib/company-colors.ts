/**
 * 업체 비교(레이더 차트 등)에 쓰는 categorical 팔레트.
 *
 * `dataviz` 스킬의 6-체크(밝기 밴드/채도/CVD 분리/대비)를 통과하도록 검증된 순서다:
 * `node scripts/validate_palette.js "#F04E23,#2a78d6,#1baf7a,#4a3aa7,#eda100,#e34948,#008300,#e87ba4" --mode light`
 * 상위 5색은 --pairs all 기준으로도 PASS(최소 인접 ΔE 16.6), 6번째부터는 WARN 플로어 밴드라
 * 범례(legend)를 항상 함께 표시하는 것으로 보완한다(레이더 차트는 범례를 항상 켜둔다).
 *
 * 슬롯 1은 OK 브랜드 오렌지(#F04E23)로 고정해 이 프로젝트의 브랜드 톤과 맞추고, 이후 슬롯은
 * 업체 식별(카테고리컬) 목적이므로 순위가 아니라 "화면에 처음 등장한 순서"로 고정 배정한다
 * (필터로 업체를 껐다 켜도 같은 업체는 항상 같은 색을 유지해야 하므로).
 */
export const COMPANY_CHART_COLORS = [
  "#F04E23", // OK 브랜드 오렌지
  "#2a78d6", // blue
  "#1baf7a", // aqua/green
  "#4a3aa7", // violet
  "#eda100", // yellow
  "#e34948", // red
  "#008300", // green
  "#e87ba4", // magenta
];

export function getCompanyColor(index: number): string {
  return COMPANY_CHART_COLORS[index % COMPANY_CHART_COLORS.length];
}
