import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient, upsertEvaluation } from "@/lib/supabase";
import { calcTotals, clampScore, getCriteriaData } from "@/lib/scoring";

export const dynamic = "force-dynamic";

/** 동일 (companyId, evaluatorId) 조합의 기존 평가가 있으면 불러와 화면에 이어서 편집할 수 있게 한다. */
export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get("companyId");
  const evaluatorId = req.nextUrl.searchParams.get("evaluatorId");

  if (!companyId || !evaluatorId) {
    return NextResponse.json({ evaluation: null });
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("evaluations")
    .select("*")
    .eq("company_id", companyId)
    .eq("evaluator_id", evaluatorId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ evaluation: data ?? null });
}

/** 관리자가 잘못 입력되었거나 테스트용으로 저장된 평가 기록을 삭제한다. */
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const companyId = req.nextUrl.searchParams.get("companyId");
  const evaluatorId = req.nextUrl.searchParams.get("evaluatorId");

  if (!id && !(companyId && evaluatorId)) {
    return NextResponse.json(
      { error: "id 또는 companyId+evaluatorId 조합이 필요합니다." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseClient();
  let query = supabase.from("evaluations").delete().select();
  query = id ? query.eq("id", id) : query.eq("company_id", companyId!).eq("evaluator_id", evaluatorId!);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "삭제할 평가를 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const companyId = body.companyId as string | undefined;
  const evaluatorId = typeof body.evaluatorId === "string" ? body.evaluatorId.trim() : "";
  const rawScores = (body.scores ?? {}) as Record<string, number>;

  if (!companyId || !evaluatorId) {
    return NextResponse.json(
      { error: "companyId와 evaluatorId(평가자 이름)는 필수입니다." },
      { status: 400 }
    );
  }

  const criteriaData = await getCriteriaData();

  // 클라이언트 입력값을 항목별 배점 범위(0~max)로 서버에서 다시 clamp — 조작 방지
  const manualScores: Record<string, number> = {};
  for (const itemNo of criteriaData.manualScoreItemNos) {
    const v = Number(rawScores[itemNo]);
    manualScores[itemNo] = clampScore(criteriaData, itemNo, Number.isFinite(v) ? v : 0);
  }

  const supabase = getSupabaseClient();

  // 가격 환산 점수 계산을 위해 전체 업체 중 최저입찰가와 본 업체 입찰가를 조회
  const { data: companies, error: companiesError } = await supabase
    .from("companies")
    .select("id, bid_price");

  if (companiesError) {
    return NextResponse.json({ error: companiesError.message }, { status: 500 });
  }

  const target = companies?.find((c) => c.id === companyId);
  if (!target) {
    return NextResponse.json({ error: "업체를 찾을 수 없습니다." }, { status: 404 });
  }

  const validBidPrices = (companies ?? [])
    .map((c) => Number(c.bid_price))
    .filter((v) => Number.isFinite(v) && v > 0);
  const lowestBidPrice = validBidPrices.length > 0 ? Math.min(...validBidPrices) : 0;

  const totals = calcTotals(criteriaData, {
    manualScores,
    companyBidPrice: Number(target.bid_price) || 0,
    lowestBidPrice,
  });

  try {
    const evaluation = await upsertEvaluation({
      companyId,
      evaluatorId,
      scores: totals.scores,
      technicalTotal: totals.technicalTotal,
      priceTotal: totals.priceTotal,
      totalScore: totals.totalScore,
    });

    return NextResponse.json({ evaluation, totals });
  } catch (err) {
    const message = err instanceof Error ? err.message : "평가 저장 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
