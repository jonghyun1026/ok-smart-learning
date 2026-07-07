import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { getCriteriaData } from "@/lib/scoring";

export const dynamic = "force-dynamic";

/** 항목 수정 (이름/배점/확인서류). item_type/area_code 변경은 지원하지 않는다 — 필요 시 삭제 후 재생성. */
export async function PATCH(req: NextRequest, { params }: { params: { itemNo: string } }) {
  const body = await req.json();
  const update: Record<string, unknown> = {};

  if (typeof body.itemName === "string" && body.itemName.trim().length > 0) {
    update.item_name = body.itemName.trim();
  }
  if (body.maxPoints !== undefined) {
    const maxPoints = body.maxPoints === null ? null : Number(body.maxPoints);
    if (maxPoints !== null && (Number.isNaN(maxPoints) || maxPoints < 0)) {
      return NextResponse.json({ error: "maxPoints는 0 이상의 숫자여야 합니다." }, { status: 400 });
    }
    update.max_points = maxPoints;
  }
  if (typeof body.docReference === "string") {
    update.doc_reference = body.docReference;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "수정할 필드가 없습니다." }, { status: 400 });
  }

  const supabase = getSupabaseClient();
  const { data: updated, error } = await supabase
    .from("criteria")
    .update(update)
    .eq("item_no", params.itemNo)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: `존재하지 않는 항목입니다: ${params.itemNo}` }, { status: 404 });
  }

  const data = await getCriteriaData();
  return NextResponse.json({ data });
}

export async function DELETE(_req: NextRequest, { params }: { params: { itemNo: string } }) {
  const supabase = getSupabaseClient();
  const { data: deleted, error } = await supabase
    .from("criteria")
    .delete()
    .eq("item_no", params.itemNo)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!deleted || deleted.length === 0) {
    return NextResponse.json({ error: `존재하지 않는 항목입니다: ${params.itemNo}` }, { status: 404 });
  }

  const data = await getCriteriaData();
  return NextResponse.json({ data });
}
