"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import type { AiEvaluationDraft, Company, DocumentUpload } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

/**
 * 제출서류 6종 (제안서 1부는 별도 필드 proposal_file_url로 관리되므로 이 목록에서 제외).
 * 2026-07-06: 실제 RFP 제출서류 목록(사용자 확인)에 맞춰 원격평생교육시설 신고증빙·정보보안
 * 대책서를 제거하고 총 7종(제안서+6종)으로 확정했다.
 * slug는 /api/proposals/upload의 docType 파라미터 및 Storage 경로에 쓰이는 ASCII 값이고,
 * label은 companies.documents jsonb의 키(한글)로, evaluation-agent가 그대로 참조하므로
 * docs/schema.md 2.7절과 정확히 일치해야 한다.
 */
/**
 * Vercel Functions는 요청 본문이 약 4.5MB를 넘으면 413(Request Entity Too Large)을 돌려준다
 * (플랫폼 하드 리밋, 서버 코드로 늘릴 수 없음). 파일 선택 시점에 미리 걸러내 업로드를 시도조차
 * 하지 않고 바로 안내하기 위한 여유 있는 클라이언트 측 상한.
 */
const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024;
const MAX_FILE_SIZE_LABEL = "4MB";

function splitBySize(files: File[]): { ok: File[]; oversized: File[] } {
  const ok: File[] = [];
  const oversized: File[] = [];
  for (const f of files) {
    (f.size > MAX_FILE_SIZE_BYTES ? oversized : ok).push(f);
  }
  return { ok, oversized };
}

function warnOversized(oversized: File[]) {
  if (oversized.length === 0) return;
  const names = oversized.map((f) => `${f.name} (${(f.size / 1024 / 1024).toFixed(1)}MB)`).join(", ");
  window.alert(
    `다음 파일은 ${MAX_FILE_SIZE_LABEL}를 초과해 제외되었습니다: ${names}\n용량을 줄이거나(이미지 해상도 축소 등) PDF로 압축한 뒤 다시 첨부해주세요.`
  );
}

const EXTRA_DOCUMENT_TYPES: { slug: string; label: string }[] = [
  { slug: "business_registration", label: "사업자등록증" },
  { slug: "corporate_registry", label: "법인등기부등본 (말소포함, 최근 3개월 이내)" },
  { slug: "financial_statement", label: "재무제표 또는 부가가치과세증명원 (최근 2년)" },
  { slug: "track_record", label: "사업수행실적증명서" },
  { slug: "price_bid", label: "가격입찰서" },
  { slug: "team_roster", label: "참여인력 구성도" },
];

/** 표시/집계용 전체 7종 순서 (제안서 포함, docs/schema.md 2.7절 순서와 동일 — 2026-07-06 실제 RFP 서류목록 기준으로 확정). */
const ALL_DOCUMENT_LABELS = [
  "제안서 1부",
  "사업자등록증",
  "법인등기부등본 (말소포함, 최근 3개월 이내)",
  "재무제표 또는 부가가치과세증명원 (최근 2년)",
  "사업수행실적증명서",
  "가격입찰서",
  "참여인력 구성도",
] as const;

type QualChoice = "unreviewed" | "pass" | "fail";

/**
 * DB 스키마(companies.qualification_pass)는 필수자격 0-1/0-2 판정을 단일 통합 boolean으로만
 * 저장한다. 등록 화면에서 두 항목을 개별로 입력받아 재조회 시에도 구분해 보여주기 위해,
 * documents jsonb 안에 "__qualification" 예약 키로 원본 판정(q1/q2)을 함께 저장한다.
 * 문서 체크 개수 집계 시에는 이 예약 키를 제외한다.
 */
const QUALIFICATION_KEY = "__qualification";

type QualificationDetail = { q1: QualChoice; q2: QualChoice };

function getQualificationDetail(documents: Record<string, unknown> | null): QualificationDetail {
  const raw = documents?.[QUALIFICATION_KEY] as Partial<QualificationDetail> | undefined;
  return {
    q1: raw?.q1 ?? "unreviewed",
    q2: raw?.q2 ?? "unreviewed",
  };
}

/** 값이 "제출됨" 상태인지 판단: legacy boolean true, 단일 객체(구방식), 배열(신규 다중업로드) 모두 인정. */
function isDocSubmitted(value: unknown): boolean {
  if (value === true) return true;
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object" && "fileUrl" in (value as Record<string, unknown>)) {
    return Boolean((value as DocumentUpload).fileUrl);
  }
  return false;
}

