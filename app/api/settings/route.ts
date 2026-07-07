import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { getCriteriaData } from "@/lib/scoring";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getCriteriaData();
    return NextResponse.json({ settings: data.settings });
  } catch (err) {
    const message = err instanceof Error ? err.message : "설정 조회 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** negotiation_threshold / tiebreak_area_codes 수정. */
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const update: Record<string, unknown> = {};

  if (body.negotiationThreshold !== undefined) {
    const threshold = Number(body.negotiationThreshold);
    if (Number.isNaN(threshold) || threshold < 0 || threshold > 100) {
      return NextResponse.json(
        { error: "negotiationThreshold는 0~100 사이의 숫자여야 합니다." },
        { status: 400 }
      );
    }
    update.negotiation_threshold = threshold;
  }
  if (body.tiebreakAreaCodes !== undefined) {
    if (!Array.isArray(body.tiebreakAreaCodes) || !body.tiebreakAreaCodes.every((v: unknown) => typeof v === "string")) {
      return NextResponse.json({ error: "tiebreakAreaCodes는 문자열 배열이어야 합니다." }, { status: 400 });
    }
    update.tiebreak_area_codes = body.tiebreakAreaCodes;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "수정할 필드가 없습니다." }, { status: 400 });
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.from("evaluation_settings").update(update).eq("id", 1);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const data = await getCriteriaData();
  return NextResponse.json({ data });
}
