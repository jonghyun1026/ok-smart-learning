"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles, FileText, Bot } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";
import type { AiEvaluationDraft } from "@/lib/supabase";
import type { CriteriaData } from "@/lib/scoring";
import { getAreaColor } from "@/lib/area-colors";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";

type CompanyLite = { id: string; name: string };

type DraftWithCompany = AiEvaluationDraft & { companyName: string };

/**
 * AI 채점 초안(ai_evaluation_drafts, docs/schema.md 2.6절) 중 status="completed"인
 * 업체만 목록으로 보여주고, 항목별 점수 근거(rationale)를 전체 펼친 상태로 상세히 노출한다.
 * 이 화면은 초안을 "적용"하지 않는다 — 순수 열람용이며 확정은 여전히 평가입력 화면에서만 이뤄진다.
 */
export function AiRationale() {
  const [criteria, setCriteria] = useState<CriteriaData | null>(null);
  const [drafts, setDrafts] = useState<DraftWithCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const criteriaRes = await fetch("/api/criteria").then((r) => r.json());
      setCriteria((criteriaRes.data as CriteriaData) ?? null);

      const supabase = getSupabaseClient();
      const [{ data: companies }, { data: draftRows, error }] = await Promise.all([
        supabase.from("companies").select("id, name"),
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
      const nameById = new Map((companies as CompanyLite[] | null)?.map((c) => [c.id, c.name]) ?? []);
      const merged = (draftRows as AiEvaluationDraft[] | null ?? []).map((d) => ({
        ...d,
        companyName: nameById.get(d.company_id) ?? "(삭제된 업체)",
      }));
      setDrafts(merged);
      setSelectedId((prev) => prev ?? merged[0]?.id ?? null);
      setLoading(false);
    }
    load();
  }, []);

  const selected = useMemo(() => drafts.find((d) => d.id === selectedId) ?? null, [drafts, selectedId]);

  const scoreAreas = useMemo(
    () => criteria?.areas.filter((a) => a.type === "score" && !criteria.priceAreaCodes.includes(a.code)) ?? [],
    [criteria]
  );

  if (loading || !criteria) {
    return <p className="text-sm text-brand-muted">불러오는 중...</p>;
  }

  if (drafts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-brand-border bg-brand-bg p-10 text-center">
        <Bot size={22} className="text-brand-muted" />
        <p className="text-sm font-bold text-brand-dark">완료된 AI 평가 초안이 없습니다.</p>
        <p className="text-xs text-brand-muted">
          Claude Code 세션에서 &quot;OO업체 평가해줘&quot;라고 요청하면 evaluation-agent가 채점 후
          여기에 상세 근거가 표시됩니다.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 lg:flex-row">
      {/* 업체 목록 */}
      <div className="flex w-full shrink-0 flex-col gap-2 lg:w-[280px]">
        {drafts.map((d) => (
          <button
            key={d.id}
            onClick={() => setSelectedId(d.id)}
            className={`flex flex-col gap-1 rounded-xl border p-3.5 text-left transition-colors ${
              selectedId === d.id
                ? "border-brand bg-brand-highlight"
                : "border-brand-border bg-white hover:bg-brand-bg"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-brand-dark">{d.companyName}</span>
              <Badge tone="brand">완료</Badge>
            </div>
            <span className="text-[11px] text-brand-muted">
              {d.model} · {new Date(d.updated_at).toLocaleString("ko-KR")}
            </span>
          </button>
        ))}
      </div>

      {/* 상세 근거 */}
      {selected && (
        <div className="flex flex-1 flex-col gap-5">
          <div className="flex flex-col gap-1 rounded-xl border border-brand-border bg-white p-5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[17px] font-black text-brand-dark">{selected.companyName}</span>
              <span className="text-[11px] text-brand-muted">
                모델: {selected.model} · 생성 시각 {new Date(selected.updated_at).toLocaleString("ko-KR")}
              </span>
            </div>
            <p className="text-xs text-brand-muted">
              아래 점수·근거는 evaluation-agent가 생성한 AI 채점 초안입니다. 실제 확정 점수는 평가자가
              [평가입력] 화면에서 검토·수정 후 저장한 값이며 이 화면과 다를 수 있습니다.
            </p>
          </div>

          {selected.overall_summary && (
            <div className="flex flex-col gap-2 rounded-xl border border-brand/30 bg-brand-bg p-5">
              <span className="flex items-center gap-1.5 text-sm font-bold text-brand-dark">
                <Sparkles size={15} className="text-brand" />
                AI 총평
              </span>
              <p className="whitespace-pre-line text-[13px] leading-5 text-brand-dark">
                {selected.overall_summary}
              </p>
            </div>
          )}

          {scoreAreas.map((area, areaIdx) => {
            const color = getAreaColor(areaIdx);
            const areaItems = area.items.filter((item) => item.itemType === "score");
            if (areaItems.length === 0) return null;
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
                {areaItems.map((item) => {
                  const entry = selected.item_scores[item.itemNo];
                  return (
                    <div key={item.itemNo} className="flex flex-col gap-1.5 border-b border-brand-border/60 py-3 last:border-b-0">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex flex-1 flex-col gap-1">
                          <div className="text-sm text-brand-dark">
                            {item.itemNo}. {item.itemName}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-brand-muted">
                            <FileText size={11} />
                            확인서류: {item.docReference || "-"}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1 rounded-lg border border-brand-border bg-white px-2.5 py-2">
                          <span className="text-sm font-bold text-brand-dark">
                            {entry ? entry.score : "-"}
                          </span>
                          <span className="text-xs text-brand-muted">/ {item.maxPoints}</span>
                        </div>
                      </div>
                      {entry && (
                        <>
                          <ProgressBar
                            value={entry.score}
                            max={item.maxPoints ?? 1}
                            colorHex={color}
                            className="max-w-[240px]"
                          />
                          <div className="flex items-start gap-1.5 rounded-lg bg-brand-bg p-3">
                            <Sparkles size={13} className="mt-0.5 shrink-0 text-brand" />
                            <p className="text-[12.5px] leading-5 text-brand-dark">{entry.rationale}</p>
                          </div>
                        </>
                      )}
                      {!entry && (
                        <p className="text-xs text-brand-muted">이 항목에 대한 AI 채점 근거가 없습니다.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
