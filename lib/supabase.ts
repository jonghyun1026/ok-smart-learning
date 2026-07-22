import { createClient } from "@supabase/supabase-js";
import type { ComparisonFacts } from "@/lib/comparison";

// NOTE: 이 단계는 인증이 없고 RLS도 의도적으로 비활성 상태다 (CLAUDE.md 참조).
// service_role key는 발급받지 않았으므로 서버 사이드(Route Handler)에서도
// anon key를 그대로 사용한다. 인증 도입 시 반드시 RLS를 활성화하고
// 서버 전용 service_role key로 교체해야 한다.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase 환경변수가 설정되지 않았습니다. .env.local의 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 를 확인하세요."
  );
}

/**
 * 브라우저(클라이언트 컴포넌트)와 서버(Route Handler) 양쪽에서 공용으로 사용하는
 * Supabase 클라이언트. RLS가 비활성 상태이므로 anon key로 모든 CRUD가 가능하다.
 *
 * Next.js는 서버에서 실행되는 모든 fetch() 호출(라이브러리 내부 호출 포함)을 자동으로
 * 패치해 기본적으로 캐시하려 든다. supabase-js도 내부적으로 fetch를 사용하므로,
 * 관리자가 평가기준을 수정한 직후에도 이전 응답이 캐시되어 반환되는 문제가 있었다.
 * global.fetch를 명시적으로 cache: "no-store"로 감싸 항상 최신 데이터를 조회하도록 한다.
 */
export function getSupabaseClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, { ...init, cache: "no-store" }),
    },
  });
}

/**
 * 제출서류 1건의 업로드 정보 (docs/schema.md 2.7절).
 * evaluation-agent가 documents[한글라벨].fileUrl을 읽으므로 이 shape을 유지해야 한다.
 */
export type DocumentUpload = {
  fileUrl: string;
  fileName: string;
  uploadedAt: string;
};

export type Company = {
  id: string;
  name: string;
  bid_price: number;
  /**
   * 제출서류 체크리스트. 값은 네 가지 중 하나일 수 있다:
   * - `DocumentUpload[]`: 실제 파일이 1개 이상 업로드된 신규 방식(2026-07-22부터, 다중 업로드 허용)
   * - `{ fileUrl, fileName, uploadedAt }`: 다중 업로드 이전에 단일 파일로 저장된 값(하위호환용)
   * - `true`: 과거 시딩된 legacy 값(파일 없이 체크만 됨, 하위호환용)
   * - `undefined`: 아직 제출되지 않음
   * `__qualification` 예약 키만 별도 shape(`{ q1, q2 }`)을 갖는다.
   */
  documents: Record<string, boolean | DocumentUpload | DocumentUpload[] | { q1: string; q2: string } | undefined> | null;
  proposal_file_url: string | null;
  proposal_file_name: string | null;
  qualification_pass: boolean | null;
  created_at: string;
  updated_at: string;
};

/** docs/schema.md 2.6절: AI 평가 에이전트가 생성하는 초안. company_id당 1행(재실행 시 덮어씀). */
export type AiEvaluationDraft = {
  id: string;
  company_id: string;
  model: string;
  item_scores: Record<string, { score: number; rationale: string }>;
  overall_summary: string | null;
  /**
   * 제안서에서 추출한 구조화된 비교 사실 (docs/schema.md 2.8절). "비교 진단" 뷰가 렌더한다.
   * 컬럼 추가(2026-07-22) 이전 초안이나 아직 재평가하지 않은 초안은 null일 수 있으므로
   * 렌더 측에서 항상 null 체크한다.
   */
  comparison_facts: ComparisonFacts | null;
  status: "pending" | "completed" | "failed";
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type CriteriaRow = {
  id: string;
  item_no: string;
  area_code: string;
  area_name: string;
  item_name: string;
  item_type: "pass_fail" | "score" | "price";
  max_points: number | null;
  doc_reference: string | null;
  sort_order: number;
};

export type EvaluationSettingsRow = {
  id: number;
  negotiation_threshold: number;
  tiebreak_area_codes: string[];
  updated_at: string;
};

export type Evaluation = {
  id: string;
  company_id: string;
  evaluator_id: string;
  scores: Record<string, number>;
  technical_total: number;
  price_total: number;
  total_score: number;
  created_at: string;
  updated_at: string;
};

export type ResultsViewRow = {
  company_id: string;
  company_name: string;
  bid_price: number;
  qualification_pass: boolean | null;
  evaluator_count: number;
  avg_technical_score: number | null;
  avg_price_score: number | null;
  avg_total_score: number | null;
  is_negotiation_qualified: boolean;
};

/**
 * evaluations 테이블에 (company_id, evaluator_id) 유니크 키 기준으로 upsert.
 * 동시 쓰기 충돌 방지를 위해 ON CONFLICT DO UPDATE를 사용한다 (schema.md 참조).
 */
export async function upsertEvaluation(params: {
  companyId: string;
  evaluatorId: string;
  scores: Record<string, number>;
  technicalTotal: number;
  priceTotal: number;
  totalScore: number;
}) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("evaluations")
    .upsert(
      {
        company_id: params.companyId,
        evaluator_id: params.evaluatorId,
        scores: params.scores,
        technical_total: params.technicalTotal,
        price_total: params.priceTotal,
        total_score: params.totalScore,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "company_id,evaluator_id" }
    )
    .select()
    .single();

  if (error) throw error;
  return data as Evaluation;
}
