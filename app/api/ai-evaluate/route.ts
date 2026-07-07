import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import type { AiEvaluationDraft } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * docs/schema.md 2.6절 (2026-07-06 재설계): AI 채점은 더 이상 이 라우트의 POST(Anthropic API
 * 서버 호출)로 수행하지 않는다. 별도 API 키/과금 없이 로컬 `evaluation-agent` 서브에이전트
 * (`.claude/agents/evaluation-agent/AGENT.md`)가 사람이 Claude Code 세션에서 요청할 때
 * 실행되어 `ai_evaluation_drafts`에 직접 upsert한다.
 *
 * 이 GET 핸들러는 폐기되지 않았다 — `/evaluate` 페이지가 업체 선택 시 초안 유무를 조회하는 데
 * 그대로 사용하므로 반드시 유지한다. POST 핸들러(및 그 전용 의존성이던 @anthropic-ai/sdk,
 * mammoth, pdf-parse)는 제거했다.
 */
export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get("companyId");
  if (!companyId) {
    return NextResponse.json({ error: "companyId는 필수입니다." }, { status: 400 });
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("ai_evaluation_drafts")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ draft: (data as AiEvaluationDraft | null) ?? null });
}