/** documents[라벨] 값을 파일 목록(0개 이상)으로 정규화한다 — 배열/단일 객체 shape을 모두 흡수. */
function asFileList(value: unknown): DocumentUpload[] {
  if (Array.isArray(value)) return value as DocumentUpload[];
  if (value && typeof value === "object" && "fileUrl" in (value as Record<string, unknown>)) {
    return [value as DocumentUpload];
  }
  return [];
}

/** 8종(제안서 제외) 중 제출된 문서 개수 */
function countExtraDocs(documents: Record<string, unknown> | null): number {
  if (!documents) return 0;
  return EXTRA_DOCUMENT_TYPES.filter((d) => isDocSubmitted(documents[d.label])).length;
}

function qualBadge(choice: QualChoice) {
  if (choice === "pass") return <Badge tone="green">Pass</Badge>;
  if (choice === "fail") return <Badge tone="red">Fail</Badge>;
  return <Badge tone="neutral">미심사</Badge>;
}

export function CompanyRegistration({ onChanged }: { onChanged?: () => void }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [bidPrice, setBidPrice] = useState("");
  const [proposalFile, setProposalFile] = useState<File | null>(null);
  /** 6종 서류는 슬롯당 여러 파일을 허용하므로 File 배열로 관리한다. */
  const [docFiles, setDocFiles] = useState<Record<string, File[]>>({});
  const [q1, setQ1] = useState<QualChoice>("unreviewed");
  const [q2, setQ2] = useState<QualChoice>("unreviewed");
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  // 업체별 AI 채점 상태 표시용 (docs/schema.md 2.6절). 채점 실행은 더 이상 웹에서 트리거하지
  // 않고(evaluation-agent가 로컬에서 담당) 결과 유무만 조회해 참고용 뱃지로 보여준다.
  const [aiStatus, setAiStatus] = useState<Record<string, "idle" | "completed" | "failed">>({});

  // 참가업체 삭제(관리자 유지보수용) 상태.
  const [deletingCompanyId, setDeletingCompanyId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadCompanies = useCallback(async () => {
    const res = await fetch("/api/companies");
    const data = await res.json();
    const list: Company[] = data.companies ?? [];
    setCompanies(list);

    // 각 업체의 기존 AI 채점 초안 상태를 조회해 뱃지에 반영 (GET은 /evaluate 페이지도 사용하므로 유지됨)
    const entries = await Promise.all(
      list.map(async (c) => {
        try {
          const r = await fetch(`/api/ai-evaluate?companyId=${c.id}`);
          const d = await r.json();
          const draft = d.draft as AiEvaluationDraft | null;
          const status: "idle" | "completed" | "failed" =
            draft?.status === "completed" || draft?.status === "failed" ? draft.status : "idle";
          return [c.id, status] as const;
        } catch {
          return [c.id, "idle"] as const;
        }
      })
    );
    setAiStatus((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
  }, []);

  useEffect(() => {
    setLoading(true);
    loadCompanies().finally(() => setLoading(false));
  }, [loadCompanies]);

  /**
   * 업체 생성 후 파일 하나를 지정된 docType으로 업로드한다. 실패 시 에러 메시지를 던진다.
   * Vercel Functions는 요청 본문이 약 4.5MB를 넘으면 JSON이 아닌 평문 "Request Entity Too
   * Large" 응답(413)을 돌려주는데, 과거엔 이를 무조건 res.json()으로 파싱하려다 옆질러
   * "Unexpected token 'R'... is not valid JSON" 같은 알아보기 힘든 에러로 표시됐다.
   * 응답 본문을 먼저 텍스트로 읽고 JSON 파싱을 시도해 원인을 정확히 구분한다.
   */
  async function uploadDoc(companyId: string, docType: string, file: File, labelForError: string) {
    const uploadForm = new FormData();
    uploadForm.append("file", file);
    uploadForm.append("companyId", companyId);
    uploadForm.append("docType", docType);
    const res = await fetch("/api/proposals/upload", { method: "POST", body: uploadForm });
    const rawText = await res.text();
    let data: { error?: string } | null = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {
      data = null;
    }
    if (!res.ok) {
      const message =
        data?.error ??
        (res.status === 413
          ? `파일 용량이 너무 큽니다(${MAX_FILE_SIZE_LABEL} 초과). 용량을 줄여 다시 시도해주세요.`
          : rawText.trim().slice(0, 200) || `업로드 서버 오류(HTTP ${res.status})`);
      throw new Error(`${labelForError} 업로드 실패: ${message}`);
    }
  }

  async function handleRegister() {
    setFormMessage(null);
    const priceNum = Number(bidPrice.replaceAll(",", ""));
    if (!name.trim() || !priceNum || priceNum <= 0) {
      setFormMessage({ type: "error", text: "업체명과 입찰가격(양수)을 입력해주세요." });
      return;
    }
    setSubmitting(true);
    try {
      const documents: Record<string, unknown> = {
        [QUALIFICATION_KEY]: { q1, q2 },
      };
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          bidPrice: priceNum,
          documents,
          qualification1: q1,
          qualification2: q2,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "등록에 실패했습니다.");

      const newCompanyId = data.company?.id as string | undefined;

      // 회사 레코드 생성 후, 선택된 서류 파일들을 순차 업로드한다(제안서 포함 9종).
      const uploadErrors: string[] = [];
      if (newCompanyId) {
        if (proposalFile) {
          try {
            await uploadDoc(newCompanyId, "proposal", proposalFile, "제안서 1부");
          } catch (e) {
            uploadErrors.push(e instanceof Error ? e.message : String(e));
          }
        }
        for (const doc of EXTRA_DOCUMENT_TYPES) {
          const files = docFiles[doc.slug] ?? [];
          for (const file of files) {
            try {
              await uploadDoc(newCompanyId, doc.slug, file, doc.label);
            } catch (e) {
              uploadErrors.push(e instanceof Error ? e.message : String(e));
            }
          }
        }
      }

      if (uploadErrors.length > 0) {
        setFormMessage({
          type: "error",
          text: `${name} 업체는 등록되었으나 일부 서류 업로드에 실패했습니다: ${uploadErrors.join("; ")}`,
        });
      } else {
        setFormMessage({ type: "success", text: `${name} 업체가 등록되었습니다.` });
      }
      setName("");
      setBidPrice("");
      setProposalFile(null);
      setDocFiles({});
      setQ1("unreviewed");
      setQ2("unreviewed");
      await loadCompanies();
      onChanged?.();
    } catch (err) {
      setFormMessage({
        type: "error",
        text: err instanceof Error ? err.message : "등록 중 오류가 발생했습니다.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * 잘못 등록되었거나 테스트용으로 만든 업체를 삭제한다. 관련 평가(evaluations,
   * ai_evaluation_drafts)도 DB의 on delete cascade로 함께 삭제되므로 되돌릴 수 없다는
   * 점을 반드시 확인받는다.
   */
  async function handleDeleteCompany(company: Company) {
    const confirmed = window.confirm(
      `"${company.name}" 업체를 삭제하시겠습니까?\n관련 평가 데이터(평가입력, AI 채점 결과)도 함께 삭제되며, 이 작업은 되돌릴 수 없습니다.`
    );
    if (!confirmed) return;

    setDeleteError(null);
    setDeletingCompanyId(company.id);
    try {
      const res = await fetch(`/api/companies/${company.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "업체 삭제 중 오류가 발생했습니다.");
      }

      setCompanies((prev) => prev.filter((c) => c.id !== company.id));
      if (expandedId === company.id) setExpandedId(null);
      onChanged?.();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "업체 삭제 중 오류가 발생했습니다.");
    } finally {
      setDeletingCompanyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex w-full flex-col gap-5 rounded-xl border border-brand-border bg-white p-7">
        <div className="text-base font-bold text-brand-dark">신규 업체 등록</div>

        <div className="flex flex-col gap-5 md:flex-row">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label>업체명 *</Label>
            <Input
              placeholder="예) 주식회사 OK에듀"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <Label>입찰가격 (원) *</Label>
            <Input
              placeholder="예) 850,000,000"
              inputMode="numeric"
              value={bidPrice}
              onChange={(e) => setBidPrice(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-10 md:flex-row">
          <div className="flex w-full shrink-0 flex-col gap-3.5 md:w-[420px]">
            <div className="text-[13px] font-bold text-brand-dark">필수자격 판정 *</div>
            <div className="flex flex-col gap-1.5">
              <Label>0-1. 계약결격사유 없음</Label>
              <Select value={q1} onChange={(e) => setQ1(e.target.value as QualChoice)}>
                <option value="unreviewed">미심사</option>
                <option value="pass">Pass</option>
                <option value="fail">Fail</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>0-2. 원격평생교육시설 신고 여부</Label>
              <Select value={q2} onChange={(e) => setQ2(e.target.value as QualChoice)}>
                <option value="unreviewed">미심사</option>
                <option value="pass">Pass</option>
                <option value="fail">Fail</option>
              </Select>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-2.5">
            <div className="text-[13px] font-bold text-brand-dark">
              제출서류 업로드 (.pdf, .docx, .jpg, .png{" "}
              <span className="font-normal text-brand-muted">
                일부 항목은 .xlsx 가능 · 제안서 외 6종은 파일 여러 개 첨부 가능 · 파일당 최대{" "}
                {MAX_FILE_SIZE_LABEL}
              </span>
              )
            </div>
            <div className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <span className="text-[12px] font-bold text-brand-dark">제안서 1부</span>
                <input
                  type="file"
                  accept=".pdf,.docx,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    const picked = e.target.files?.[0] ?? null;
                    if (picked && picked.size > MAX_FILE_SIZE_BYTES) {
                      warnOversized([picked]);
                      e.target.value = "";
                      setProposalFile(null);
                      return;
                    }
                    setProposalFile(picked);
                  }}
                  className="w-full rounded-lg border border-brand-border bg-white px-2.5 py-1.5 text-[12px] text-brand-dark file:mr-2 file:rounded-md file:border-0 file:bg-brand-bg file:px-2.5 file:py-1 file:text-[12px] file:font-bold file:text-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
                />
                {proposalFile && (
                  <span className="text-[11px] text-brand-muted">선택됨: {proposalFile.name}</span>
                )}
              </div>
              {EXTRA_DOCUMENT_TYPES.map((doc) => (
                <div key={doc.slug} className="flex flex-col gap-1">
                  <span className="text-[12px] font-bold text-brand-dark">{doc.label}</span>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png"
                    onChange={(e) => {
                      const picked = e.target.files ? Array.from(e.target.files) : [];
                      const { ok, oversized } = splitBySize(picked);
                      warnOversized(oversized);
                      setDocFiles((prev) => ({ ...prev, [doc.slug]: ok }));
                    }}
                    className="w-full rounded-lg border border-brand-border bg-white px-2.5 py-1.5 text-[12px] text-brand-dark file:mr-2 file:rounded-md file:border-0 file:bg-brand-bg file:px-2.5 file:py-1 file:text-[12px] file:font-bold file:text-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
                  />
                  {(docFiles[doc.slug]?.length ?? 0) > 0 && (
                    <span className="text-[11px] text-brand-muted">
                      선택됨: {docFiles[doc.slug]!.map((f) => f.name).join(", ")}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleRegister} disabled={submitting}>
            {submitting ? "등록 중..." : "업체 등록"}
          </Button>
        </div>

        {formMessage && (
          <div
            className={`rounded-lg p-3 text-sm ${
              formMessage.type === "success"
                ? "bg-brand-bg text-brand-green"
                : "bg-brand-highlight text-brand-red"
            }`}
          >
            {formMessage.text}
          </div>
        )}
      </section>

      <div className="text-base font-bold text-brand-dark">
        등록된 참가업체 목록 ({companies.length}개사)
      </div>
      <section className="w-full overflow-x-auto rounded-xl border border-brand-border bg-white">
        <div className="min-w-[1420px]">
          <div className="flex bg-brand-dark p-3 px-4">
            <div className="w-[28px] shrink-0" />
            <div className="w-[200px] shrink-0 text-[13px] font-bold text-white">업체명</div>
            <div className="w-[140px] shrink-0 text-[13px] font-bold text-white">입찰가격</div>
            <div className="w-[80px] shrink-0 text-[13px] font-bold text-white">제출서류</div>
            <div className="w-[170px] shrink-0 text-[13px] font-bold text-white">제안서 링크</div>
            <div className="w-[100px] shrink-0 text-[13px] font-bold text-white">필수자격 0-1</div>
            <div className="w-[100px] shrink-0 text-[13px] font-bold text-white">필수자격 0-2</div>
            <div className="w-[170px] shrink-0 text-[13px] font-bold text-white">AI 채점</div>
            <div className="w-[110px] shrink-0 text-[13px] font-bold text-white">등록일</div>
            <div className="flex-1 text-[13px] font-bold text-white">관리</div>
          </div>
          {companies.length === 0 && !loading && (
            <div className="p-4 text-sm text-brand-muted">등록된 업체가 없습니다.</div>
          )}
          {companies.map((c, i) => {
            const docs = c.documents as Record<string, unknown> | null;
            const qual = getQualificationDetail(docs);
            const status = aiStatus[c.id] ?? "idle";
            const submittedCount = countExtraDocs(docs) + (c.proposal_file_url ? 1 : 0);
            const isExpanded = expandedId === c.id;
            return (
              <div key={c.id}>
                <div
                  className={`flex items-center border-t border-brand-border p-3 px-4 ${
                    i % 2 === 1 ? "bg-brand-alt" : "bg-white"
                  }`}
                >
                  <button
                    type="button"
                    className="w-[28px] shrink-0 text-brand-muted hover:text-brand-dark"
                    onClick={() => setExpandedId(isExpanded ? null : c.id)}
                    aria-label="제출서류 상세 보기"
                  >
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  <div className="w-[200px] shrink-0 text-sm font-bold text-brand-dark">
                    {c.name}
                  </div>
                  <div className="w-[140px] shrink-0 text-sm text-brand-dark">
                    {Number(c.bid_price).toLocaleString()}원
                  </div>
                  <div className="w-[80px] shrink-0 text-sm text-brand-dark">
                    {submittedCount}/{ALL_DOCUMENT_LABELS.length}
                  </div>
                  <div className="w-[170px] shrink-0 truncate text-[13px] text-brand">
                    {c.proposal_file_url ? (
                      <a href={c.proposal_file_url} target="_blank" rel="noreferrer">
                        {c.proposal_file_name || "다운로드"}
                      </a>
                    ) : (
                      <span className="text-brand-muted">-</span>
                    )}
                  </div>
                  <div className="w-[100px] shrink-0">{qualBadge(qual.q1)}</div>
                  <div className="w-[100px] shrink-0">{qualBadge(qual.q2)}</div>
                  <div className="w-[170px] shrink-0">
                    {status === "completed" ? (
                      <Badge tone="green" className="gap-1">
                        <Sparkles size={12} /> AI 채점 완료
                      </Badge>
                    ) : status === "failed" ? (
                      <Badge tone="red" className="gap-1">
                        AI 채점 실패
                      </Badge>
                    ) : (
                      <span
                        className="text-[12px] text-brand-muted"
                        title="Claude Code 세션에서 evaluation-agent를 실행해 채점 초안을 생성하세요."
                      >
                        채점 전 (로컬 에이전트 실행 필요)
                      </span>
                    )}
                  </div>
                  <div className="w-[110px] shrink-0 text-[13px] text-brand-muted">
                    {new Date(c.created_at).toLocaleDateString("ko-KR")}
                  </div>
                  <div className="flex-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCompany(c);
                      }}
                      disabled={deletingCompanyId === c.id}
                      className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-[12px] font-bold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {deletingCompanyId === c.id ? "삭제 중..." : "삭제"}
                    </button>
                  </div>
                </div>
                {isExpanded && (
                  <div
                    className={`border-t border-brand-border px-4 py-3 pl-[52px] ${
                      i % 2 === 1 ? "bg-brand-alt" : "bg-white"
                    }`}
                  >
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                      {ALL_DOCUMENT_LABELS.map((label) => {
                        if (label === "제안서 1부") {
                          return (
                            <div key={label} className="flex items-center gap-2 text-[12px]">
                              <span className="text-brand-dark">{label}:</span>
                              {c.proposal_file_url ? (
                                <a
                                  href={c.proposal_file_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="truncate text-brand"
                                >
                                  {c.proposal_file_name || "다운로드"}
                                </a>
                              ) : (
                                <span className="text-brand-muted">미제출</span>
                              )}
                            </div>
                          );
                        }
                        const value = docs?.[label];
                        const fileList = asFileList(value);
                        return (
                          <div key={label} className="flex flex-col gap-0.5 text-[12px]">
                            <span className="text-brand-dark">{label}:</span>
                            {fileList.length > 0 ? (
                              <div className="flex flex-wrap gap-x-3 gap-y-0.5 pl-2">
                                {fileList.map((f, idx) => (
                                  <a
                                    key={`${f.fileUrl}-${idx}`}
                                    href={f.fileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="truncate text-brand"
                                  >
                                    {f.fileName || "다운로드"}
                                  </a>
                                ))}
                              </div>
                            ) : value === true ? (
                              <span className="pl-2 text-brand-muted">체크만 됨 (파일 없음)</span>
                            ) : (
                              <span className="pl-2 text-brand-muted">미제출</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
      {deleteError && <p className="text-sm font-semibold text-red-600">{deleteError}</p>}
    </div>
  );
}
