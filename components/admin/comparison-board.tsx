"use client";

import { useMemo } from "react";
import { CheckCircle2, MinusCircle, XCircle, HelpCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  CONTENT_FREE_META,
  FACT_STATUS_META,
  type ContentMetric,
  type FactStatus,
} from "@/lib/comparison";
import type { DiagnosisCompany } from "@/components/admin/comparison-diagnosis";

/**
 * 종합결과 "제안서 비교 (한눈 요약)" — 예시 장표(업체 제안서 비교)를 참조한 압축 표.
 * ComparisonDiagnosis(카드형 심층 비교, AI 레포트 탭)와 달리, 업체를 열로 두고 콘텐츠 규모·
 * 비용·제안가·부가서비스·종합 장단점을 한 표에 세로로 대조하는 슬라이드형 요약이다.
 * 소스는 동일한 comparison_facts(AI 초안)이며 사람 검증 대상이다(CLAUDE.md).
 */

/** 업체들의 metrics를 key 기준으로 통합해 표시 순서·라벨·단위를 확정한다. */
function unionMetrics(companies: DiagnosisCompany[]): ContentMetric[] {
  const order: string[] = [];
  const meta = new Map<string, ContentMetric>();
  for (const c of companies) {
    for (const m of c.facts?.content.metrics ?? []) {
      if (!meta.has(m.key)) {
        meta.set(m.key, m);
        order.push(m.key);
      }
    }
  }
  return order.map((k) => meta.get(k)!);
}

function metricValue(c: DiagnosisCompany, key: string): number | null {
  const m = c.facts?.content.metrics.find((x) => x.key === key);
  return m ? m.value : null;
}

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString();
}

function StatusCell({ status, note }: { status: FactStatus; note?: string }) {
  const meta = FACT_STATUS_META[status];
  const Icon =
    status === "provided"
      ? CheckCircle2
      : status === "partial"
        ? MinusCircle
        : status === "absent"
          ? XCircle
          : HelpCircle;
  const color =
    status === "provided"
      ? "text-brand-green"
      : status === "partial"
        ? "text-brand-amber"
        : status === "absent"
          ? "text-brand-red"
          : "text-brand-muted";
  return (
    <div className="flex flex-col gap-1">
      <span className={cn("flex items-center gap-1.5 text-[12.5px] font-bold", color)}>
        <Icon size={14} className="shrink-0" />
        {meta.label}
      </span>
      {note && <p className="text-[11px] leading-relaxed text-brand-muted">{note}</p>}
    </div>
  );
}

