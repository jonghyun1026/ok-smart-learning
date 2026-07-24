/**
 * 영역별 표시 색상 팔레트(평가개요 배점 구성·평가 구성 비율, 세부평가기준·평가입력 영역 액센트).
 * 관리자가 영역을 자유롭게 추가/삭제할 수 있어 영역 코드가 고정돼 있지 않으므로, 화면에
 * 그려지는 순서(area index)에 따라 순환 배정한다.
 *
 * 2026-07-24 "평가 구성 비율 색상도 OK 색상 위주로" 반영 — OK 브랜드 난색(오렌지·옐로·다크브라운·
 * 골드·ochre·brown2)으로 구성했다. 사용자가 채도·대비 검증 제약은 신경 쓰지 말고 브랜드 색을
 * 그대로 쓰라고 명시함(색만으로 구분하지 않도록 각 화면에 영역명·수치 라벨을 항상 병기).
 */
export const AREA_COLOR_PALETTE = [
  "#F55000", // OK Orange
  "#FFAA00", // OK Yellow
  "#55474A", // OK Dark Brown
  "#8A5A00", // 골드브론즈
  "#B45309", // ochre
  "#6C5C60", // OK Brown 2 (모브-토프)
];

export function getAreaColor(index: number): string {
  return AREA_COLOR_PALETTE[index % AREA_COLOR_PALETTE.length];
}
