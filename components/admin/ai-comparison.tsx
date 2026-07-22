"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, FileText, GitCompare, Trophy } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";
import type { AiEvaluationDraft } from "@/lib/supabase";
import type { CriteriaData } from "@/lib/scoring";
import { getAreaColor } from "@/lib/area-colors";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { RationaleBlocks } from "@/components/ui/rationale-blocks";

type CompanyLite = { id: string; name: string; bid_price: number };

type DraftWithCompany = AiEvaluationDraft & { companyName: string; bidPrice: number };

/**
 * 여러 업체의 AI 채점 초안(status="completed")을 항목 단위로 나란히 비교하는 화면.
 * ai-rationale.tsx(단일 업체 상세 열람)와 달리 "같은 항목에서 업체별 점수·근거가 어떻게
 * 다른가"를 한 화면에서 스캔할 수 있게 항목이 1등 시민(row)이고 업체가 그 안의 열이다.
 * 열람 전용 — 여기서 아무것도 확정하지 않는다.
 */
export function AiComparison() {
  const [criteria, setCriteria] = useState<CriteriaData | null>(null);
  const [drafts, setDrafts] = useState<DraftWithCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function load() {
      const criteriaRes = await fetch("/api/criteria").then((r) => r.json());
      setCriteria((criteriaRes.data as CriteriaData) ?? null);

      const supabase = getSupabaseClient();
      const [{ data: companies }, { data: draftRows, error }] = await Promise.all([
        supabase.from("companies").select("id, name, bid_price"),
        supabase
          .from("ai_evaluation_drafts")
          .select("*")
          .eq("status", "completed")
          .order("updated_at", { ascending: false }),
      ]);
      if (error) {
        console.error(error);
        setLoading(false);
        return;
      }
      const companyById = new Map((companies as CompanyLite[] | null)?.map((c) => [c.id, c]) ?? []);
      const merged = (draftRows as AiEvaluationDraft[] | null ?? [])
        .map((d) => {
          const company = companyById.get(d.company_id);
          return { ...d, companyName: company?.name ?? "(삭제된 업체)", bidPrice: Number(company?.bid_price) || 0 };
        })
        // 같은 업체가 여러 번 채점됐을 리는 없지만(company_id unique), 방어적으로 최신만 유지
        .filter((d, idx, arr) => arr.findIndex((x) => x.company_id === d.company_id) === idx);
      setDrafts(merged);
      setLoading(false);
    }
    load();
  }, []);

  const scoreAreas = useMemo(
    () => criteria?.areas.filter((a) => a.type === "score" && !criteria.priceAreaCodes.includes(a.code)) ?? [],
    [criteria]
  );

  const ranked = useMemo(() => {
    if (!criteria) return [];
    return [...drafts]
      .map((d) => {
        const technicalTotal = criteria.manualScoreItemNos.reduce((sum, no) => {
          const entry = d.item_scores[no];
          return sum + (entry ? Number(entry.score) || 0 : 0);
        }, 0);
        return { draft: d, technicalTotal: Math.round(technicalTotal * 10) / 10 };
      })
      .sort((a, b) => b.technicalTotal - a.technicalTotal);
  }, [criteria, drafts]);

  function toggleItem(itemNo: string) {
    setExpandedItems((prev) => ({ ...prev, [itemNo]: !prev[itemNo] }));
  }

  if (loading || !criteria) {
    return <p className="text-sm text-brand-muted">불러오는 중...</p>;
  }

  if (drafts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-brand-border bg-brand-bg p-10 text-center">
        <GitCompare size={22} className="text-brand-muted" />
        <p className="text-sm font-bold text-brand-dark">완료된 AI 평가 초안이 없습니다.</p>
        <p className="text-xs text-brand-muted">2개 이상의 업체를 평가하면 여기서 항목별로 나란히 비교할 수 있습니다.</p>
      </div>
    );
  }

  if (drafts.length === 1) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-brand-border bg-brand-bg p-10 text-center">
        <GitCompare size={22} className="text-brand-muted" />
        <p className="text-sm font-bold text-brand-dark">
          현재 {drafts[0].companyName} 1개 업체만 AI 채점이 완료되어 있습니다.
        </p>
        <p className="text-xs text-brand-muted">
          다른 업체도 평가하면 항목별로 나란히 비교할 수 있습니다. 지금은 [AI 평가근거] 탭에서 단일 열람이 가능합니다.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 rounded-xl border border-brand-border bg-white p-5">
        <span className="flex items-center gap-1.5 text-[15px] font-black text-brand-dark">
          <GitCompare size={16} className="text-brand" />
          AI 채점 초안 비교 ({drafts.length}개사)
        </span>
        <p className="text-xs text-brand-muted">
          evaluation-agent가 생성한 AI 초안을 업체별로 나란히 비교합니다. 실제 확정 점수는 평가자가
          [평가입력] 화면에서 검토·수정 후 저장한 값이며 이 화면과 다를 수 있습니다.
        </p>
      </div>

      {/* 총점 순위 */}
      <div className="flex flex-col gap-3 rounded-xl border border-brand-border bg-white p-5">
        <div className="text-[13px] font-bold text-brand-dark">AI 기술점수 합계 순위 (가격점수 제외)</div>
        {ranked.map(({ draft, technicalTotal }, idx) => (
          <div key={draft.id} className="flex items-center gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-bg text-[11px] font-bold text-brand-dark">
              {idx === 0 ? <Trophy size={13} className="text-brand-amber" /> : idx + 1}
            </span>
            <div className="flex w-[140px] shrink-0 flex-col">
              <span className="text-sm font-bold text-brand-dark">{draft.companyName}</span>
              <span className="text-[11px] text-brand-muted">{draft.bidPrice.toLocaleString()}원</span>
            </div>
            <ProgressBar value={technicalTotal} max={criteria.technicalTotalPoints} className="flex-1" />
            <span className="w-[80px] shrink-0 text-right text-sm font-bold text-brand-dark">
              {technicalTotal} / {criteria.technicalTotalPoints}
            </span>
          </div>
        ))}
      </div>

      {/* 항목별 비교 */}
      {scoreAreas.map((area, areaIdx) => {
        const color = getAreaColor(areaIdx);
        const items = area.items.filter((item) => item.itemType === "score");
        if (items.length === 0) return null;
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
            {items.map((item) => {
              const scoresByCompany = drafts.map((d) => ({
                draft: d,
                entry: d.item_scores[item.itemNo] as { score: number; rationale: string } | undefined,
              }));
              const maxScore = Math.max(
                0,
                ...scoresByCompany.map((s) => (s.entry ? Number(s.entry.score) || 0 : -1))
              );
              const isExpanded = Boolean(expandedItems[item.itemNo]);
              return (
                <div key={item.itemNo} className="flex flex-col border-b border-brand-border/60 py-3 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => toggleItem(item.itemNo)}
                    className="flex w-full items-start justify-between gap-4 text-left"
                  >
                    <div className="flex flex-1 flex-col gap-1">
                      <div className="text-sm text-brand-dark">
                        {item.itemNo}. {item.itemName}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-brand-muted">
                        <FileText size={11} />
                        확인서류: {item.docReference || "-"}
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp size={16} className="mt-0.5 shrink-0 text-brand-muted" />
                    ) : (
                      <ChevronDown size={16} className="mt-0.5 shrink-0 text-brand-muted" />
                    )}
                  </button>

                  <div className="mt-2 flex flex-col gap-2">
                    {scoresByCompany.map(({ draft, entry }) => {
                      const score = entry ? Number(entry.score) || 0 : 0;
                      const isTop = entry && score === maxScore && maxScore > 0;
                      return (
                        <div key={draft.id} className="flex items-center gap-3">
                          <span className="w-[120px] shrink-0 truncate text-[12.5px] font-bold text-brand-dark">
                            {draft.companyName}
                          </span>
                          <ProgressBar
                            value={score}
                            max={item.maxPoints ?? 1}
                            colorHex={color}
                            className="flex-1"
                          />
                          <span
                            className={`flex w-[60px] shrink-0 items-center justify-end gap-1 text-[12.5px] font-bold ${
                              isTop ? "text-brand" : "text-brand-dark"
                            }`}
                          >
                            {isTop && <Trophy size={11} className="text-brand-amber" />}
                            {entry ? score : "-"} / {item.maxPoints}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {isExpanded && (
                    <div className="mt-3 flex flex-col gap-3 border-t border-dashed border-brand-border pt-3">
                      {scoresByCompany.map(({ draft, entry }) => (
                        <div key={draft.id} className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            <Badge tone="brand">{draft.companyName}</Badge>
                          </div>
                          {entry ? (
                            <RationaleBlocks text={entry.rationale} />
                          ) : (
                            <p className="text-xs text-brand-muted">이 항목에 대한 AI 채점 근거가 없습니다.</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