/** 세로 라벨(구분) + 업체 열. 정량 지표는 우위 업체 셀을 강조한다. */
export function ComparisonBoard({ companies }: { companies: DiagnosisCompany[] }) {
  const withFacts = useMemo(() => companies.filter((c) => c.facts), [companies]);
  const metrics = useMemo(() => unionMetrics(withFacts), [withFacts]);

  const addonNames = useMemo(() => {
    const order: string[] = [];
    const seen = new Set<string>();
    for (const c of withFacts) {
      for (const a of c.facts!.addons) {
        if (!seen.has(a.name)) {
          seen.add(a.name);
          order.push(a.name);
        }
      }
    }
    return order;
  }, [withFacts]);

  if (withFacts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-brand-border bg-brand-bg p-8 text-center">
        <Sparkles size={20} className="text-brand-muted" />
        <p className="text-sm font-bold text-brand-dark">아직 제안서 비교 사실이 없습니다.</p>
        <p className="max-w-md text-xs leading-relaxed text-brand-muted">
          Claude Code 세션에서 &quot;OO업체 평가해줘&quot;라고 요청하면 evaluation-agent가 제안서에서
          콘텐츠 규모·비용·부가서비스·장단점을 추출해 이 표를 채웁니다.
        </p>
      </div>
    );
  }

  const lowestBid = Math.min(...withFacts.map((c) => c.bidPrice).filter((p) => p > 0));

  // 그룹 밴드(구분 전체폭) 행 — 소프트 오렌지 밴드로 섹션을 구분(웜 톤)
  const GroupBand = ({ label }: { label: string }) => (
    <tr>
      <td
        colSpan={withFacts.length + 1}
        className="border-y border-brand-border bg-brand-highlight px-4 py-2 text-[12px] font-black uppercase tracking-wide text-brand"
      >
        {label}
      </td>
    </tr>
  );

  const rowBorder = "border-b border-brand-border/70";
  const labelCell =
    "w-[150px] min-w-[150px] bg-brand-alt px-4 py-3 align-top text-[12.5px] font-bold text-brand-brown";
  const dataCell = "px-4 py-3 align-top text-[12.5px] text-brand-dark";

  return (
    <div className="w-full overflow-x-auto rounded-card border border-brand-border bg-white shadow-card">
      <table className="w-full min-w-[720px] border-collapse text-left">
        <thead>
          <tr className="border-b border-brand-border">
            <th className="w-[150px] min-w-[150px] bg-brand-alt px-4 py-3 text-[11px] font-black uppercase tracking-wide text-brand-muted">
              구분
            </th>
            {withFacts.map((c) => (
              <th key={c.id} className="bg-brand-alt px-4 py-3 text-[14px] font-black text-brand-brown">
                <span className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white"
                    style={{ backgroundColor: c.color }}
                  />
                  {c.name}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* ── 콘텐츠 규모 ── */}
          <GroupBand label="콘텐츠 규모" />
          {metrics.map((metric) => {
            const values = withFacts.map((c) => metricValue(c, metric.key));
            const max = Math.max(...values.map((v) => v ?? -1));
            const isHours = metric.key === "hours";
            return (
              <tr key={metric.key} className={rowBorder}>
                <td className={labelCell}>
                  {metric.label}
                  {isHours && (
                    <span className="mt-0.5 block text-[10px] font-medium text-brand">
                      실질 학습량 지표
                    </span>
                  )}
                </td>
                {withFacts.map((c) => {
                  const v = metricValue(c, metric.key);
                  const isLead = v !== null && v === max && max > 0 && withFacts.length > 1;
                  return (
                    <td
                      key={c.id}
                      className={cn(dataCell, isLead && "bg-brand-highlight/60")}
                    >
                      <span
                        className={cn(
                          "text-[15px] tabular-nums",
                          isLead ? "font-black text-brand-dark" : "font-bold text-brand-dark"
                        )}
                      >
                        {fmt(v)}
                        {v !== null && (
                          <span className="ml-0.5 text-[11px] font-medium text-brand-muted">
                            {metric.unit}
                          </span>
                        )}
                      </span>
                      {isLead && (
                        <span className="ml-1.5 align-middle text-[10px] font-black text-brand">
                          최다
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          <tr className={rowBorder}>
            <td className={labelCell}>콘텐츠 성격</td>
            {withFacts.map((c) => (
              <td key={c.id} className={dataCell}>
                <p className="leading-relaxed">{c.facts!.content.typeNote}</p>
                {c.facts!.content.verified && (
                  <span className="mt-1 flex items-center gap-1 text-[11px] font-bold text-brand-green">
                    <CheckCircle2 size={12} /> 원본 파일 대조 검증됨
                  </span>
                )}
              </td>
            ))}
          </tr>

          {/* ── 비용 ── */}
          <GroupBand label="비용" />
          <tr className={rowBorder}>
            <td className={labelCell}>제안가 (VAT 포함)</td>
            {withFacts.map((c) => {
              const isLowest = c.bidPrice > 0 && c.bidPrice === lowestBid && withFacts.length > 1;
              return (
                <td key={c.id} className={cn(dataCell, isLowest && "bg-brand-highlight/60")}>
                  <span className="text-[16px] font-black tabular-nums text-brand-dark">
                    {fmt(c.bidPrice)}원
                  </span>
                  {isLowest && (
                    <Badge tone="green" className="ml-2 px-2 py-0.5 text-[11px]">
                      최저가
                    </Badge>
                  )}
                </td>
              );
            })}
          </tr>
          <tr className={rowBorder}>
            <td className={labelCell}>법정필수교육 무상</td>
            {withFacts.map((c) => (
              <td key={c.id} className={dataCell}>
                <StatusCell
                  status={c.facts!.cost.legalTrainingFree}
                  note={c.facts!.cost.legalTrainingNote}
                />
              </td>
            ))}
          </tr>
          <tr className={rowBorder}>
            <td className={labelCell}>콘텐츠 무상 범위</td>
            {withFacts.map((c) => {
              const meta = CONTENT_FREE_META[c.facts!.cost.contentFreeScope];
              return (
                <td key={c.id} className={dataCell}>
                  <Badge tone={meta.tone} className="px-2.5 py-0.5">
                    {meta.label}
                  </Badge>
                  {c.facts!.cost.contentFreeNote && (
                    <p className="mt-1.5 text-[11px] leading-relaxed text-brand-muted">
                      {c.facts!.cost.contentFreeNote}
                    </p>
                  )}
                </td>
              );
            })}
          </tr>

          {/* ── 부가서비스 ── */}
          <GroupBand label="부가서비스" />
          {addonNames.map((name) => (
            <tr key={name} className={rowBorder}>
              <td className={labelCell}>{name}</td>
              {withFacts.map((c) => {
                const a = c.facts!.addons.find((x) => x.name === name);
                if (!a)
                  return (
                    <td key={c.id} className={cn(dataCell, "text-brand-muted")}>
                      —
                    </td>
                  );
                return (
                  <td key={c.id} className={dataCell}>
                    <StatusCell status={a.status} note={a.note} />
                  </td>
                );
              })}
            </tr>
          ))}

          {/* ── 종합 장·단점 ── */}
          <GroupBand label="종합 장·단점" />
          <tr className={rowBorder}>
            <td className={labelCell}>장점</td>
            {withFacts.map((c) => (
              <td key={c.id} className={dataCell}>
                <ul className="flex flex-col gap-1.5">
                  {c.facts!.diagnosis.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-1.5 leading-relaxed">
                      <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-brand-green" />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </td>
            ))}
          </tr>
          <tr>
            <td className={labelCell}>단점</td>
            {withFacts.map((c) => (
              <td key={c.id} className={dataCell}>
                <ul className="flex flex-col gap-1.5">
                  {c.facts!.diagnosis.weaknesses.map((w, i) => (
                    <li key={i} className="flex items-start gap-1.5 leading-relaxed">
                      <XCircle size={13} className="mt-0.5 shrink-0 text-brand-red" />
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
