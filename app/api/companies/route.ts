import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ companies: data });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const bidPrice = Number(body.bidPrice);
  const proposalFileUrl =
    typeof body.proposalFileUrl === "string" && body.proposalFileUrl.trim().length > 0
      ? body.proposalFileUrl.trim()
      : null;
  const documents =
    body.documents && typeof body.documents === "object" ? body.documents : {};

  // qualification_pass: 두 항목 모두 Pass면 true, 하나라도 Fail이면 false, 그 외(미심사 포함)는 null
  const q1 = body.qualification1 as "pass" | "fail" | "unreviewed" | undefined;
  const q2 = body.qualification2 as "pass" | "fail" | "unreviewed" | undefined;
  let qualificationPass: boolean | null = null;
  if (q1 === "fail" || q2 === "fail") {
    qualificationPass = false;
  } else if (q1 === "pass" && q2 === "pass") {
    qualificationPass = true;
  } else {
    qualificationPass = null;
  }

  if (!name || !bidPrice || bidPrice <= 0) {
    return NextResponse.json(
      { error: "업체명과 입찰가격(양수)은 필수입니다." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("companies")
    .insert({
      name,
      bid_price: bidPrice,
      documents,
      proposal_file_url: proposalFileUrl,
      qualification_pass: qualificationPass,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ company: data }, { status: 201 });
}
