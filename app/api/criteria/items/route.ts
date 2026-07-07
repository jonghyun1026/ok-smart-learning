import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import type { CriteriaRow } from "@/lib/supabase";
import { getCriteriaData } from "@/lib/scoring";
import { nextItemNo, nextSortOrder } from "@/lib/criteria-admin";

export const dynamic = "force-dynamic";

/** 항목 추가 — area_code는 기존 영역 중 하나여야 한다 (해당 영역의 area_name을 그대로 상속). */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const areaCode = typeof body.areaCode === "string" ? body.areaCode.trim() : "";
  const itemName = typeof body.itemName === "string" ? body.itemName.trim() : "";
  const itemType = body.itemType as CriteriaRow["item_type"] | undefined;
  const maxPoints = body.maxPoints === null || body.maxPoints === undefined ? null : Number(body.maxPoints);
  const docReference = typeof body.docReference === "string" ? body.docReference : "";

  if (!areaCode || !itemName) {
    return NextResponse.json({ error: "areaCode와 itemName은 필수입니다." }, { status: 400 });
  }
  if (itemType !== "pass_fail" && itemType !== "score" && itemType !== "price") {
    return NextResponse.json(
      { error: "item_type은 pass_fail | score | price 중 하나여야 합니다." },
      { status: 400 }
    );
  }
  if (itemType !== "pass_fail" && (maxPoints === null || Number.isNaN(maxPoints) || maxPoints < 0)) {
    return NextResponse.json({ error: "score/price 항목은 0 이상의 배점(maxPoints)이 필요합니다." }, { status: 400 });
  }

  const supabase = getSupabaseClient();
  const { data: existingRows, error: fetchError } = await supabase.from("criteria").select("*");
  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  const rows = (existingRows ?? []) as CriteriaRow[];
  const areaRow = rows.find((r) => r.area_code === areaCode);
  if (!areaRow) {
    return NextResponse.json({ error: `존재하지 않는 영역입니다: ${areaCode}` }, { status: 404 });
  }

  const itemNo = nextItemNo(rows);
  const sortOrder =
    typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)
      ? body.sortOrder
      : nextSortOrder(rows);

  const { error: insertError } = await supabase.from("criteria").insert({
    item_no: itemNo,
    area_code: areaCode,
    area_name: areaRow.area_name,
    item_name: itemName,
    item_type: itemType,
    max_points: itemType === "pass_fail" ? null : maxPoints,
    doc_reference: docReference,
    sort_order: sortOrder,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const data = await getCriteriaData();
  return NextResponse.json({ data, itemNo }, { status: 201 });
}
