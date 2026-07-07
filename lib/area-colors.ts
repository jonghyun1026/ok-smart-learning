/**
 * 영역별 표시 색상 팔레트. 관리자가 영역을 자유롭게 추가/삭제할 수 있어 영역 코드가
 * 고정돼 있지 않으므로, 화면에 그려지는 순서(area index)에 따라 순환 배정한다.
 */
export const AREA_COLOR_PALETTE = [
  "#F04E23", // brand orange
  "#2E7D32", // green
  "#2563EB", // blue
  "#FF9900", // amber
  "#7C3AED", // violet
  "#0891B2", // cyan
  "#C6362B", // red
  "#B45309", // brown/amber-dark
];

export function getAreaColor(index: number): string {
  return AREA_COLOR_PALETTE[index % AREA_COLOR_PALETTE.length];
}
