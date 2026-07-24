/**
 * 업체 비교(레이더 차트, 콘텐츠 세로막대, 히트맵 점, 순위 카드 등)에 쓰는 categorical 팔레트.
 *
 * 2026-07-24 사용자 요청 "색상을 최대한 OK 색상으로" 반영 — OK 브랜드(오렌지·골드) 중심으로
 * 재구성했다. 앞 두 슬롯을 **OK 오렌지(#F55000) + 골드브론즈(#8A5A00)**로 두어 전형적인 2개
 * 업체 비교(예: 유밥·휴넷)가 완전히 OK 난색으로 그려지게 했다. 이 두 색은 색상환에서 가까워
 * 색맹(protan) 분리 ΔE가 7.4로 6~8 "floor band"에 있지만, 이 앱의 모든 비교 차트는 색 이외에
 * 범례·업체명 라벨·색 점·값 직접표기 같은 2차 부호화를 항상 함께 제공하므로 규칙상 허용된다
 * (dataviz 검증 스크립트 6검사 전체 PASS 확인:
 *  `node scripts/validate_palette.js "#F55000,#8A5A00,#0D9488,#7C3AED,#DB2777,#0891B2" --mode light`).
 * 3개 업체 이상일 때만 쓰이는 뒤쪽 슬롯은 난색끼리 구분이 어려운 근본 한계 때문에 검증된
 * 구분색(teal·violet·magenta·cyan)으로 채웠다.
 *
 * 업체 식별(카테고리컬) 목적이므로 순위가 아니라 "화면에 처음 등장한 순서(company_id 정렬)"로
 * 고정 배정한다 — 필터로 업체를 껐다 켜도 같은 업체는 항상 같은 색을 유지한다. 범례를 항상
 * 함께 표시하는 것으로 색만으로 식별하지 않게 보완한다.
 */
export const COMPANY_CHART_COLORS = [
  "#F55000", // OK Orange
  "#8A5A00", // 골드브론즈 (OK 난색 계열)
  "#0D9488", // teal
  "#7C3AED", // violet
  "#DB2777", // magenta
  "#0891B2", // cyan
];

/**
 * 특정 업체는 실제 OK 브랜드 토큰으로 고정한다 (2026-07-24 요청: 유밥=OK Yellow,
 * 휴넷=OK Dark Brown). 사용자가 채도·명도 하한/대비 검증은 신경 쓰지 말고 브랜드 색을 그대로
 * 쓰라고 명시함. 이름으로 매칭하므로 등장 순서/정렬과 무관하게 어느 화면에서든 같은 색을 유지.
 */
const NAMED_COMPANY_COLORS: { test: RegExp; color: string }[] = [
  { test: /유밥|ubob/i, color: "#FFAA00" }, // OK Yellow
  { test: /휴넷|hunet/i, color: "#55474A" }, // OK Dark Brown
];

export function getCompanyColor(index: number, name?: string): string {
  if (name) {
    const hit = NAMED_COMPANY_COLORS.find((x) => x.test.test(name));
    if (hit) return hit.color;
  }
  return COMPANY_CHART_COLORS[index % COMPANY_CHART_COLORS.length];
}
