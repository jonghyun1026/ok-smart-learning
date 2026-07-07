import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const BUCKET = "proposals";

/**
 * Supabase Storage public URL(예: https://xxx.supabase.co/storage/v1/object/public/proposals/{path})
 * 에서 버킷 하위 경로만 추출한다. 형식이 다르면(다른 버킷/외부 URL 등) null을 반환한다.
 */
function extractStoragePath(url: unknown): string | null {
  if (typeof url !== "string" || !url) return null;
  const marker = `/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const path = url.slice(idx + marker.length);
  return path.length > 0 ? path : null;
}

/**
 * 참가업체 삭제 (관리자 유지보수용). 잘못 등록되었거나 테스트용으로 만든 업체를
 * 웹 화면에서 직접 정리할 수 있도록 한다.
 *
 * - companies 행을 삭제하면 evaluations.company_id / ai_evaluation_drafts.company_id의
 *   FK가 on delete cascade로 걸려있어(scripts/migrations/001, 003) 관련 평가 데이터도
 *   DB에서 자동으로 함께 삭제된다. 별도 순서 처리가 필요 없다.
 * - Storage(proposals 버킷)에 남는 첨부 파일(제안서 + 제출서류 8종)은 best-effort로
 *   정리한다 — 파일이 없거나 삭제에 실패해도 전체 요청은 계속 진행한다. Storage 정리는
 *   부가 기능이지 필수 성공 조건이 아니다.
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  if (!id) {
    return NextResponse.json({ error: "업체 id가 필요합니다." }, { status: 400 });
  }

  const supabase = getSupabaseClient();

  const { data: company, error: fetchError } = await supabase
    .from("companies")
    .select("proposal_file_url, documents")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!company) {
    return NextResponse.json({ error: "업체를 찾을 수 없습니다." }, { status: 404 });
  }

  // Storage 정리 (best-effort). 실패해도 아래 companies 삭제는 계속 진행한다.
  try {
    const paths: string[] = [];

    const proposalPath = extractStoragePath(company.proposal_file_url);
    if (proposalPath) paths.push(proposalPath);

    const documents = (company.documents ?? {}) as Record<string, unknown>;
    for (const value of Object.values(documents)) {
      if (value && typeof value === "object" && "fileUrl" in (value as Record<string, unknown>)) {
        const p = extractStoragePath((value as { fileUrl?: unknown }).fileUrl);
        if (p) paths.push(p);
      }
    }

    if (paths.length > 0) {
      await supabase.storage.from(BUCKET).remove(paths);
    }
  } catch {
    // Storage 정리 실패는 무시 — companies 삭제는 계속 진행한다.
  }

  const { data: deleted, error: deleteError } = await supabase
    .from("companies")
    .delete()
    .eq("id", id)
    .select();

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }
  if (!deleted || deleted.length === 0) {
    return NextResponse.json({ error: "삭제할 업체를 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
