import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { DOC_TYPE_LABELS } from "@/lib/documentTypes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * 제출서류 업로드 완료 처리 (docs/schema.md 2.7.2절).
 * 파일 바이트는 브라우저에서 Supabase Storage로 직접 업로드하고(용량이 커도 Vercel
 * Functions의 요청 본문 하드 리밋(~4.5MB)에 걸리지 않도록), 이 엔드포인트는 업로드가
 * 끝난 뒤 결과 URL만 받아 companies 테이블에 기록한다.
 *
 * JSON body: { companyId, docType(선택, 기본값 "proposal"), fileUrl, fileName }
 * - docType === "proposal": companies.proposal_file_url/proposal_file_name 갱신(하위호환)
 * - 그 외 6종: companies.documents[한글라벨]에 { fileUrl, fileName, uploadedAt }을 append
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const companyId = body?.companyId;
  const docTypeRaw = body?.docType;
  const fileUrl = body?.fileUrl;
  const fileName = body?.fileName;
  const docType = typeof docTypeRaw === "string" && docTypeRaw.trim() ? docTypeRaw.trim() : "proposal";

  if (
    typeof companyId !== "string" || !companyId ||
    typeof fileUrl !== "string" || !fileUrl ||
    typeof fileName !== "string" || !fileName
  ) {
    return NextResponse.json({ error: "companyId, fileUrl, fileName은 필수입니다." }, { status: 400 });
  }

  const isProposal = docType === "proposal";
  const docLabel = isProposal ? null : DOC_TYPE_LABELS[docType];
  if (!isProposal && !docLabel) {
    return NextResponse.json({ error: `알 수 없는 docType입니다: ${docType}` }, { status: 400 });
  }

  const supabase = getSupabaseClient();

  if (isProposal) {
    const { data: company, error: updateError } = await supabase
      .from("companies")
      .update({ proposal_file_url: fileUrl, proposal_file_name: fileName })
      .eq("id", companyId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    return NextResponse.json({ company });
  }

  // 6종 서류: 기존 documents jsonb의 다른 키를 보존한 채 해당 라벨 키만 부분 업데이트.
  // 슬롯당 여러 파일을 허용하므로 값은 배열이며, 기존 파일 목록에 새 파일을 추가(append)한다.
  const { data: existing, error: fetchError } = await supabase
    .from("companies")
    .select("documents")
    .eq("id", companyId)
    .single();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const documents = { ...(existing?.documents as Record<string, unknown> | null) };
  const prevValue = documents[docLabel as string];
  // 과거 단일 객체({fileUrl,...}) 또는 legacy boolean(true)만 있던 슬롯도 배열로 전환한다.
  const prevList = Array.isArray(prevValue)
    ? prevValue
    : prevValue && typeof prevValue === "object" && "fileUrl" in (prevValue as Record<string, unknown>)
      ? [prevValue]
      : [];
  documents[docLabel as string] = [
    ...prevList,
    { fileUrl, fileName, uploadedAt: new Date().toISOString() },
  ];

  const { data: company, error: updateError } = await supabase
    .from("companies")
    .update({ documents })
    .eq("id", companyId)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ company });
}
