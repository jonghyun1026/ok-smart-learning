/**
 * 제출서류 관련 상수. 클라이언트(관리자 등록 화면, Supabase Storage 직접 업로드)와
 * 서버(`/api/proposals/finalize`, DB 메타데이터 기록)가 공유한다.
 * docs/schema.md 2.7절/2.7.2절 참고.
 */

/** 제안서는 기존과 동일하게 pdf/docx만 허용하고, 스캔본 제출을 위해 이미지도 추가 허용한다. */
export const PROPOSAL_ALLOWED_EXTENSIONS = [".pdf", ".docx", ".jpg", ".jpeg", ".png"];
/** 그 외 서류는 실무에서 xlsx로 오는 경우가 있고(특히 재무제표), 스캔본 이미지도 흔해 추가로 허용한다. */
export const EXTRA_ALLOWED_EXTENSIONS = [".pdf", ".docx", ".xlsx", ".jpg", ".jpeg", ".png"];

/**
 * docType 슬러그 → companies.documents jsonb에 저장할 한글 라벨.
 * evaluation-agent(.claude/agents/evaluation-agent/AGENT.md)가 정확히 이 라벨 키로
 * documents[라벨].fileUrl을 읽으므로 오탈자가 없어야 한다 (docs/schema.md 2.7절).
 */
export const DOC_TYPE_LABELS: Record<string, string> = {
  business_registration: "사업자등록증",
  track_record: "사업수행실적증명서",
  price_bid: "가격입찰서",
  corporate_registry: "법인등기부등본 (말소포함, 최근 3개월 이내)",
  financial_statement: "재무제표 또는 부가가치과세증명원 (최근 2년)",
  team_roster: "참여인력 구성도",
};

/**
 * 2026-07-22: 파일 업로드를 Vercel 서버리스 함수 경유(byte proxy) 대신 브라우저에서
 * Supabase Storage로 직접 업로드하도록 바꿨다 — Vercel Functions의 요청 본문 하드 리밋
 * (약 4.5MB, 서버 코드로 늘릴 수 없음) 때문에 실제 스캔본 파일이 자주 막혔기 때문.
 * Storage 버킷 자체엔 별도 파일 크기 제한이 걸려있지 않지만(프로젝트 전역 기본값을 따름),
 * 과도하게 큰 파일 첨부를 막기 위한 넉넉한 클라이언트 측 상한.
 */
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
export const MAX_FILE_SIZE_LABEL = "50MB";
