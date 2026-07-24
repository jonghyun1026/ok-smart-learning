"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Building2, ShieldCheck, Clock, ChevronDown, ChevronRight, Table2 } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";
import type { AiEvaluationDraft } from "@/lib/supabase";
import { isNegotiationQualified, rankCompanies, calcAreaSubtotal, type CriteriaData } from "@/lib/scoring";
import { getCompanyColor } from "@/lib/company-colors";
import { Badge } from "@/components/ui/badge";
import { DonutGauge } from "@/components/ui/donut-gauge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { CompanyRadarChart } from "@/components/admin/company-radar-chart";
import { ComparisonBoard } from "@/components/admin/comparison-board";
import type { DiagnosisCompany } from "@/components/admin/comparison-diagnosis";
import { KpiTile } from "@/components/ui/kpi-tile";

type ResultRow = {
  company_id: string;
  company_name: string;
  bid_price: number;
  qualification_pass: boolean | null;
  evaluator_count: number;
  avg_technical_score: number | null;
  avg_price_score: number | null;
  avg_total_score: number | null;
  areaScores: Record<string, number>;
};

/** 작업 2: 업체별 개별 평가자 제출 내역 (evaluations 원본 행) */
type EvaluatorRow = {
  id: string;
  evaluator_id: string;
  scores: Record<string, number>;
  technical_total: number;
  price_total: number;
  total_score: number;
  updated_at: string;
};

/**
 * 소수 점수의 합은 부동소수점 오차로 20.400000000000002처럼 표시될 수 있어, 화면 표시 직전
 * 소수 둘째 자리까지 반올림한다. (평가 점수는 소수 1자리 입력이므로 소계도 실질 1자리)
 */
function fmtScore(n: number): number {
  return Math.round(n * 100) / 100;
}

