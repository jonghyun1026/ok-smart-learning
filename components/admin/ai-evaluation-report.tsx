"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  ChevronDown,
  ChevronUp,
  Clock3,
  FileText,
  Gauge,
  Sparkles,
  Trophy,
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

function itemShortName(name: string, len = 14): string {
  return name.length > len ? `${name.slice(0, len - 1)}…` : name;
}

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString();
}

const SECTIONS = [
  { id: "summary", no: "01", label: "핵심 요약" },
  { id: "radar", no: "02", label: "균형 비교" },
  { id: "facts", no: "03", label: "사실 비교·진단" },
  { id: "scores", no: "04", label: "영역별 점수" },
  { id: "detail", no: "05", label: "항목별 근거" },
] as const;

/** 번호가 달린 섹션 헤더 — 레포트 격의 위계를 만든다. */
function SectionHead({
  no,
  kicker,
  title,
  desc,
}: {
  no: string;
  kicker: string;
  title: string;
  desc?: string;
}) {
  return (
    <div className="flex items-start gap-4 border-b-2 border-brand-dark/90 pb-4">
      <span className="mt-0.5 select-none text-[34px] font-black leading-none tracking-tight text-brand">
        {no}
      </span>
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-black uppercase tracking-[0.22em] text-brand-muted">{kicker}</span>
        <h2 className="text-[22px] font-black leading-tight text-brand-dark">{title}</h2>
        {desc && <p className="max-w-3xl text-[13px] leading-relaxed text-brand-muted">{desc}</p>}
      </div>
    </div>
  );
}

/**
 * "AI 평가 레포트" — 세그먼트 탭을 없애고 요약→비교→점수→근거를 하나의 스크롤 내러티브로 엮은
 * 의사결정 브리프. 관리자 상단 탭에서 단독으로 열린다. 모든 값은 AI 초안이며(사람 확정 대상),
 * comparison_facts(사실)와 item_scores(점수)를 함께 소스로 쓴다. 스티키 목차(scroll-spy)로 긴
 * 레포트 안에서 위치를 잃지 않게 한다.
 */
