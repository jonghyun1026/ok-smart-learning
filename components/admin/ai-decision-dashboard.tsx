"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Gauge,
  LayoutGrid,
  Layers,
  Scale,
  Sparkles,
  Trophy,
  Wallet,
  XCircle,
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";
import type { AiEvaluationDraft } from "@/lib/supabase";
import {
  calcPriceScore,
  isNegotiationQualified,
  type CriteriaData,
  type CriteriaItem,
} from "@/lib/scoring";
import { getCompanyColor } from "@/lib/company-colors";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { RationaleBlocks } from "@/components/ui/rationale-blocks";
import { CompanyRadarChart, type RadarCompanyRow } from "@/components/admin/company-radar-chart";
import { ComparisonDiagnosis, type DiagnosisCompany } from "@/components/admin/comparison-diagnosis";

type CompanyLite = { id: string; name: string; bid_price: number; qualification_pass: boolean | null };

type DraftWithCompany = AiEvaluationDraft & {
  companyName: string;
  bidPrice: number;
  qualificationPass: boolean | null;
};

/**
 * evaluation-agent는 5단계 근거 구조상 "[사람 검증 필요]" 라벨을 거의 모든 항목에 형식적으로
 * 붙이고, 우려사항이 없을 땐 본문에 "특이사항 없음"류 문구만 적는다. 라벨 존재만으로 플래그하면
 * 사실상 전 항목이 걸려 신호가 죽으므로, 라벨 뒤 본문이 "없음"으로 시작하지 않는 경우만 실제
 * 우려사항으로 취급한다.
 */
function hasHumanFlag(rationale: string): boolean {
  const matches = Array.from(rationale.matchAll(/\[([^[\]]{2,40})\]/g));
  for (let i = 0; i < matches.length; i++) {
    const label = matches[i][1];
    if (!/사람 검증|검증 필요|플래그/.test(label)) continue;
    const start = matches[i].index! + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : rationale.length;
    const text = rationale.slice(start, end).trim();
    if (text && !/^(특이사항\s*)?없[음다]/.test(text)) return true;
  }
  return false;
}

function itemShortName(name: string, len = 14): string {
  return name.length > len ? `${name.slice(0, len - 1)}…` : name;
}

const SECTION_CARD = "rounded-2xl border border-brand-border bg-white p-6 shadow-sm";

/**
 * AI 채점 초안(status="completed") 기반 의사결정 대시보드. [종합결과] 탭 안에 임베드된다.
 * 개요(총점·레이더·강약점) → 비용 → 콘텐츠/운영/부가서비스/시스템/기업역량 → 항목 상세 순으로
 * 세그먼트 탭을 둬 한 화면에 모든 차트를 쏟아붓지 않고 필요한 만큼만 펼쳐본다(progressive
 * disclosure). 카테고리 그룹핑은 criteria 영역명/항목명 텍스트 매칭으로 동적으로 만들어지며
 * item_no를 하드코딩하지 않는다 — 관리자가 항목을 고쳐도 그대로 반영된다.
 * 열람 전용 — 여기서 아무것도 확정하지 않는다.
 */