export function ResultsDashboard({ refreshKey }: { refreshKey?: number }) {
  const [criteria, setCriteria] = useState<CriteriaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<ResultRow[]>([]);

  // 제안서 비교 한눈 요약(장표식) — comparison_facts(AI 초안) 소스. 확정 점수와 별개.
  const [comparisonCompanies, setComparisonCompanies] = useState<DiagnosisCompany[]>([]);

  // 작업 2: 행 펼침 상태 + 업체별 평가자 상세 캐시
  const [expandedCompanyId, setExpandedCompanyId] = useState<string | null>(null);
  const [evaluatorRowsByCompany, setEvaluatorRowsByCompany] = useState<
    Record<string, EvaluatorRow[]>
  >({});
  const [loadingEvaluatorRows, setLoadingEvaluatorRows] = useState<Record<string, boolean>>({});

  // 작업: 개별 평가 삭제 진행 상태 + 에러 메시지
  const [deletingEvaluationId, setDeletingEvaluationId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadResults = useCallback(async () => {
    const criteriaRes = await fetch("/api/criteria").then((r) => r.json());
    const data = criteriaRes.data as CriteriaData | undefined;
    if (!data) return;
    setCriteria(data);

    const supabase = getSupabaseClient();
    const [{ data: viewRows, error: viewError }, { data: evalRows }] = await Promise.all([
      supabase.from("results_view").select("*"),
      supabase.from("evaluations").select("company_id, scores"),
    ]);

    if (viewError) {
      console.error(viewError);
      return;
    }

    // 영역별 평가자 평균 소계를 업체별로 계산한다. 동점 재비교(tiebreakAreaCodes)뿐 아니라
    // 레이더 차트(작업 3)가 전체 채점 영역(가격 포함) 축을 필요로 하므로 scoreAreaCodes 전체를 계산한다.
    const areaSums: Record<string, Record<string, { sum: number; count: number }>> = {};
    for (const row of evalRows ?? []) {
      const scores = (row.scores ?? {}) as Record<string, number>;
      const bucket = areaSums[row.company_id] ?? {};
      for (const code of data.scoreAreaCodes) {
        const entry = bucket[code] ?? { sum: 0, count: 0 };
        entry.sum += calcAreaSubtotal(data, scores, code);
        entry.count += 1;
        bucket[code] = entry;
      }
      areaSums[row.company_id] = bucket;
    }

    const merged: ResultRow[] = (viewRows ?? []).map((r) => {
      const bucket = areaSums[r.company_id] ?? {};
      const areaScores: Record<string, number> = {};
      for (const code of data.scoreAreaCodes) {
        const entry = bucket[code];
        areaScores[code] = entry && entry.count > 0 ? entry.sum / entry.count : 0;
      }
      return { ...r, areaScores };
    });

    setResults(
      rankCompanies(
        data,
        merged.map((m) => ({ ...m, totalScore: m.avg_total_score }))
      ) as ResultRow[]
    );

    // 제안서 비교 한눈 요약용 사실(comparison_facts) 로드. 색상은 업체(entity)에 고정하기 위해
    // company_id 오름차순으로 배정한다(AI 평가 레포트 탭과 동일 규칙).
    const [{ data: companyRows }, { data: draftRows }] = await Promise.all([
      supabase.from("companies").select("id, name, bid_price"),
      supabase
        .from("ai_evaluation_drafts")
        .select("company_id, comparison_facts, status")
        .eq("status", "completed"),
    ]);
    const companyById = new Map(
      ((companyRows as { id: string; name: string; bid_price: number | string }[] | null) ?? []).map(
        (c) => [c.id, c]
      )
    );
    const drafts = ((draftRows as AiEvaluationDraft[] | null) ?? [])
      .filter((d) => d.comparison_facts)
      .filter((d, idx, arr) => arr.findIndex((x) => x.company_id === d.company_id) === idx)
      .sort((a, b) => a.company_id.localeCompare(b.company_id));
    setComparisonCompanies(
      drafts.map((d, idx) => {
        const company = companyById.get(d.company_id);
        return {
          id: d.company_id,
          name: company?.name ?? "(삭제된 업체)",
          bidPrice: Number(company?.bid_price) || 0,
          color: getCompanyColor(idx, company?.name),
          facts: d.comparison_facts,
        };
      })
    );
  }, []);

  useEffect(() => {
    setLoading(true);
    loadResults().finally(() => setLoading(false));
  }, [loadResults, refreshKey]);

  // refreshKey가 바뀌면(업체 등록 등) 캐시된 평가자 상세도 stale해지므로 비운다.
  useEffect(() => {
    setEvaluatorRowsByCompany({});
    setExpandedCompanyId(null);
  }, [refreshKey]);

  async function toggleExpand(companyId: string) {
    if (expandedCompanyId === companyId) {
      setExpandedCompanyId(null);
      return;
    }
    setExpandedCompanyId(companyId);
    if (evaluatorRowsByCompany[companyId]) return;

    setLoadingEvaluatorRows((prev) => ({ ...prev, [companyId]: true }));
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("evaluations")
        .select("id, evaluator_id, scores, technical_total, price_total, total_score, updated_at")
        .eq("company_id", companyId)
        .order("updated_at", { ascending: false });
      if (!error) {
        setEvaluatorRowsByCompany((prev) => ({ ...prev, [companyId]: (data ?? []) as EvaluatorRow[] }));
      }
    } finally {
      setLoadingEvaluatorRows((prev) => ({ ...prev, [companyId]: false }));
    }
  }

  /** 개별 평가자 평가 결과를 삭제한다. 되돌릴 수 없으므로 확인 절차를 반드시 거친다. */
  async function handleDeleteEvaluation(companyId: string, ev: EvaluatorRow) {
    const confirmed = window.confirm(
      `"${ev.evaluator_id}" 평가자의 평가 결과를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`
    );
    if (!confirmed) return;

    setDeleteError(null);
    setDeletingEvaluationId(ev.id);
    try {
      const res = await fetch(`/api/score?id=${encodeURIComponent(ev.id)}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error ?? "평가 삭제 중 오류가 발생했습니다.");
      }

      setEvaluatorRowsByCompany((prev) => ({
        ...prev,
        [companyId]: (prev[companyId] ?? []).filter((r) => r.id !== ev.id),
      }));
      // 삭제로 인해 평가자수/평균이 바뀌므로 종합결과를 다시 불러온다.
      await loadResults();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "평가 삭제 중 오류가 발생했습니다.");
    } finally {
      setDeletingEvaluationId(null);
    }
  }

  const stats = useMemo(() => {
    if (!criteria) return { total: 0, qualified: 0, pending: 0 };
    const total = results.length;
    const qualified = results.filter((r) =>
      isNegotiationQualified(criteria, r.avg_total_score, r.qualification_pass)
    ).length;
    const pending = results.filter((r) => r.qualification_pass === null).length;
    return { total, qualified, pending };
  }, [results, criteria]);

  // 업체명이 중복될 수 있어(예: "OK에듀테크" 2개 등록 사례 — 평가입력 화면 버그 B와 동일한 문제)
  // 이름이 겹치는 업체만 ID 뒷 4자리를 덧붙여 구분한다. (레이더 차트 범례와 동일한 규칙)
  const displayNames = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of results) counts.set(r.company_name, (counts.get(r.company_name) ?? 0) + 1);
    const map = new Map<string, string>();
    for (const r of results) {
      const isDup = (counts.get(r.company_name) ?? 0) > 1;
      map.set(r.company_id, isDup ? `${r.company_name} (#${r.company_id.slice(-4)})` : r.company_name);
    }
    return map;
  }, [results]);

  if (!criteria) {
    return <p className="text-sm text-brand-muted">불러오는 중...</p>;
  }

  const qualifiedRatio = stats.total > 0 ? (stats.qualified / stats.total) * 100 : 0;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 lg:flex-row">
        <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
          <KpiTile
            icon={Building2}
            label="참가업체 수"
            value={stats.total}
            unit="개사"
            sub="입찰에 참여한 업체 총계"
            accent="#F55000"
            soft="#FFF1E9"
          />
          <KpiTile
            icon={ShieldCheck}
            label="협상적격 업체 수"
            value={stats.qualified}
            unit="개사"
            sub="총점·필수자격 기준 통과"
            accent="#18875E"
            soft="#E7F4EE"
          />
          <KpiTile
            icon={Clock}
            label="필수자격 판정 대기"
            value={stats.pending}
            unit="개사"
            sub="필수자격 심사 전"
            accent="#E39400"
            soft="#FFF7DF"
          />
        </div>

        <div className="flex shrink-0 flex-col items-center justify-center gap-3 rounded-2xl border border-brand-border bg-white p-5 shadow-sm">
          <span className="text-[12px] font-bold text-brand-muted">협상적격 비율</span>
          <DonutGauge
            value={stats.qualified}
            max={stats.total || 1}
            size={110}
            strokeWidth={10}
            color="#18875E"
            trackColor="#F0EDE9"
            label={`${Math.round(qualifiedRatio)}%`}
            sublabel={`${stats.qualified}/${stats.total}개사`}
            labelClassName="text-brand-dark"
            sublabelClassName="text-brand-muted"
          />
        </div>
      </section>

      {/* 제안서 비교 (한눈 요약) — 예시 장표식 압축 표. 소스는 AI 초안(comparison_facts)이므로 검증 대상. */}
      {comparisonCompanies.length > 0 && (
        <>
          <div className="flex items-center gap-3 pt-2">
            <span className="flex items-center gap-2 whitespace-nowrap text-base font-bold text-brand-dark">
              <Table2 size={17} className="text-brand" />
              제안서 비교 (한눈 요약)
            </span>
            <div className="h-px flex-1 bg-brand-border" />
          </div>
          <div className="-mt-2 flex items-start gap-2 rounded-xl border border-brand-amber/40 bg-[#FFF8EC] p-3.5">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-brand-amber" />
            <p className="text-[12px] leading-relaxed text-brand-dark">
              아래 표는 <b>AI가 제안서에서 추출한 사실 요약</b>입니다(점수 아님). <b>(담당자 확인)</b> 표시는
              제안서 밖에서 담당자가 확인·보완한 내용이며, 그 외 항목은 확정 판단 전 원본 제안서로 교차
              검증해야 합니다. 항목별 심층 비교는 상단{" "}
              <b className="font-bold text-brand-dark">[AI 평가 레포트]</b> 탭에서 볼 수 있습니다.
            </p>
          </div>
          <ComparisonBoard companies={comparisonCompanies} />
        </>
      )}

      {/* 업체 간 AI 초안 비교·진단은 상단 [AI 평가 레포트] 탭으로 이동함 — 여기서는 확정 평가 중심으로 본다 */}
      <div className="flex items-center gap-3 pt-2">
        <span className="whitespace-nowrap text-base font-bold text-brand-dark">확정 평가 결과</span>
        <div className="h-px flex-1 bg-brand-border" />
      </div>
      <p className="-mt-3 text-xs text-brand-muted">
        아래는 평가자가 [평가입력] 화면에서 저장한 확정 점수의 평균입니다. 업체 간 AI 초안 비교·진단은 상단{" "}
        <b className="font-bold text-brand-dark">[AI 평가 레포트]</b> 탭에서 확인하세요.
      </p>

      {/* 작업 3: 업체 간 비교 레이더 차트 (확정 평가 평균 기준) */}
      <CompanyRadarChart
        criteria={criteria}
        companies={results.map((r) => ({
          company_id: r.company_id,
          company_name: r.company_name,
          avg_total_score: r.avg_total_score,
          areaScores: r.areaScores,
        }))}
        title="부문별 점수 비교 (확정 평가 평균)"
      />

      <div className="text-base font-bold text-brand-dark">업체별 평가 결과 (고득점순)</div>
      <section className="w-full overflow-x-auto rounded-2xl border border-brand-border bg-white shadow-sm">
        <div className="min-w-[1190px]">
          <div className="flex items-center border-b border-brand-border bg-brand-alt p-3 px-4">
            <div className="w-[40px] shrink-0" />
            <div className="w-[60px] shrink-0 text-[12px] font-black uppercase tracking-wide text-brand-muted">순위</div>
            <div className="w-[220px] shrink-0 text-[12px] font-black uppercase tracking-wide text-brand-muted">업체명</div>
            <div className="w-[100px] shrink-0 text-[12px] font-black uppercase tracking-wide text-brand-muted">필수자격</div>
            <div className="w-[90px] shrink-0 text-[12px] font-black uppercase tracking-wide text-brand-muted">평가자수</div>
            <div className="w-[200px] shrink-0 text-[12px] font-black uppercase tracking-wide text-brand-muted">
              기술평균 (/{criteria.technicalTotalPoints})
            </div>
            <div className="w-[130px] shrink-0 text-[12px] font-black uppercase tracking-wide text-brand-muted">
              가격평균 (/{criteria.priceTotalPoints})
            </div>
            <div className="w-[140px] shrink-0 text-[12px] font-black uppercase tracking-wide text-brand-muted">
              총점평균 (/{criteria.grandTotalPoints})
            </div>
            <div className="flex-1 text-[12px] font-black uppercase tracking-wide text-brand-muted">협상적격</div>
          </div>
          {results.length === 0 && !loading && (
            <div className="p-4 text-sm text-brand-muted">등록된 업체가 없습니다.</div>
          )}
          {results.map((r, i) => {
            const qualified = isNegotiationQualified(criteria, r.avg_total_score, r.qualification_pass);
            const isExpanded = expandedCompanyId === r.company_id;
            const evaluatorRows = evaluatorRowsByCompany[r.company_id];
            const isLoadingRows = Boolean(loadingEvaluatorRows[r.company_id]);
            return (
              <div key={r.company_id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleExpand(r.company_id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") toggleExpand(r.company_id);
                  }}
                  className={`flex cursor-pointer items-center border-t border-brand-border p-3.5 px-4 hover:brightness-[0.98] ${
                    qualified ? "bg-brand-highlight" : i % 2 === 1 ? "bg-brand-alt" : "bg-white"
                  }`}
                >
                  <div className="w-[40px] shrink-0 text-brand-muted">
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </div>
                  <div className="w-[60px] shrink-0 text-[15px] font-black text-brand-dark">
                    {i + 1}
                  </div>
                  <div className="w-[220px] shrink-0 text-sm font-bold text-brand-dark">
                    {displayNames.get(r.company_id) ?? r.company_name}
                  </div>
                  <div className="w-[100px] shrink-0">
                    {r.qualification_pass === true ? (
                      <Badge tone="green">Pass</Badge>
                    ) : r.qualification_pass === false ? (
                      <Badge tone="red">Fail</Badge>
                    ) : (
                      <Badge tone="neutral">미심사</Badge>
                    )}
                  </div>
                  <div className="w-[90px] shrink-0 text-sm text-brand-dark">
                    {r.evaluator_count}명
                  </div>
                  <div className="w-[200px] shrink-0 pr-4">
                    <div className="flex items-center justify-between text-sm text-brand-dark">
                      <span>{r.avg_technical_score?.toFixed(2) ?? "-"} 점</span>
                    </div>
                    <ProgressBar
                      value={r.avg_technical_score ?? 0}
                      max={criteria.technicalTotalPoints || 1}
                      colorHex="#F55000"
                      className="mt-1"
                    />
                  </div>
                  <div className="w-[130px] shrink-0 text-sm text-brand-dark">
                    {r.avg_price_score?.toFixed(2) ?? "-"} 점
                  </div>
                  <div className="w-[140px] shrink-0 text-base font-black text-brand-dark">
                    {r.avg_total_score?.toFixed(2) ?? "-"} 점
                  </div>
                  <div className="flex-1">
                    {qualified ? (
                      <Badge tone="brand">협상적격</Badge>
                    ) : r.qualification_pass === null ? (
                      <Badge tone="amber">심사대기</Badge>
                    ) : (
                      <Badge tone="neutral">대상아님</Badge>
                    )}
                  </div>
                </div>

                {/* 작업 2: 평가자별 결과 펼침 영역 */}
                {isExpanded && (
                  <div className="border-t border-brand-border bg-brand-bg/60 px-4 py-4 pl-[56px]">
                    {isLoadingRows && (
                      <p className="text-sm text-brand-muted">평가자별 결과를 불러오는 중...</p>
                    )}
                    {!isLoadingRows && (!evaluatorRows || evaluatorRows.length === 0) && (
                      <p className="text-sm text-brand-muted">아직 제출된 평가가 없습니다.</p>
                    )}
                    {!isLoadingRows && evaluatorRows && evaluatorRows.length > 0 && (
                      <div className="overflow-x-auto rounded-lg border border-brand-border bg-white">
                        <div className="min-w-[1080px]">
                          <div className="flex items-center bg-brand-alt p-2.5 px-3">
                            <div className="w-[140px] shrink-0 text-[12px] font-bold text-brand-dark">
                              평가자
                            </div>
                            {criteria.technicalAreaCodes.map((code) => {
                              const area = criteria.areas.find((a) => a.code === code);
                              return (
                                <div
                                  key={code}
                                  className="w-[120px] shrink-0 text-[12px] font-bold text-brand-dark"
                                >
                                  {area?.name ?? code} (/{area?.maxPoints ?? "-"})
                                </div>
                              );
                            })}
                            <div className="w-[120px] shrink-0 text-[12px] font-bold text-brand-dark">
                              기술점수합계 (/{criteria.technicalTotalPoints})
                            </div>
                            <div className="w-[100px] shrink-0 text-[12px] font-bold text-brand-dark">
                              가격점수 (/{criteria.priceTotalPoints})
                            </div>
                            <div className="w-[100px] shrink-0 text-[12px] font-bold text-brand-dark">
                              총점 (/{criteria.grandTotalPoints})
                            </div>
                            <div className="w-[160px] shrink-0 text-[12px] font-bold text-brand-dark">
                              마지막 저장 시각
                            </div>
                            <div className="w-[80px] shrink-0 text-[12px] font-bold text-brand-dark">
                              관리
                            </div>
                          </div>
                          {evaluatorRows.map((ev, idx) => {
                            const isDeleting = deletingEvaluationId === ev.id;
                            return (
                              <div
                                key={ev.id}
                                className={`flex items-center border-t border-brand-border p-2.5 px-3 ${
                                  idx % 2 === 1 ? "bg-brand-alt/50" : "bg-white"
                                }`}
                              >
                                <div className="w-[140px] shrink-0 text-[13px] font-bold text-brand-dark">
                                  {ev.evaluator_id}
                                </div>
                                {criteria.technicalAreaCodes.map((code) => (
                                  <div key={code} className="w-[120px] shrink-0 text-[13px] text-brand-dark">
                                    {fmtScore(calcAreaSubtotal(criteria, ev.scores ?? {}, code))}점
                                  </div>
                                ))}
                                <div className="w-[120px] shrink-0 text-[13px] font-bold text-brand-dark">
                                  {ev.technical_total}점
                                </div>
                                <div className="w-[100px] shrink-0 text-[13px] text-brand-dark">
                                  {ev.price_total}점
                                </div>
                                <div className="w-[100px] shrink-0 text-[13px] font-black text-brand-dark">
                                  {ev.total_score}점
                                </div>
                                <div className="w-[160px] shrink-0 text-[12px] text-brand-muted">
                                  {new Date(ev.updated_at).toLocaleString("ko-KR")}
                                </div>
                                <div className="w-[80px] shrink-0">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteEvaluation(r.company_id, ev);
                                    }}
                                    disabled={isDeleting}
                                    className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-[12px] font-bold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {isDeleting ? "삭제 중..." : "삭제"}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {deleteError && (
                      <p className="mt-2 text-sm font-semibold text-red-600">{deleteError}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
      <p className="text-xs text-brand-muted">
        협상적격 기준: 총점 {criteria.settings.negotiationThreshold}점 이상 AND 필수자격 Pass. 동점 시{" "}
        {criteria.settings.tiebreakAreaCodes
          .map((code) => criteria.areas.find((a) => a.code === code)?.name ?? code)
          .join(" → ")}{" "}
        순으로 재비교하여 정렬합니다. 행을 클릭하면 평가자별 세부 점수를 볼 수 있습니다.
      </p>
    </div>
  );
}
