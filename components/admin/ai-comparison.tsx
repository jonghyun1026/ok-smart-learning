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
  GitCompare,
  ShieldCheck,
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
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { RationaleBlocks } from "@/components/ui/rationale-blocks";
import { CompanyRadarChart, type RadarCompanyRow } from "@/components/admin/company-radar-chart";

type CompanyLite = { id: string; name: string; bid_price: number; qualification_pass: boolean | null };

type DraftWithCompany = AiEvaluationDraft & {
  companyName: string;
  bidPrice: number;
  qualificationPass: boolean | null;
};

/**
 * evaluation-agent는 5단계 근거 구조상 "[사람 검증 필요]" 라벨을 거의 모든 항목에 형식적으로
 * 붙이고, 우려사항이 없을 땐 본문에 "특이사항 없음"류 문구만 적는다(scoring-guide.md 근거
 * 작성 원칙). 라벨 존재만으로 플래그하면 사실상 전 항목이 걸려 신호가 죽으므로, 라벨 뒤
 * 본문이 "없음"으로 시작하지 않는 경우만 실제 우려사항으로 취급한다.
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

/**
 * AI 채점 초안(status="completed")을 콘텐츠/운영·관리/부가서비스/비용/시스템/기업역량 등
 * 업무 관점 카테고리로 묶어 시각적으로 비교하고, 업체별 장단점을 자동 요약해 의사결정을 돕는다.
 * 그룹핑은 criteria 테이블의 영역명/항목명 텍스트 매칭으로 동적으로 만들어진다 — 관리자가
 * 항목을 추가/수정해도 하드코딩된 item_no에 의존하지 않고 그대로 반영된다.
 * 열람 전용 — 여기서 아무것도 확정하지 않는다.
 */
