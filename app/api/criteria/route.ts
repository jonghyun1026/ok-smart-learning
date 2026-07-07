import { NextResponse } from "next/server";
import { getCriteriaData } from "@/lib/scoring";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getCriteriaData();
    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "평가기준 조회 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