export function AiEvaluationReport() {
  const [criteria, setCriteria] = useState<CriteriaData | null>(null);
  const [allCompanies, setAllCompanies] = useState<CompanyLite[]>([]);
  const [drafts, setDrafts] = useState<DraftWithCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [activeSection, setActiveSection] = useState<string>("summary");
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

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

  // 색상은 업체(entity)에 고정 — company_id 오름차순으로 배정해 어느 목록에서든 같은 색.
  const companyColorMap = useMemo(() => {
    const m = new Map<string, string>();
    [...drafts]
      .sort((a, b) => a.company_id.localeCompare(b.company_id))
      .forEach((d, idx) => m.set(d.company_id, getCompanyColor(idx)));
    return m;
  }, [drafts]);
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

  const diagnosisCompanies: DiagnosisCompany[] = useMemo(
    () =>
      ranked.map(({ draft }) => ({
        id: draft.company_id,
        name: draft.companyName,
        bidPrice: draft.bidPrice,
        color: companyColor(draft.company_id),
        facts: draft.comparison_facts,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ranked, companyColorMap]
  );

  // 총 학습시간(사실 데이터)을 요약 표에서 함께 보여주기 위한 조회 헬퍼
  const totalHoursOf = (id: string): number | null => {
    const facts = drafts.find((d) => d.company_id === id)?.comparison_facts;
    const m = facts?.content.metrics.find((x) => x.key === "hours");
    return m ? m.value : null;
  };

  // 스크롤 스파이: 현재 화면에 걸친 섹션을 목차에서 강조
  useEffect(() => {
    if (loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) setActiveSection(visible[0].target.id);
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 }
    );
    for (const s of SECTIONS) {
      const el = sectionRefs.current[s.id];
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [loading, drafts.length]);

  function scrollTo(id: string) {
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function toggleItem(itemNo: string) {
    setExpandedItems((prev) => ({ ...prev, [itemNo]: !prev[itemNo] }));
  }

  if (loading || !criteria) {
    return <p className="text-sm text-brand-muted">AI 평가 레포트를 불러오는 중...</p>;
  }

  if (drafts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-brand-border bg-brand-bg p-12 text-center">
        <Sparkles size={24} className="text-brand-muted" />
        <p className="text-sm font-bold text-brand-dark">완료된 AI 평가 초안이 없습니다.</p>
        <p className="max-w-md text-xs leading-relaxed text-brand-muted">
          Claude Code 세션에서 &quot;OO업체 평가해줘&quot;라고 요청하면 evaluation-agent가 제안서를 채점하고
          이 레포트를 자동으로 채웁니다.
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
          <XAxis type="number" domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 11, fill: "#8A7F86" }} axisLine={{ stroke: "#eeece7" }} tickLine={false} />
          <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12, fontWeight: 700, fill: "#2A232A" }} axisLine={{ stroke: "#eeece7" }} tickLine={false} />
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

  const setRef = (id: string) => (el: HTMLElement | null) => {
    sectionRefs.current[id] = el;
  };

  return (
    <div className="flex flex-col gap-8">
      {/* ── 레포트 헤더 ── */}
      <header className="relative overflow-hidden rounded-3xl bg-brand-dark px-8 py-9 text-white shadow-sm">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 88% 8%, #F04E23 0, transparent 42%), radial-gradient(circle at 12% 96%, #FF7A47 0, transparent 40%)",
          }}
        />
        <div className="relative flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em]">
              <Sparkles size={12} /> AI 초안
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55">
              Evaluation Report
            </span>
          </div>
          <h1 className="text-[30px] font-black leading-tight md:text-[36px]">AI 평가 레포트</h1>
          <p className="max-w-2xl text-[13.5px] leading-relaxed text-white/70">
            제안서에서 추출한 <b className="text-white">사실</b>과 채점 <b className="text-white">점수</b>를 한 흐름으로
            엮은 업체 비교 브리프입니다. 점수·순위는 모두 AI 초안(추정치)이며, 확정은 평가입력 화면에서 사람이 합니다.
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] font-semibold text-white/75">
            <span className="flex items-center gap-1.5">
              <Trophy size={13} className="text-brand-amberLight" /> 비교 업체 {drafts.length}개사
            </span>
            <span className="flex items-center gap-1.5">
              <Gauge size={13} className="text-brand-amberLight" /> 협상적격(예상) 기준 총점{" "}
              {criteria.settings.negotiationThreshold}점 이상 AND 필수자격 Pass
            </span>
            <span className="flex items-center gap-1.5">
              <Clock3 size={13} className="text-brand-amberLight" /> 기준일{" "}
              {new Date().toLocaleDateString("ko-KR")}
            </span>
          </div>
        </div>
      </header>

      {/* ── 스티키 목차 ── */}
      <nav className="sticky top-0 z-20 -mx-1 flex flex-wrap gap-1.5 rounded-2xl border border-brand-border bg-brand-alt/85 px-2 py-2 backdrop-blur">
        {SECTIONS.map((s) => {
          const active = activeSection === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => scrollTo(s.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition-all",
                active ? "bg-brand-dark text-white shadow-sm" : "text-brand-muted hover:text-brand-dark"
              )}
            >
              <span className={cn("text-[11px] font-black", active ? "text-brand-amberLight" : "text-brand")}>
                {s.no}
              </span>
              {s.label}
            </button>
          );
        })}
      </nav>

      {drafts.length === 1 && (
        <div className="flex items-start gap-2 rounded-xl border border-brand-amber/40 bg-[#FFF8EC] p-3.5">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-brand-amber" />
          <p className="text-[12px] leading-relaxed text-brand-dark">
            현재 <b>{drafts[0].companyName}</b> 1개 업체만 AI 채점이 완료되어 있습니다. 다른 업체도 평가하면 나란히
            비교됩니다.
          </p>
        </div>
      )}

      {/* ── 01 핵심 요약 ── */}
      <section ref={setRef("summary")} id="summary" className="flex scroll-mt-20 flex-col gap-6">
        <SectionHead
          no="01"
          kicker="Executive Summary"
          title="핵심 요약 — 추정 순위 한눈에"
          desc="AI 초안 점수 기준 순위입니다. 큰 숫자는 추정 총점, 막대는 기술·가격 배점 대비 비율입니다."
        />
        <div className={cn("grid grid-cols-1 gap-4", ranked.length <= 2 ? "md:grid-cols-2" : "md:grid-cols-3")}>
          {ranked.map(({ draft, technicalTotal, priceScore, estimatedTotal, qualified }, idx) => (
            <div
              key={draft.id}
              className={cn(
                "relative flex flex-col gap-4 overflow-hidden rounded-2xl bg-white p-6 shadow-sm ring-1 ring-brand-border",
                idx === 0 && "shadow-md ring-2 ring-brand-amber/60"
              )}
            >
              <span
                className="absolute inset-x-0 top-0 h-1.5"
                style={{ backgroundColor: companyColor(draft.company_id) }}
              />
              <div className="flex items-center justify-between pt-1">
                <span className="flex items-center gap-1.5">
                  {idx === 0 && <Trophy size={16} className="text-brand-amber" />}
                  <span className="text-[11px] font-black uppercase tracking-wider text-brand-muted">
                    {idx + 1}위
                  </span>
                </span>
                {qualified ? (
                  <Badge tone="green">협상적격(예상)</Badge>
                ) : (
                  <Badge tone="neutral">기준 미달(예상)</Badge>
                )}
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-base font-black text-brand-dark">{draft.companyName}</span>
                <span className="text-[12px] text-brand-muted">{fmt(draft.bidPrice)}원</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[52px] font-black leading-none tracking-tight text-brand-dark tabular-nums">
                  {estimatedTotal}
                </span>
                <span className="text-sm font-bold text-brand-muted">/ {criteria.grandTotalPoints}</span>
              </div>
              <div className="flex flex-col gap-2 pt-1">
                <div className="flex items-center gap-2">
                  <span className="w-[46px] shrink-0 text-[11px] text-brand-muted">기술</span>
                  <ProgressBar value={technicalTotal} max={criteria.technicalTotalPoints} colorHex={companyColor(draft.company_id)} className="flex-1" />
                  <span className="w-[54px] shrink-0 text-right text-[11px] font-bold text-brand-dark tabular-nums">
                    {technicalTotal}/{criteria.technicalTotalPoints}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-[46px] shrink-0 text-[11px] text-brand-muted">가격</span>
                  <ProgressBar value={priceScore} max={criteria.priceTotalPoints} colorHex={companyColor(draft.company_id)} className="flex-1" />
                  <span className="w-[54px] shrink-0 text-right text-[11px] font-bold text-brand-dark tabular-nums">
                    {priceScore}/{criteria.priceTotalPoints}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 지표 한눈에 */}
        <div className="w-full overflow-x-auto rounded-2xl border border-brand-border bg-white shadow-sm">
          <table className="w-full min-w-[520px] border-collapse text-left">
            <thead>
              <tr className="border-b border-brand-border bg-brand-alt">
                <th className="w-[150px] px-5 py-3 text-[11px] font-black uppercase tracking-wider text-brand-muted">
                  지표
                </th>
                {ranked.map(({ draft }) => (
                  <th key={draft.id} className="px-4 py-3 text-[13px] font-black text-brand-dark">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: companyColor(draft.company_id) }} />
                      {draft.companyName}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              <tr className="border-b border-brand-border/60">
                <td className="px-5 py-3 text-[12.5px] font-bold text-brand-dark">추정 총점</td>
                {ranked.map(({ draft, estimatedTotal }) => (
                  <td key={draft.id} className="px-4 py-3 text-[15px] font-black text-brand-dark">
                    {estimatedTotal}
                    <span className="ml-0.5 text-[11px] font-medium text-brand-muted">/{criteria.grandTotalPoints}</span>
                  </td>
                ))}
              </tr>
              <tr className="border-b border-brand-border/60">
                <td className="px-5 py-3 text-[12.5px] font-bold text-brand-dark">제안가</td>
                {ranked.map(({ draft }) => {
                  const isLowest = draft.bidPrice > 0 && draft.bidPrice === lowestBidPrice;
                  return (
                    <td key={draft.id} className="px-4 py-3 text-[13px] text-brand-dark">
                      {fmt(draft.bidPrice)}원
                      {isLowest && <Badge tone="green" className="ml-2 px-2 py-0.5 text-[11px]">최저가</Badge>}
                    </td>
                  );
                })}
              </tr>
              <tr className="border-b border-brand-border/60">
                <td className="px-5 py-3 text-[12.5px] font-bold text-brand-dark">총 학습시간</td>
                {ranked.map(({ draft }) => {
                  const h = totalHoursOf(draft.company_id);
                  return (
                    <td key={draft.id} className="px-4 py-3 text-[13px] text-brand-dark">
                      {h === null ? "—" : `${fmt(h)}시간`}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td className="px-5 py-3 text-[12.5px] font-bold text-brand-dark">협상적격(예상)</td>
                {ranked.map(({ draft, qualified }) => (
                  <td key={draft.id} className="px-4 py-3">
                    {qualified ? <Badge tone="green">적격</Badge> : <Badge tone="neutral">미달</Badge>}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ── 02 균형 비교 (레이더) ── */}
      <section ref={setRef("radar")} id="radar" className="flex scroll-mt-20 flex-col gap-6">
        <SectionHead
          no="02"
          kicker="Balance"
          title="균형 비교 — 영역별 강약 프로파일"
          desc="영역별 점수(가격 포함)를 영역 만점 대비 백분율로 정규화해 겹쳐 봅니다. 넓게 퍼질수록 고르게 강합니다."
        />
        <CompanyRadarChart
          criteria={criteria}
          companies={radarRows}
          title="영역별 강약 프로파일"
          description="영역별 점수(가격 포함)를 영역 만점 대비 백분율로 정규화해 겹쳐 표시합니다."
          colorFor={companyColor}
        />
      </section>

      {/* ── 03 사실 비교·진단 ── */}
      <section ref={setRef("facts")} id="facts" className="flex scroll-mt-20 flex-col gap-6">
        <SectionHead
          no="03"
          kicker="What They Proposed"
          title="사실 비교 · 종합 진단"
          desc="점수가 아니라 '무엇을 제안했는가' — 콘텐츠 규모·비용/무상제공·부가서비스·운영 장단점과 업체별 종합 진단입니다. (담당자 확인) 태그는 제안서 밖 확인 사항입니다."
        />
        <ComparisonDiagnosis companies={diagnosisCompanies} showBanner={false} />
      </section>

      {/* ── 04 영역별 점수 ── */}
      <section ref={setRef("scores")} id="scores" className="flex scroll-mt-20 flex-col gap-6">
        <SectionHead
          no="04"
          kicker="Scores"
          title="영역별 점수 분석"
          desc="세부항목 점수를 각 항목 만점 대비 비율(%)로 나란히 봅니다. 비용은 제안가와 가격환산점수를 함께 표시합니다."
        />

        {/* 비용 */}
        <div className="grid grid-cols-1 gap-6 rounded-2xl border border-brand-border bg-white p-6 shadow-sm lg:grid-cols-2">
          <div className="flex flex-col gap-2">
            <span className="text-[12px] font-bold text-brand-muted">입찰가격 (원, 낮을수록 유리)</span>
            <ResponsiveContainer width="100%" height={priceCostData.length * 56 + 24}>
              <BarChart data={priceCostData} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                <CartesianGrid horizontal={false} stroke="#eeece7" />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#8A7F86" }} tickFormatter={(v: number) => `${Math.round(v / 10000).toLocaleString()}만`} axisLine={{ stroke: "#eeece7" }} tickLine={false} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12, fontWeight: 700, fill: "#2A232A" }} axisLine={{ stroke: "#eeece7" }} tickLine={false} />
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
                <XAxis type="number" domain={[0, criteria.priceTotalPoints]} tick={{ fontSize: 11, fill: "#8A7F86" }} axisLine={{ stroke: "#eeece7" }} tickLine={false} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12, fontWeight: 700, fill: "#2A232A" }} axisLine={{ stroke: "#eeece7" }} tickLine={false} />
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

        {/* 카테고리별 항목 점수 */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {categories.map((cat) => (
            <div key={cat.key} className="flex flex-col gap-3 rounded-2xl border border-brand-border bg-white p-6 shadow-sm">
              <span className="text-[13px] font-black text-brand-dark">{cat.label}</span>
              <CategoryChart items={cat.items} />
            </div>
          ))}
        </div>
      </section>

      {/* ── 05 항목별 근거 ── */}
      <section ref={setRef("detail")} id="detail" className="flex scroll-mt-20 flex-col gap-6">
        <SectionHead
          no="05"
          kicker="Rationale"
          title="항목별 상세 근거"
          desc="각 세부항목을 펼치면 업체별 AI 채점 근거(인용→확인서류 대조→등급 판단→감점→검증 플래그)를 볼 수 있습니다."
        />
        <div className="flex flex-col gap-5">
          {categories.map((cat) => (
            <div key={`detail-${cat.key}`} className="rounded-2xl border border-brand-border bg-white p-6 shadow-sm">
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
                            <span className={cn("flex w-[60px] shrink-0 items-center justify-end gap-1 text-[12.5px] font-bold tabular-nums", isTop ? "text-brand" : "text-brand-dark")}>
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
      </section>
    </div>
  );
}
