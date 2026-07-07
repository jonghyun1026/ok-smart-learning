import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** 제안서(및 기본값)는 기존과 동일하게 pdf/docx만 허용한다. */
const DEFAULT_ALLOWED_EXTENSIONS = [".pdf", ".docx"];
/** 그 외 서류는 실무에서 xlsx로 오는 경우가 있어(특히 재무제표) 추가로 허용한다. */
const EXTRA_ALLOWED_EXTENSIONS = [".pdf", ".docx", ".xlsx"];

/**
 * docType 슬러그 → companies.documents jsonb에 저장할 한글 라벨.
 * evaluation-agent(.claude/agents/evaluation-agent/AGENT.md)가 정확히 이 라벨 키로
 * documents[라벨].fileUrl을 읽으므로 오탈자가 없어야 한다 (docs/schema.md 2.7절).
 */
const DOC_TYPE_LABELS: Record<string, string> = {
  business_registration: "사업자등록증",
  track_record: "사업수행실적증명서",
  price_bid: "가격입찰서",
  corporate_registry: "법인등기부등본 (말소포함, 최근 3개월 이내)",
  financial_statement: "재무제표 또는 부가가치과세증명원 (최근 2년)",
  team_roster: "참여인력 구성도",
};

/**
 * 제출서류 파일 업로드 (docs/schema.md 2.6절 → 2.7절로 일반화).
 * multipart/form-data: file, companyId, docType(선택, 기본값 "proposal")
 *
 * - docType === "proposal"(또는 생략): 기존과 동일하게 companies.proposal_file_url/
 *   proposal_file_name을 갱신한다(하위호환).
 * - 그 외 8종: companies.documents[한글라벨]에 { fileUrl, fileName, uploadedAt } 객체를
 *   부분 업데이트(다른 키는 보존)로 upsert한다.
 *
 * Storage 저장 경로는 항상 ASCII만 사용한다 — 한글 파일명을 그대로 키로 쓰면 Supabase
 * Storage가 "Invalid key" 오류를 내는 버그가 있었기 때문에(2026-07-06 수정), 원본
 * 파일명은 DB 컬럼에만 보존하고 Storage 경로는 `{companyId}/{docTypeSlug}.{ext}` 형태로
 * 고정한다.
 */
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file");
  const companyId = formData.get("companyId");
  const docTypeRaw = formData.get("docType");
  const docType = typeof docTypeRaw === "string" && docTypeRaw.trim() ? docTypeRaw.trim() : "proposal";

  if (!(file instanceof File) || typeof companyId !== "string" || !companyId) {
    return NextResponse.json({ error: "file과 companyId는 필수입니다." }, { status: 400 });
  }

  const isProposal = docType === "proposal";
  const docLabel = isProposal ? null : DOC_TYPE_LABELS[docType];
  if (!isProposal && !docLabel) {
    return NextResponse.json({ error: `알 수 없는 docType입니다: ${docType}` }, { status: 400 });
  }

  const allowedExtensions = isProposal ? DEFAULT_ALLOWED_EXTENSIONS : EXTRA_ALLOWED_EXTENSIONS;
  const lowerName = file.name.toLowerCase();
  const ext = allowedExtensions.find((e) => lowerName.endsWith(e));
  if (!ext) {
    return NextResponse.json(
      {
        error: `지원하지 않는 파일 형식입니다. ${allowedExtensions.join(", ")} 파일만 업로드할 수 있습니다.`,
      },
      { status: 400 }
    );
  }

  const supabase = getSupabaseClient();

  // Supabase Storage 객체 키는 비-ASCII 문자(한글 등)를 포함하면 "Invalid key" 오류를 낸다.
  // 원본 파일명은 DB 컬럼(proposal_file_name 또는 documents[라벨].fileName)에 그대로
  // 보존하고, 저장 경로는 ASCII(docType 슬러그)로만 구성한다.
  const storagePath = `${companyId}/${docType}${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("proposals")
    .upload(storagePath, buffer, {
      contentType: file.type || undefined,
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: publicUrlData } = supabase.storage.from("proposals").getPublicUrl(storagePath);

  if (isProposal) {
    const { data: company, error: updateError } = await supabase
      .from("companies")
      .update({
        proposal_file_url: publicUrlData.publicUrl,
        proposal_file_name: file.name,
      })
      .eq("id", companyId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    return NextResponse.json({ company });
  }

  // 8종 서류: 기존 documents jsonb의 다른 키를 보존한 채 해당 라벨 키만 부분 업데이트.
  const { data: existing, error: fetchError } = await supabase
    .from("companies")
    .select("documents")
    .eq("id", companyId)
    .single();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const documents = { ...(existing?.documents as Record<string, unknown> | null) };
  documents[docLabel as string] = {
    fileUrl: publicUrlData.publicUrl,
    fileName: file.name,
    uploadedAt: new Date().toISOString(),
  };

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
