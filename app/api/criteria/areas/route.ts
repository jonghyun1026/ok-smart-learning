import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import type { CriteriaRow } from "@/lib/supabase";
import { getCriteriaData } from "@/lib/scoring";
import { generateAreaCode, nextItemNo, nextSortOrder } from "@/lib/criteria-admin";

export const dynamic = "force-dynamic";

/**
 * 새 평가 영역 추가.
 *
 * criteria 테이블에는 별도의 "영역" 테이블이 없어 area_code는 항상 criteria 행에
 * 딸려서만 존재한다. 따라서 "빈 영역"을 만들 수 없고, 요청받은 item_type의
 * 시드 항목 1개를 함께 생성해서 영역이 즉시 화면에 나타나도록 한다.
 * (이후 관리자가 이 시드 항목을 이름/배점 수정하거나 삭제/추가할 수 있다.)
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const areaName = typeof body.areaName === "string" ? body.areaName.trim() : "";
  const itemType = body.itemType as CriteriaRow["item_type"] | undefined;
  const requestedCode =
    typeof body.areaCode === "string" && body.areaCode.trim().length > 0
      ? body.areaCode.trim().toUpperCase()
      : undefined;

  if (!areaName) {
    return NextResponse.json({ error: "영역명은 필수입니다." }, { status: 400 });
  }
  if (itemType !== "pass_fail" && itemType !== "score" && itemType !== "price") {
    return NextResponse.json(
      { error: "item_type은 pass_fail | score | price 중 하나여야 합니다." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseClient();
  const { data: existingRows, error: fetchError } = await supabase.from("criteria").select("*");
  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  const rows = (existingRows ?? []) as CriteriaRow[];
  const existingCodes = new Set(rows.map((r) => r.area_code));

  let areaCode: string;
  if (requestedCode) {
    if (existingCodes.has(requestedCode)) {
      return NextResponse.json({ error: `이미 존재하는 영역 코드입니다: ${requestedCode}` }, { status: 409 });
    }
    areaCode = requestedCode;
  } else {
    areaCode = generateAreaCode(areaName, existingCodes);
  }

  const itemNo = nextItemNo(rows);
  const sortOrder = nextSortOrder(rows);

  const { error: insertError } = await supabase.from("criteria").insert({
    item_no: itemNo,
    area_code: areaCode,
    area_name: areaName,
    item_name: "새 항목 1",
    item_type: itemType,
    max_points: itemType === "pass_fail" ? null : 0,
    doc_reference: "",
    sort_order: sortOrder,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const data = await getCriteriaData();
  return NextResponse.json({ data, areaCode }, { status: 201 });
}