export function AiDecisionDashboard() {
  const [criteria, setCriteria] = useState<CriteriaData | null>(null);
  const [allCompanies, setAllCompanies] = useState<CompanyLite[]>([]);
  const [drafts, setDrafts] = useState<DraftWithCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [section, setSection] = useState<string>("diagnosis");

  useEffect(() => {
    async function load() {
      const criteriaRes = await fetch("/api/criteria").then((r) => r.json());
      setCriteria((criteriaRes.data as CriteriaData) ?? null);

      const supabase = getSupabaseClient();
      const [{ data: companies }, { data: draftRows, error }] = await Promise.all([
        supabase.from("companies").select("id, name, bid_price, qualification_pass"),
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
      const companyList = (companies as CompanyLite[] | null) ?? [];
      setAllCompanies(companyList);
      const companyById = new Map(companyList.map((c) => [c.id, c]));
      const merged = (draftRows as AiEvaluationDraft[] | null ?? [])
        .map((d) => {
          const company = companyById.get(d.company_id);
          return {
            ...d,
            companyName: company?.name ?? "(삭제된 업체)",
            bidPrice: Number(company?.bid_price) || 0,
            qualificationPass: company?.qualification_pass ?? null,
          };
        })
        .filter((d, idx, arr) => arr.findIndex((x) => x.company_id === d.company_id) === idx);
      setDrafts(merged);
      setLoading(false);
    }
    load();
  }, []);

  // 색상은 순위가 아니라 업체(entity) 자체에 고정 배정한다 — company_id 오름차순으로 정렬해
  // 어떤 목록에서 어떤 순서로 보여지든 항상 같은 업체가 같은 색을 갖는다.
  const colorOrder = useMemo(
    () => [...drafts].sort((a, b) => a.company_id.localeCompare(b.company_id)),
    [drafts]
  );
  const companyColorMap = useMemo(() => {
    const m = new Map<string, string>();
    colorOrder.forEach((d, idx) => m.set(d.company_id, getCompanyColor(idx)));
    return m;
  }, [colorOrder]);
  const companyColor = (id: string) => companyColorMap.get(id) ?? "#F04E23";

  const displayNames = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of drafts) counts.set(d.companyName, (counts.get(d.companyName) ?? 0) + 1);
    const map = new Map<string, string>();
    for (const d of drafts) {
      const isDup = (counts.get(d.companyName) ?? 0) > 1;
      map.set(d.company_id, isDup ? `${d.companyName} (#${d.company_id.slice(-4)})` : d.companyName);
    }
    return map;
  }, [drafts]);

  const lowestBidPrice = useMemo(() => {
    const prices = allCompanies.map((c) => Number(c.bid_price)).filter((v) => v > 0);
    return prices.length > 0 ? Math.min(...prices) : 0;
  }, [allCompanies]);

  const categories = useMemo(() => {
    if (!criteria) return [];
    const scoreItems = criteria.items.filter((i) => i.itemType === "score");
    const byArea = (needle: string) => scoreItems.filter((i) => i.areaName.includes(needle));
    const addon = scoreItems.filter((i) => i.itemName.includes("부가서비스"));
    const addonNos = new Set(addon.map((i) => i.itemNo));
    const ops = byArea("운영").filter((i) => !addonNos.has(i.itemNo));
    const content = byArea("콘텐츠");
    const system = byArea("시스템");
    const general = byArea("일반");

    const list: { key: string; label: string; items: CriteriaItem[] }[] = [];
    if (content.length) list.push({ key: "content", label: "콘텐츠", items: content });
    if (ops.length) list.push({ key: "ops", label: "운영·관리", items: ops });
    if (addon.length) list.push({ key: "addon", label: "부가서비스", items: addon });
    if (system.length) list.push({ key: "system", label: "시스템·보안", items: system });
    if (general.length) list.push({ key: "general", label: "기업역량", items: general });
    return list;
  }, [criteria]);

  const ranked = useMemo(() => {
    if (!criteria) return [];
    return drafts
      .map((d) => {
        const technicalTotal = criteria.manualScoreItemNos.reduce((sum, no) => {
          const entry = d.item_scores[no];
          return sum + (entry ? Number(entry.score) || 0 : 0);
        }, 0);
        const priceScore = calcPriceScore(criteria, d.bidPrice, lowestBidPrice);
        const estimatedTotal = Math.round((technicalTotal + priceScore) * 100) / 100;
        const qualified = isNegotiationQualified(criteria, estimatedTotal, d.qualificationPass);
        return {
          draft: d,
          technicalTotal: Math.round(technicalTotal * 10) / 10,
          priceScore,
          estimatedTotal,
          qualified,
        };
      })
      .sort((a, b) => b.estimatedTotal - a.estimatedTotal);
  }, [criteria, drafts, lowestBidPrice]);

  const radarRows: RadarCompanyRow[] = useMemo(() => {
    if (!criteria) return [];
    return ranked.map(({ draft, estimatedTotal, priceScore }) => {
      const areaScores: Record<string, number> = {};
      for (const area of criteria.areas) {
        if (area.type !== "score") continue;
        if (criteria.priceAreaCodes.includes(area.code)) {
          areaScores[area.code] = priceScore;
          continue;
        }
        const sum = area.items.reduce((s, item) => {
          if (item.itemType !== "score") return s;
          const entry = draft.item_scores[item.itemNo];
          return s + (entry ? Number(entry.score) || 0 : 0);
        }, 0);
        areaScores[area.code] = sum;
      }
      return {
        company_id: draft.company_id,
        company_name: draft.companyName,
        avg_total_score: estimatedTotal,
        areaScores,
      };
    });
  }, [criteria, ranked]);

  const prosCons = useMemo(() => {
    if (!criteria)
      return new Map<
        string,
        { strengths: { item: CriteriaItem; pct: number }[]; weaknesses: { item: CriteriaItem; pct: number }[]; flagged: CriteriaItem[] }
      >();
    const scoreItems = criteria.items.filter((i) => i.itemType === "score");
    const map = new Map<
      string,
      { strengths: { item: CriteriaItem; pct: number }[]; weaknesses: { item: CriteriaItem; pct: number }[]; flagged: CriteriaItem[] }
    >();
    for (const d of drafts) {
      const rows = scoreItems
        .map((item) => {
          const entry = d.item_scores[item.itemNo];
          const score = entry ? Number(entry.score) || 0 : 0;
          const pct = item.maxPoints ? (score / item.maxPoints) * 100 : 0;
          return { item, entry, pct };
        })
        .filter((r) => r.entry);
      const sorted = [...rows].sort((a, b) => b.pct - a.pct);
      const strengths = sorted.slice(0, 3).map((r) => ({ item: r.item, pct: Math.round(r.pct) }));
      const weaknesses = sorted
        .slice(-3)
        .reverse()
        .map((r) => ({ item: r.item, pct: Math.round(r.pct) }));
      const flagged = rows.filter((r) => r.entry && hasHumanFlag(r.entry.rationale)).map((r) => r.item);
      map.set(d.company_id, { strengths, weaknesses, flagged });
    }
    return map;
  }, [criteria, drafts]);

  function toggleItem(itemNo: string) {
    setExpandedItems((prev) => ({ ...prev, [itemNo]: !prev[itemNo] }));
  }

  if (loading || !criteria) {
    return <p className="text-sm text-brand-muted">AI 초안을 불러오는 중...</p>;
  }

  if (drafts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-brand-border bg-brand-bg p-10 text-center">
        <Sparkles size={22} className="text-brand-muted" />
        <p className="text-sm font-bold text-brand-dark">완료된 AI 평가 초안이 없습니다.</p>
        <p className="text-xs text-brand-muted">
          Claude Code 세션에서 &quot;OO업체 평가해줘&quot;라고 요청하면 evaluation-agent가 채점 후 여기에
          의사결정용 비교 대시보드가 표시됩니다.
        </p>
      </div>
    );
  }

  if (drafts.length === 1) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-brand-border bg-brand-bg p-10 text-center">
        <Sparkles size={22} className="text-brand-muted" />
        <p className="text-sm font-bold text-brand-dark">
          현재 {drafts[0].companyName} 1개 업체만 AI 채점이 완료되어 있습니다.
        </p>
        <p className="text-xs text-brand-muted">다른 업체도 평가하면 여기서 나란히 비교할 수 있습니다.</p>
      </div>
    );
  }

  const priceCostData = ranked.map(({ draft }) => ({
    name: displayNames.get(draft.company_id) ?? draft.companyName,
    id: draft.company_id,
    price: draft.bidPrice,
  }));
  const priceScoreData = ranked.map(({ draft, priceScore }) => ({
    name: displayNames.get(draft.company_id) ?? draft.companyName,
    id: draft.company_id,
    score: priceScore,
  }));

  const diagnosisCompanies: DiagnosisCompany[] = ranked.map(({ draft }) => ({
    id: draft.company_id,
    name: draft.companyName,
    bidPrice: draft.bidPrice,
    color: companyColor(draft.company_id),
    facts: draft.comparison_facts,
  }));

  const sections: { key: string; label: string; icon: typeof LayoutGrid }[] = [
    { key: "diagnosis", label: "비교 진단", icon: Scale },
    { key: "overview", label: "개요", icon: LayoutGrid },
    { key: "cost", label: "비용", icon: Wallet },
    ...categories.map((c) => ({ key: c.key, label: c.label, icon: Layers })),
    { key: "detail", label: "항목 상세", icon: FileText },
  ];

  function CategoryChart({ items }: { items: CriteriaItem[] }) {
    const chartData = items.map((item) => {
      const row: Record<string, string | number> = {
        name: itemShortName(item.itemName),
        fullName: item.itemName,
        max: item.maxPoints ?? 0,
      };
      for (const { draft } of ranked) {
        const entry = draft.item_scores[item.itemNo];
        const score = entry ? Number(entry.score) || 0 : 0;
        row[draft.company_id] = item.maxPoints ? Math.round((score / item.maxPoints) * 1000) / 10 : 0;
        row[`${draft.company_id}__raw`] = score;
      }
      return row;
    });
    const chartHeight = Math.max(items.length * (26 * ranked.length + 24) + 40, 160);
    return (
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} stroke="#eeece7" />
          <XAxis type="number" domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 11, fill: "#ADA6A0" }} axisLine={{ stroke: "#eeece7" }} tickLine={false} />
          <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12, fontWeight: 700, fill: "#52514E" }} axisLine={{ stroke: "#eeece7" }} tickLine={false} />
          <Tooltip
            formatter={(value, name, item) => {
              const dataKey = String(item?.dataKey ?? "");
              const payload = item?.payload as Record<string, number> | undefined;
              const raw = payload ? payload[`${dataKey}__raw`] : undefined;
              const max = payload ? payload.max : undefined;
              return [`${value}% (${raw ?? "-"}/${max ?? "-"}점)`, name];
            }}
            labelFormatter={(_, payload) => (payload?.[0]?.payload as { fullName?: string })?.fullName ?? ""}
            contentStyle={{ borderRadius: 10, border: "1px solid #E8E2DD", fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 12, fontWeight: 700 }} iconType="circle" />
          {ranked.map(({ draft }) => (
            <Bar
              key={draft.company_id}
              dataKey={draft.company_id}
              name={displayNames.get(draft.company_id) ?? draft.companyName}
              fill={companyColor(draft.company_id)}
              radius={[0, 4, 4, 0]}
              barSize={16}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  const activeCategory = categories.find((c) => c.key === section);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-[15px] font-black text-brand-dark">
          <Sparkles size={16} className="text-brand" />
          AI 초안 기반 의사결정 대시보드
        </span>
        <span className="text-[11px] text-brand-muted">
          evaluation-agent 초안 · 확정 점수는 아래 &quot;확정 평가 결과&quot;를 따릅니다
        </span>
      </div>

      {/* 세그먼트 내비게이션 */}
      <div className="flex flex-wrap gap-1 rounded-full bg-brand-bg p-1">
        {sections.map((s) => {
          const Icon = s.icon;
          const active = section === s.key;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setSection(s.key)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-bold transition-all",
                active ? "bg-white text-brand shadow-sm" : "text-brand-muted hover:text-brand-dark"
              )}
            >
              <Icon size={14} />
              {s.label}
            </button>
          );
        })}
      </div>

      {/* 비교 진단: 제안서에서 추출한 사실 기반 비교 (콘텐츠 규모/비용/부가서비스/운영/종합진단) */}
      {section === "diagnosis" && <ComparisonDiagnosis companies={diagnosisCompanies} />}

      {/* 개요: 히어로 순위 카드 + 레이더 + 강약점 */}
      {section === "overview" && (
        <div className="flex flex-col gap-5">
          <div className={cn("grid grid-cols-1 gap-4", ranked.length <= 2 ? "md:grid-cols-2" : "md:grid-cols-3")}>
            {ranked.map(({ draft, technicalTotal, priceScore, estimatedTotal, qualified }, idx) => (
              <div
                key={draft.id}
                className={cn(
                  "flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-brand-border",
                  idx === 0 && "shadow-md ring-brand-amber/50"
                )}
                style={{ borderTop: `4px solid ${companyColor(draft.company_id)}` }}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    {idx === 0 && <Trophy size={16} className="text-brand-amber" />}
                    <span className="text-[11px] font-bold text-brand-muted">{idx + 1}위</span>
                  </span>
                  {qualified ? (
                    <Badge tone="green">협상적격(예상)</Badge>
                  ) : (
                    <Badge tone="neutral">기준 미달(예상)</Badge>
                  )}
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-base font-black text-brand-dark">{draft.companyName}</span>
                  <span className="text-[12px] text-brand-muted">{draft.bidPrice.toLocaleString()}원</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-5xl font-black leading-none text-brand-dark">{estimatedTotal}</span>
                  <span className="text-sm font-bold text-brand-muted">/ {criteria.grandTotalPoints}</span>
                </div>
                <div className="flex flex-col gap-2 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="w-[46px] shrink-0 text-[11px] text-brand-muted">기술</span>
                    <ProgressBar value={technicalTotal} max={criteria.technicalTotalPoints} colorHex={companyColor(draft.company_id)} className="flex-1" />
                    <span className="w-[54px] shrink-0 text-right text-[11px] font-bold text-brand-dark">
                      {technicalTotal}/{criteria.technicalTotalPoints}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-[46px] shrink-0 text-[11px] text-brand-muted">가격</span>
                    <ProgressBar value={priceScore} max={criteria.priceTotalPoints} colorHex={companyColor(draft.company_id)} className="flex-1" />
                    <span className="w-[54px] shrink-0 text-right text-[11px] font-bold text-brand-dark">
                      {priceScore}/{criteria.priceTotalPoints}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="flex items-center gap-1 text-[11px] text-brand-muted">
            <Gauge size={12} />
            협상적격 기준(예상): 총점 {criteria.settings.negotiationThreshold}점 이상 AND 필수자격 Pass
          </p>

          <div className={SECTION_CARD}>
            <CompanyRadarChart
              criteria={criteria}
              companies={radarRows}
              title="업체 간 균형 비교"
              description="AI 초안의 영역별 점수(가격 포함)를 영역 만점 대비 백분율로 정규화해 겹쳐 표시합니다."
              colorFor={companyColor}
            />
          </div>

          <div className={cn(SECTION_CARD, "flex flex-col gap-4")}>
            <span className="text-[13px] font-bold text-brand-dark">업체별 강점 · 보완 필요 항목 (자동 요약)</span>
            <div className={cn("grid grid-cols-1 gap-4", ranked.length <= 2 ? "md:grid-cols-2" : "md:grid-cols-3")}>
              {ranked.map(({ draft }) => {
                const pc = prosCons.get(draft.company_id);
                const isLowestBid = draft.bidPrice > 0 && draft.bidPrice === lowestBidPrice;
                return (
                  <div key={draft.id} className="flex flex-col gap-3 rounded-xl border border-brand-border p-4">
                    <span className="flex items-center gap-2 text-sm font-black text-brand-dark">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: companyColor(draft.company_id) }} />
                      {draft.companyName}
                    </span>

                    <div className="flex flex-col gap-1.5 rounded-lg bg-[#EDF7F0] p-3">
                      <span className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wide text-brand-green">
                        <CheckCircle2 size={13} />
                        강점
                      </span>
                      {isLowestBid && (
                        <div className="flex items-start gap-1.5 text-[13px] font-medium text-brand-dark">
                          <Wallet size={13} className="mt-0.5 shrink-0 text-brand-green" />
                          <span>최저 입찰가로 가격점수 만점</span>
                        </div>
                      )}
                      {pc?.strengths.map(({ item }) => (
                        <div key={item.itemNo} className="flex items-start gap-1.5 text-[13px] font-medium text-brand-dark">
                          <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-brand-green" />
                          <span>{item.itemName}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col gap-1.5 rounded-lg bg-[#FBEEEC] p-3">
                      <span className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wide text-brand-red">
                        <XCircle size={13} />
                        보완 필요
                      </span>
                      {pc?.weaknesses.map(({ item }) => (
                        <div key={item.itemNo} className="flex items-start gap-1.5 text-[13px] font-medium text-brand-dark">
                          <XCircle size={13} className="mt-0.5 shrink-0 text-brand-red" />
                          <span>{item.itemName}</span>
                        </div>
                      ))}
                    </div>

                    {pc && pc.flagged.length > 0 && (
                      <div className="flex flex-col gap-1.5 rounded-lg bg-[#FFF3DD] p-3">
                        <span className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wide text-brand-amber">
                          <AlertTriangle size={13} />
                          사람 검증 필요 {pc.flagged.length > 4 && `(${pc.flagged.length}건)`}
                        </span>
                        {pc.flagged.slice(0, 4).map((item) => (
                          <div key={item.itemNo} className="flex items-start gap-1.5 text-[13px] font-medium text-brand-dark">
                            <AlertTriangle size={13} className="mt-0.5 shrink-0 text-brand-amber" />
                            <span>{item.itemName}</span>
                          </div>
                        ))}
                        {pc.flagged.length > 4 && (
                          <span className="pl-[19px] text-[12px] font-bold text-brand-muted">
                            +{pc.flagged.length - 4}건 더 (항목 상세 탭에서 확인)
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 비용 */}
      {section === "cost" && (
        <div className={cn(SECTION_CARD, "grid grid-cols-1 gap-6 lg:grid-cols-2")}>
          <div className="flex flex-col gap-2">
            <span className="text-[12px] font-bold text-brand-muted">입찰가격 (원, 낮을수록 유리)</span>
            <ResponsiveContainer width="100%" height={priceCostData.length * 56 + 24}>
              <BarChart data={priceCostData} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                <CartesianGrid horizontal={false} stroke="#eeece7" />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#ADA6A0" }} tickFormatter={(v: number) => `${Math.round(v / 10000).toLocaleString()}만`} axisLine={{ stroke: "#eeece7" }} tickLine={false} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12, fontWeight: 700, fill: "#52514E" }} axisLine={{ stroke: "#eeece7" }} tickLine={false} />
                <Tooltip formatter={(value) => [`${Number(value).toLocaleString()}원`, "입찰가"]} contentStyle={{ borderRadius: 10, border: "1px solid #E8E2DD", fontSize: 12 }} />
                <Bar dataKey="price" radius={[0, 4, 4, 0]} barSize={18}>
                  {priceCostData.map((d) => (
                    <Cell key={d.id} fill={companyColor(d.id)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-[12px] font-bold text-brand-muted">
              가격환산점수 (/{criteria.priceTotalPoints}점, 최저입찰가 기준 자동계산)
            </span>
            <ResponsiveContainer width="100%" height={priceScoreData.length * 56 + 24}>
              <BarChart data={priceScoreData} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                <CartesianGrid horizontal={false} stroke="#eeece7" />
                <XAxis type="number" domain={[0, criteria.priceTotalPoints]} tick={{ fontSize: 11, fill: "#ADA6A0" }} axisLine={{ stroke: "#eeece7" }} tickLine={false} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12, fontWeight: 700, fill: "#52514E" }} axisLine={{ stroke: "#eeece7" }} tickLine={false} />
                <Tooltip formatter={(value) => [`${value}점`, "가격점수"]} contentStyle={{ borderRadius: 10, border: "1px solid #E8E2DD", fontSize: 12 }} />
                <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={18}>
                  {priceScoreData.map((d) => (
                    <Cell key={d.id} fill={companyColor(d.id)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 업무 관점 카테고리 */}
      {activeCategory && (
        <div className={SECTION_CARD}>
          <CategoryChart items={activeCategory.items} />
        </div>
      )}

      {/* 항목별 상세 근거 */}
      {section === "detail" &&
        categories.map((cat) => (
          <div key={`detail-${cat.key}`} className={SECTION_CARD}>
            <div className="border-b border-brand-border pb-2.5 text-[13px] font-black text-brand-dark">{cat.label}</div>
            {cat.items.map((item) => {
              const scoresByCompany = ranked.map(({ draft }) => ({
                draft,
                entry: draft.item_scores[item.itemNo] as { score: number; rationale: string } | undefined,
              }));
              const maxScore = Math.max(0, ...scoresByCompany.map((s) => (s.entry ? Number(s.entry.score) || 0 : -1)));
              const isExpanded = Boolean(expandedItems[item.itemNo]);
              return (
                <div key={item.itemNo} className="flex flex-col border-b border-brand-border/60 py-3 last:border-b-0">
                  <button type="button" onClick={() => toggleItem(item.itemNo)} className="flex w-full items-start justify-between gap-4 text-left">
                    <div className="flex flex-1 flex-col gap-1">
                      <div className="text-sm text-brand-dark">
                        {item.itemNo}. {item.itemName}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-brand-muted">
                        <FileText size={11} />
                        확인서류: {item.docReference || "-"}
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp size={16} className="mt-0.5 shrink-0 text-brand-muted" /> : <ChevronDown size={16} className="mt-0.5 shrink-0 text-brand-muted" />}
                  </button>

                  <div className="mt-2 flex flex-col gap-2">
                    {scoresByCompany.map(({ draft, entry }) => {
                      const score = entry ? Number(entry.score) || 0 : 0;
                      const isTop = entry && score === maxScore && maxScore > 0;
                      return (
                        <div key={draft.id} className="flex items-center gap-3">
                          <span className="w-[120px] shrink-0 truncate text-[12.5px] font-bold text-brand-dark">{draft.companyName}</span>
                          <ProgressBar value={score} max={item.maxPoints ?? 1} colorHex={companyColor(draft.company_id)} className="flex-1" />
                          <span className={cn("flex w-[60px] shrink-0 items-center justify-end gap-1 text-[12.5px] font-bold", isTop ? "text-brand" : "text-brand-dark")}>
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
                            <span
                              className="inline-flex w-fit items-center rounded-full px-3.5 py-1 text-[13px] font-bold text-white"
                              style={{ backgroundColor: companyColor(draft.company_id) }}
                            >
                              {draft.companyName}
                            </span>
                          </div>
                          {entry ? <RationaleBlocks text={entry.rationale} /> : <p className="text-xs text-brand-muted">이 항목에 대한 AI 채점 근거가 없습니다.</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
    </div>
  );
}
