"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import type { AiEvaluationDraft, Company } from "@/lib/supabase";
import { calcTotals, clampScore, type CriteriaData } from "@/lib/scoring";
import { getAreaColor } from "@/lib/area-colors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { DonutGauge } from "@/components/ui/donut-gauge";
import { ProgressBar } from "@/components/ui/progress-bar";

function qualificationBadge(pass: boolean | null | undefined) {
  if (pass === true) return <Badge tone="green">Pass</Badge>;
  if (pass === false) return <Badge tone="red">Fail</Badge>;
  return <Badge tone="neutral">미심사</Badge>;
}

export default function EvaluatePage() {
  const [criteria, setCriteria] = useState<CriteriaData | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [evaluatorName, setEvaluatorName] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [scores, setScores] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  // AI 평가 에이전트 초안 (docs/schema.md 2.6절). 사람이 "불러오기"를 눌러야만
  // 점수 입력란에 반영되며, 반영 후에도 "평가 점수 저장"을 눌러야 evaluations에 확정된다.
  const [aiDraft, setAiDraft] = useState<AiEvaluationDraft | null>(null);
  const [aiApplied, setAiApplied] = useState(false);
  const [expandedRationale, setExpandedRationale] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/criteria")
      .then((r) => r.json())
      .then((data) => {
        if (data.data) {
          setCriteria(data.data as CriteriaData);
          setScores(Object.fromEntries((data.data as CriteriaData).manualScoreItemNos.map((no) => [no, 0])));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/companies")
      .then((r) => r.json())
      .then((data) => {
        setCompanies(data.companies ?? []);
        if (!companyId && data.companies?.length) {
          setCompanyId(data.companies[0].id);
        }
      })
      .finally(() => setLoadingCompanies(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedCompany = useMemo(
    () => companies.find((c) => c.id === companyId) ?? null,
    [companies, companyId]
  );

  const lowestBidPrice = useMemo(() => {
    const prices = companies.map((c) => Number(c.bid_price)).filter((v) => v > 0);
    return prices.length > 0 ? Math.min(...prices) : 0;
  }, [companies]);

  // 버그 A 수정: 업체가 바뀌면 평가자 이름 입력 여부와 무관하게 먼저 점수를 전부 0으로
  // 리셋한다. 이렇게 해야 "저장된 평가가 없으면 항상 0, 있으면 그 값"이 보장된다.
  // (이 effect는 companyId 변경에만 반응하고 evaluatorName 변경에는 반응하지 않는다 —
  // 그래야 평가자 이름을 입력/수정하는 도중에 방금 입력한 점수가 날아가지 않는다.)
  useEffect(() => {
    if (!criteria) return;
    setScores(Object.fromEntries(criteria.manualScoreItemNos.map((no) => [no, 0])));
    setMessage(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [criteria, companyId]);

  // 기존 저장된 평가가 있으면 불러와서 이어서 편집 (없으면 위 effect가 이미 0으로 리셋해둔 상태 유지)
  useEffect(() => {
    if (!criteria || !companyId || !evaluatorName.trim()) return;
    const controller = new AbortController();
    fetch(
      `/api/score?companyId=${companyId}&evaluatorId=${encodeURIComponent(evaluatorName.trim())}`,
      { signal: controller.signal }
    )
      .then((r) => r.json())
      .then((data) => {
        if (data.evaluation?.scores) {
          const loaded: Record<string, number> = {};
          for (const no of criteria.manualScoreItemNos) {
            loaded[no] = Number(data.evaluation.scores[no]) || 0;
          }
          setScores(loaded);
        }
      })
      .catch(() => {});
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [criteria, companyId, evaluatorName]);

  // 업체 선택이 바뀌면 해당 업체의 AI 채점 초안을 조회 (완료 상태일 때만 배너 노출)
  useEffect(() => {
    setAiDraft(null);
    setAiApplied(false);
    setExpandedRationale({});
    if (!companyId) return;
    const controller = new AbortController();
    fetch(`/api/ai-evaluate?companyId=${companyId}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        const draft = data.draft as AiEvaluationDraft | null;
        if (draft && draft.status === "completed") {
          setAiDraft(draft);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [companyId]);

  function handleApplyAiDraft() {
    if (!aiDraft || !criteria) return;
    setScores((prev) => {
      const next = { ...prev };
      for (const itemNo of criteria.manualScoreItemNos) {
        const entry = aiDraft.item_scores[itemNo];
        if (entry) {
          next[itemNo] = clampScore(criteria, itemNo, Number(entry.score) || 0);
        }
      }
      return next;
    });
    setAiApplied(true);
  }

  const totals = useMemo(() => {
    if (!criteria) return null;
    return calcTotals(criteria, {
      manualScores: scores,
      companyBidPrice: Number(selectedCompany?.bid_price) || 0,
      lowestBidPrice,
    });
  }, [criteria, scores, selectedCompany, lowestBidPrice]);

  function handleScoreChange(itemNo: string, raw: string) {
    if (!criteria) return;
    const n = raw === "" ? 0 : Number(raw);
    setScores((prev) => ({ ...prev, [itemNo]: clampScore(criteria, itemNo, n) }));
  }

  async function handleSave() {
    setMessage(null);
    if (!evaluatorName.trim()) {
      setMessage({ type: "error", text: "평가자 이름을 입력해주세요." });
      return;
    }
    if (!companyId) {
      setMessage({ type: "error", text: "평가 대상 업체를 선택해주세요." });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          evaluatorId: evaluatorName.trim(),
          scores,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "저장에 실패했습니다.");
      setMessage({ type: "success", text: "평가 점수가 저장되었습니다." });
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.",
      });
    } finally {
      setSaving(false);
    }
  }

  if (!criteria || !totals) {
    return (
      <main className="px-8 py-10 md:px-16">
        <p className="text-sm text-brand-muted">평가기준을 불러오는 중...</p>
      </main>
    );
  }

  const pfArea = criteria.areas.find((a) => a.type === "pass_fail");
  const scoreAreasForInput = criteria.areas.filter(
    (a) => a.type === "score" && !criteria.priceAreaCodes.includes(a.code)
  );
  const priceAreas = criteria.areas.filter((a) => criteria.priceAreaCodes.includes(a.code));
  const summaryAreaCodes = criteria.areas.filter((a) => a.type === "score").map((a) => a.code);

  const shortfall = Math.max(0, criteria.settings.negotiationThreshold - totals.totalScore);
  const qualifiedByScore = totals.totalScore >= criteria.settings.negotiationThreshold;

  return (
    <main className="flex flex-col gap-6 px-8 py-10 md:px-16 lg:flex-row lg:gap-8">
      <div className="flex flex-1 flex-col gap-6">
        {/* Control bar */}
        <div className="flex flex-col gap-5 rounded-xl bg-brand-bg p-5 sm:flex-row">
          <div className="flex w-full shrink-0 flex-col gap-1.5 sm:w-[280px]">
            <Label>평가자 이름 *</Label>
            <Input
              placeholder="예) 김평가"
              value={evaluatorName}
              onChange={(e) => setEvaluatorName(e.target.value)}
            />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <Label>평가 대상 업체 선택 *</Label>
            <Select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              disabled={loadingCompanies || companies.length === 0}
            >
              {companies.length === 0 && <option value="">등록된 업체가 없습니다</option>}
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {/* 버그 B: 업체명이 중복될 수 있어(예: "OK에듀테크" 2개 등록 사례 — 실제로 입찰가까지
                      동일한 경우가 있어 날짜만으로는 구분이 안 됨) 입찰가·등록 일시·업체 ID 뒷 4자리를
                      함께 표시해 어떤 조합이든 항상 구분되게 한다. */}
                  {c.name} · {Number(c.bid_price).toLocaleString()}원 ·{" "}
                  {new Date(c.created_at).toLocaleString("ko-KR", {
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  등록 (#{c.id.slice(-4)})
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* AI 채점 초안 배너 (docs/schema.md 2.6절) */}
        {aiDraft && (
          <div className="flex flex-col gap-2 rounded-xl border border-brand/30 bg-brand-bg p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-1 items-start gap-2.5">
                <Sparkles size={18} className="mt-0.5 shrink-0 text-brand" />
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-bold text-brand-dark">
                    AI가 생성한 채점 초안이 있습니다{aiApplied ? " (불러옴)" : ""}
                  </span>
                  <span className="text-[12px] text-brand-muted">
                    이 값은 AI 초안이며 검토 후 저장해야 확정됩니다. 점수는 자유롭게 수정할 수 있습니다.
                  </span>
                </div>
              </div>
              <Button
                variant={aiApplied ? "outline" : "primary"}
                className="shrink-0 px-4 py-2 text-[13px]"
                onClick={handleApplyAiDraft}
              >
                {aiApplied ? "AI 제안값 다시 불러오기" : "AI 제안값 불러오기"}
              </Button>
            </div>
            {aiDraft.overall_summary && (
              <div className="pl-[26px]">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedRationale((prev) => ({ ...prev, __overall: !prev.__overall }))
                  }
                  className="flex items-center gap-1 text-[11px] font-bold text-brand"
                >
                  AI 총평 {expandedRationale.__overall ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
                {expandedRationale.__overall && (
                  <p className="mt-1 whitespace-pre-line text-[12px] leading-4 text-brand-muted">
                    {aiDraft.overall_summary}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* PF card */}
        {pfArea && (
          <div className="flex flex-col gap-3 rounded-xl border border-brand-border bg-white p-5">
            <div className="text-[15px] font-black text-brand-dark">
              필수 자격 (관리자 판정 · 채점 대상 아님)
            </div>
            {pfArea.items.map((item) => (
              <div key={item.itemNo} className="flex items-center justify-between">
                <span className="text-sm text-brand-dark">
                  {item.itemNo}. {item.itemName}
                </span>
                {qualificationBadge(selectedCompany?.qualification_pass)}
              </div>
            ))}
            <p className="text-xs text-brand-muted">
              참고: 현재 스키마는 필수자격 판정을 업체 단위 통합값(qualification_pass)으로만
              저장하므로, 개별 항목 모두 동일한 통합 판정 값을 표시합니다.
            </p>
          </div>
        )}

        {/* Score areas */}
        {scoreAreasForInput.map((area) => {
          const color = getAreaColor(criteria.areas.filter((a) => a.type === "score").findIndex((a) => a.code === area.code));
          return (
            <div key={area.code} className="flex flex-col gap-1 rounded-xl border border-brand-border bg-white p-5">
              <div className="flex items-center justify-between border-b border-brand-border pb-2.5">
                <span className="flex items-center gap-2 text-[15px] font-black text-brand-dark">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                  {area.name}
                </span>
                <span className="text-[13px] font-bold" style={{ color }}>
                  영역 배점 {area.maxPoints}점
                </span>
              </div>
              {area.items.map((item) => {
                const rationale = aiApplied ? aiDraft?.item_scores[item.itemNo]?.rationale : undefined;
                const isExpanded = Boolean(expandedRationale[item.itemNo]);
                return (
                  <div key={item.itemNo} className="flex flex-col border-b border-brand-border/60 py-1 last:border-b-0">
                    <div className="flex items-center justify-between gap-4 py-2">
                      <div className="flex flex-1 flex-col gap-1">
                        <div className="text-sm text-brand-dark">
                          {item.itemNo}. {item.itemName}
                        </div>
                        <div className="text-xs text-brand-muted">확인서류: {item.docReference || "-"}</div>
                        <ProgressBar
                          value={scores[item.itemNo] ?? 0}
                          max={item.maxPoints ?? 1}
                          colorHex={color}
                          className="max-w-[200px]"
                        />
                      </div>
                      <div className="flex shrink-0 items-center gap-1 rounded-lg border border-brand-border bg-white px-2.5 py-2">
                        <input
                          type="number"
                          min={0}
                          max={item.maxPoints ?? undefined}
                          step={0.5}
                          value={scores[item.itemNo] ?? 0}
                          onChange={(e) => handleScoreChange(item.itemNo, e.target.value)}
                          className="w-14 text-right text-sm font-bold text-brand-dark focus:outline-none"
                        />
                        <span className="text-xs text-brand-muted">/ {item.maxPoints}</span>
                      </div>
                    </div>
                    {rationale && (
                      <div className="flex flex-col gap-1 pb-2 pl-0.5">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedRationale((prev) => ({ ...prev, [item.itemNo]: !prev[item.itemNo] }))
                          }
                          className="flex w-fit items-center gap-1 text-[11px] font-bold text-brand"
                        >
                          <Sparkles size={11} />
                          AI 채점 근거
                          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                        {isExpanded && (
                          <p className="text-[12px] leading-4 text-brand-muted">{rationale}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Price area (auto-calculated) */}
        {priceAreas.map((area) => (
          <div key={area.code} className="flex flex-col gap-1 rounded-xl border border-brand-border bg-white p-5">
            <div className="flex items-center justify-between border-b border-brand-border pb-2.5">
              <span className="text-[15px] font-black text-brand-dark">{area.name}</span>
              <span className="text-[13px] font-bold text-brand">영역 배점 {area.maxPoints}점</span>
            </div>
            {area.items.map((item) => (
              <div key={item.itemNo} className="flex items-center justify-between gap-4 py-3">
                <div className="flex flex-1 flex-col gap-0.5">
                  <div className="text-sm text-brand-dark">
                    {item.itemNo}. {item.itemName} (자동계산 표시)
                  </div>
                  <div className="text-xs text-brand-muted">
                    확인서류: {item.docReference || "가격입찰서"} · {criteria.priceTotalPoints} × 최저입찰가
                    ÷ 해당업체입찰가, 소수 둘째자리 반올림
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1 rounded-lg border border-brand-border bg-white px-2.5 py-2">
                  <span className="text-sm font-bold text-brand-dark">{totals.priceTotal}</span>
                  <span className="text-xs text-brand-muted">/ {item.maxPoints}</span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Summary sidebar */}
      <div className="flex w-full shrink-0 flex-col gap-4 lg:w-[340px]">
        <div className="flex flex-col items-center gap-4 rounded-xl bg-gradient-to-br from-[#2A232A] to-brand-dark2 p-6">
          <div className="w-full text-sm font-bold text-white">실시간 점수 합계</div>
          <DonutGauge
            value={totals.totalScore}
            max={criteria.grandTotalPoints}
            color={qualifiedByScore ? "#4CAF50" : "#FF9900"}
            label={String(totals.totalScore)}
            sublabel={`/ ${criteria.grandTotalPoints}점`}
            labelClassName="text-white"
            sublabelClassName="text-[#D8CFD3]"
          />

          {!qualifiedByScore && (
            <div className="flex w-full items-center gap-2 rounded-xl bg-[#FFF3DD24] px-3.5 py-2.5">
              <AlertTriangle size={14} className="shrink-0 text-brand-amber" />
              <p className="text-[11px] leading-4 text-brand-amber">
                협상적격 기준({criteria.settings.negotiationThreshold}점)까지{" "}
                {Math.round(shortfall * 100) / 100}점 부족
              </p>
            </div>
          )}

          <div className="flex w-full flex-col gap-2">
            {summaryAreaCodes.map((code) => {
              const area = criteria.areas.find((a) => a.code === code)!;
              return (
                <div key={code} className="flex justify-between text-[13px]">
                  <span className="text-[#D8D2D8]">{area.name}</span>
                  <span className="font-bold text-white">
                    {totals.areaSubtotals[code] ?? 0} / {area.maxPoints}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="h-px w-full bg-[#5A505A]" />
          <div className="flex w-full justify-between">
            <span className="text-sm font-bold text-white">기술점수 합계</span>
            <span className="text-base font-black text-white">
              {totals.technicalTotal} / {criteria.technicalTotalPoints}
            </span>
          </div>
          <div className="flex w-full justify-between">
            <span className="text-sm font-bold text-white">가격점수</span>
            <span className="text-base font-black text-white">
              {totals.priceTotal} / {criteria.priceTotalPoints}
            </span>
          </div>
          <div className="flex w-full items-center justify-between rounded-lg bg-brand px-3.5 py-3">
            <span className="text-[15px] font-black text-white">총점</span>
            <span className="text-xl font-black text-white">
              {totals.totalScore} / {criteria.grandTotalPoints}
            </span>
          </div>
          <p className="w-full text-[11px] leading-[15px] text-[#D8D2D8]">
            협상적격 기준: 총점 {criteria.settings.negotiationThreshold}점 이상. 입력 즉시 합계가
            갱신됩니다.
          </p>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full justify-center py-3">
          {saving ? "저장 중..." : "평가 점수 저장"}
        </Button>

        {message && (
          <div
            className={`rounded-lg p-3 text-sm ${
              message.type === "success"
                ? "bg-brand-bg text-brand-green"
                : "bg-brand-highlight text-brand-red"
            }`}
          >
            {message.text}
          </div>
        )}
      </div>
    </main>
  );
}
