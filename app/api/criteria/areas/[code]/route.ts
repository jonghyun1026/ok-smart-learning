import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { getCriteriaData } from "@/lib/scoring";

export const dynamic = "force-dynamic";

/** 영역명 변경 — area_code가 같은 모든 criteria 행의 area_name을 함께 갱신한다 (비정규화 컬럼). */
export async function PATCH(req: NextRequest, { params }: { params: { code: string } }) {
  const body = await req.json();
  const areaName = typeof body.areaName === "string" ? body.areaName.trim() : "";
  if (!areaName) {
    return NextResponse.json({ error: "영역명은 필수입니다." }, { status: 400 });
  }

  const supabase = getSupabaseClient();
  const { data: updated, error } = await supabase
    .from("criteria")
    .update({ area_name: areaName })
    .eq("area_code", params.code)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: `존재하지 않는 영역입니다: ${params.code}` }, { status: 404 });
  }

  const data = await getCriteriaData();
  return NextResponse.json({ data });
}

/** 영역 삭제 — 해당 영역의 모든 항목을 criteria 테이블에서 제거한다 (evaluations.scores 내 값은 그대로 둠). */
export async function DELETE(_req: NextRequest, { params }: { params: { code: string } }) {
  const supabase = getSupabaseClient();
  const { data: deleted, error } = await supabase
    .from("criteria")
    .delete()
    .eq("area_code", params.code)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!deleted || deleted.length === 0) {
    return NextResponse.json({ error: `존재하지 않는 영역입니다: ${params.code}` }, { status: 404 });
  }

  const data = await getCriteriaData();
  return NextResponse.json({ data });
}