export function AiComparison() {
  const [criteria, setCriteria] = useState<CriteriaData | null>(null);
  const [allCompanies, setAllCompanies] = useState<CompanyLite[]>([]);
  const [drafts, setDrafts] = useState<DraftWithCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

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

  // 업무 관점 카테고리: DB 영역명/항목명 텍스트로 동적 매칭 (item_no 하드코딩 금지 — criteria는
  // 관리자가 언제든 바꿀 수 있으므로 이름이 바뀌면 그 카테고리는 자연히 비어 렌더링에서 빠진다).
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
    if (content.length) list.push({ key: "content", label: "콘텐츠 비교", items: content });
    if (ops.length) list.push({ key: "ops", label: "운영 및 관리 비교", items: ops });
    if (addon.length) list.push({ key: "addon", label: "부가서비스 비교", items: addon });
    if (system.length) list.push({ key: "system", label: "시스템/보안 비교", items: system });
    if (general.length) list.push({ key: "general", label: "기업역량 비교(재무·실적·인력)", items: general });
    return list;
  }, [criteria]);

  // 예상 총점 = AI 기술점수 합계 + 입찰가 기반 가격환산점수(자동계산). 협상적격 판정 미리보기용.
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

  // 레이더 차트용 영역별 점수(AI 초안 기준, 가격 영역도 포함해 회사별 균형을 한눈에 보여준다).
  // 배열 순서는 총점순(ranked)을 유지한다 — CompanyRadarChart가 업체 6개 초과 시 "상위 N개
  // 기본 표시"를 배열 순서로 판단하기 때문. 색상은 대신 colorFor prop으로 별도 주입해 이
  // 페이지의 companyColor()(company_id 고정 순서)와 항상 일치시킨다.
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

  // 업체별 장단점 자동 요약: 배점 대비 %가 가장 높은/낮은 항목을 강점/보완점으로,
  // "사람 검증 필요" 플래그가 있는 항목은 별도로 표시한다.
  const prosCons = useMemo(() => {
    if (!criteria) return new Map<string, { strengths: { item: CriteriaItem; pct: number }[]; weaknesses: { item: CriteriaItem; pct: number }[]; flagged: CriteriaItem[] }>();
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 rounded-xl border border-brand-border bg-white p-5">
        <span className="flex items-center gap-1.5 text-[15px] font-black text-brand-dark">
          <GitCompare size={16} className="text-brand" />
          AI 채점 초안 비교 ({drafts.length}개사)
        </span>
        <p className="text-xs text-brand-muted">
          evaluation-agent가 생성한 AI 초안을 업무 관점(콘텐츠/비용/부가서비스/운영·관리 등)으로 묶어
          비교합니다. 실제 확정 점수는 평가자가 [평가입력] 화면에서 검토·수정 후 저장한 값이며 이
          화면과 다를 수 있습니다.
        </p>
      </div>

      {/* 예상 총점 순위 (기술 + 가격) */}
      <div className="flex flex-col gap-3 rounded-xl border border-brand-border bg-white p-5">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-bold text-brand-dark">
            예상 총점 순위 (AI 기술점수 + 입찰가 기반 가격환산점수)
          </span>
          <span className="flex items-center gap-1 text-[11px] text-brand-muted">
            <ShieldCheck size={12} />
            협상적격 기준 {criteria.settings.negotiationThreshold}점 이상 · 필수자격 Pass
          </span>
        </div>
        {ranked.map(({ draft, technicalTotal, priceScore, estimatedTotal, qualified }, idx) => (
          <div key={draft.id} className="flex flex-col gap-1.5 rounded-lg border border-brand-border/60 p-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-bg text-[11px] font-bold text-brand-dark">
                {idx === 0 ? <Trophy size={13} className="text-brand-amber" /> : idx + 1}
              </span>
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: companyColor(draft.company_id) }}
              />
              <span className="text-sm font-bold text-brand-dark">{draft.companyName}</span>
              <span className="text-[11px] text-brand-muted">{draft.bidPrice.toLocaleString()}원</span>
              {qualified ? (
                <Badge tone="brand">협상적격(예상)</Badge>
              ) : (
                <Badge tone="neutral">기준 미달(예상)</Badge>
              )}
              <span className="ml-auto text-base font-black text-brand-dark">
                {estimatedTotal} / {criteria.grandTotalPoints}
              </span>
            </div>
            <div className="flex items-center gap-2 pl-9">
              <span className="w-[90px] shrink-0 text-[11px] text-brand-muted">
                기술 {technicalTotal}/{criteria.technicalTotalPoints}
              </span>
              <ProgressBar
                value={technicalTotal}
                max={criteria.technicalTotalPoints}
                colorHex={companyColor(draft.company_id)}
                className="flex-1"
              />
            </div>
            <div className="flex items-center gap-2 pl-9">
              <span className="w-[90px] shrink-0 text-[11px] text-brand-muted">
                가격 {priceScore}/{criteria.priceTotalPoints}
              </span>
              <ProgressBar
                value={priceScore}
                max={criteria.priceTotalPoints}
                colorHex={companyColor(draft.company_id)}
                className="flex-1"
              />
            </div>
          </div>
        ))}
      </div>

      {/* 레이더 차트 (전체 영역 균형 조망) */}
      <CompanyRadarChart
        criteria={criteria}
        companies={radarRows}
        title="업체 간 균형 비교 (레이더 차트)"
        description="AI 초안의 영역별 점수(가격 포함)를 영역 만점 대비 백분율로 정규화해 겹쳐 표시합니다."
        colorFor={companyColor}
      />

      {/* 업체별 장단점 요약 */}
      <div className="flex flex-col gap-3 rounded-xl border border-brand-border bg-white p-5">
        <span className="text-[13px] font-bold text-brand-dark">업체별 강점 · 보완 필요 항목 (자동 요약)</span>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {ranked.map(({ draft }) => {
            const pc = prosCons.get(draft.company_id);
            const isLowestBid = draft.bidPrice > 0 && draft.bidPrice === lowestBidPrice;
            return (
              <div
                key={draft.id}
                className="flex flex-col gap-3 rounded-xl p-4"
                style={{ borderLeft: `4px solid ${companyColor(draft.company_id)}`, backgroundColor: "#FAF8F6" }}
              >
                <span className="text-sm font-black text-brand-dark">{draft.companyName}</span>

                <div className="flex flex-col gap-1.5">
                  <span className="flex items-center gap-1 text-[12px] font-bold text-brand-green">
                    <CheckCircle2 size={13} />
                    강점
                  </span>
                  {isLowestBid && (
                    <div className="flex items-start gap-1.5 text-[12.5px] text-brand-dark">
                      <Wallet size={13} className="mt-0.5 shrink-0 text-brand-green" />
                      <span>최저 입찰가({draft.bidPrice.toLocaleString()}원)로 가격점수 만점 확보</span>
                    </div>
                  )}
                  {pc?.strengths.map(({ item, pct }) => (
                    <div key={item.itemNo} className="flex items-start gap-1.5 text-[12.5px] text-brand-dark">
                      <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-brand-green" />
                      <span>
                        {item.itemName} <span className="text-brand-muted">({pct}%)</span>
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="flex items-center gap-1 text-[12px] font-bold text-brand-red">
                    <XCircle size={13} />
                    보완 필요
                  </span>
                  {pc?.weaknesses.map(({ item, pct }) => (
                    <div key={item.itemNo} className="flex items-start gap-1.5 text-[12.5px] text-brand-dark">
                      <XCircle size={13} className="mt-0.5 shrink-0 text-brand-red" />
                      <span>
                        {item.itemName} <span className="text-brand-muted">({pct}%)</span>
                      </span>
                    </div>
                  ))}
                </div>

                {pc && pc.flagged.length > 0 && (
                  <div className="flex flex-col gap-1.5 rounded-lg border border-brand-amber/40 bg-[#FFF3DD] p-2.5">
                    <span className="flex items-center gap-1 text-[12px] font-bold text-brand-amber">
                      <AlertTriangle size={13} />
                      사람 검증 필요 항목
                    </span>
                    {pc.flagged.map((item) => (
                      <span key={item.itemNo} className="text-[12px] text-brand-dark">
                        · {item.itemName}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 비용 비교 */}
      <div className="flex flex-col gap-4 rounded-xl border border-brand-border bg-white p-5">
        <span className="flex items-center gap-1.5 text-[15px] font-black text-brand-dark">
          <Wallet size={16} className="text-brand" />
          비용 비교
        </span>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-2">
            <span className="text-[12px] font-bold text-brand-muted">입찰가격 (원, 낮을수록 유리)</span>
            <ResponsiveContainer width="100%" height={priceCostData.length * 56 + 24}>
              <BarChart data={priceCostData} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                <CartesianGrid horizontal={false} stroke="#e1e0d9" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: "#898781" }}
                  tickFormatter={(v: number) => `${Math.round(v / 10000).toLocaleString()}만`}
                />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12, fontWeight: 700, fill: "#52514E" }} />
                <Tooltip formatter={(value) => [`${Number(value).toLocaleString()}원`, "입찰가"]} />
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
                <CartesianGrid horizontal={false} stroke="#e1e0d9" />
                <XAxis
                  type="number"
                  domain={[0, criteria.priceTotalPoints]}
                  tick={{ fontSize: 11, fill: "#898781" }}
                />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12, fontWeight: 700, fill: "#52514E" }} />
                <Tooltip formatter={(value) => [`${value}점`, "가격점수"]} />
                <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={18}>
                  {priceScoreData.map((d) => (
                    <Cell key={d.id} fill={companyColor(d.id)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 업무 관점 카테고리별 비교 차트 */}
      {categories.map((cat) => {
        const chartData = cat.items.map((item) => {
          const row: Record<string, string | number> = {
            name: itemShortName(item.itemName),
            fullName: item.itemName,
            max: item.maxPoints ?? 0,
          };
          for (const { draft } of ranked) {
            const entry = draft.item_scores[item.itemNo];
            const score = entry ? Number(entry.score) || 0 : 0;
            const pct = item.maxPoints ? Math.round((score / item.maxPoints) * 1000) / 10 : 0;
            row[draft.company_id] = pct;
            row[`${draft.company_id}__raw`] = score;
          }
          return row;
        });
        const chartHeight = cat.items.length * (26 * ranked.length + 24) + 40;
        return (
          <div key={cat.key} className="flex flex-col gap-3 rounded-xl border border-brand-border bg-white p-5">
            <span className="text-[15px] font-black text-brand-dark">{cat.label}</span>
            <ResponsiveContainer width="100%" height={Math.max(chartHeight, 160)}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                <CartesianGrid horizontal={false} stroke="#e1e0d9" />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 11, fill: "#898781" }} />
                <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12, fontWeight: 700, fill: "#52514E" }} />
                <Tooltip
                  formatter={(value, name, item) => {
                    const dataKey = String(item?.dataKey ?? "");
                    const payload = item?.payload as Record<string, number> | undefined;
                    const raw = payload ? payload[`${dataKey}__raw`] : undefined;
                    const max = payload ? payload.max : undefined;
                    return [`${value}% (${raw ?? "-"}/${max ?? "-"}점)`, name];
                  }}
                  labelFormatter={(_, payload) => (payload?.[0]?.payload as { fullName?: string })?.fullName ?? ""}
                />
                <Legend wrapperStyle={{ fontSize: 12, fontWeight: 700 }} />
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
          </div>
        );
      })}

      {/* 항목별 상세 근거 (표 형태 세부 열람) */}
      <div className="flex flex-col gap-1 rounded-xl border border-brand-border bg-white p-5">
        <span className="text-[15px] font-black text-brand-dark">항목별 상세 근거</span>
        <p className="text-xs text-brand-muted">항목을 펼치면 업체별 AI 채점 근거를 나란히 볼 수 있습니다.</p>
      </div>
      {categories.map((cat) => (
        <div key={`detail-${cat.key}`} className="flex flex-col gap-1 rounded-xl border border-brand-border bg-white p-5">
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
                        <ProgressBar value={score} max={item.maxPoints ?? 1} colorHex={companyColor(draft.company_id)} className="flex-1" />
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
      ))}
    </div>
  );
}
