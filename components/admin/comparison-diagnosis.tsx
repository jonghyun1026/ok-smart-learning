"use client";

import { useMemo } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Boxes,
  CheckCircle2,
  GraduationCap,
  HelpCircle,
  Layers,
  MinusCircle,
  Puzzle,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Video,
  Wallet,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  CONTENT_FREE_META,
  FACT_STATUS_META,
  type ComparisonFacts,
  type ContentMetric,
  type FactStatus,
} from "@/lib/comparison";

export type DiagnosisCompany = {
  id: string;
  name: string;
  bidPrice: number;
  color: string;
  facts: ComparisonFacts | null;
};

const CARD = "rounded-2xl border border-brand-border bg-white p-6 shadow-sm";

function SectionHeader({
  icon: Icon,
  title,
  desc,
}: {
  icon: typeof Boxes;
  title: string;
  desc?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-2 text-[15px] font-black text-brand-dark">
        <Icon size={17} className="text-brand" />
        {title}
      </span>
      {desc && <span className="text-[12px] leading-relaxed text-brand-muted">{desc}</span>}
    </div>
  );
}

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString();
}

/** 여러 업체의 metrics를 key 기준으로 통합해 표시 순서·라벨·단위를 확정한다. */
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

function StatusIcon({ status }: { status: FactStatus }) {
  if (status === "provided") return <CheckCircle2 size={15} className="text-brand-green" />;
  if (status === "partial") return <MinusCircle size={15} className="text-brand-amber" />;
  if (status === "absent") return <XCircle size={15} className="text-brand-red" />;
  return <HelpCircle size={15} className="text-brand-muted" />;
}

const OPERATION_ICONS: Record<string, typeof Video> = {
  enrollment: GraduationCap,
  video: Video,
  security: ShieldCheck,
};

/**
 * 종합결과 대시보드 "비교 진단" 뷰 — 점수가 아니라 제안서에서 추출한 사실을 나란히 비교한다.
 * (1) 콘텐츠 규모 (2) 비용·무상제공 (3) 부가서비스 매트릭스 (4) 운영·관리 장단점
 * (5) 종합 장단점 진단. comparison_facts(jsonb)를 소스로 하며, 없는 업체는 안내로 대체한다.
 * 모든 값은 AI 초안이므로 사람 검증 대상(CLAUDE.md)이라는 점을 상단에 명시한다.
 */
export function ComparisonDiagnosis({ companies }: { companies: DiagnosisCompany[] }) {
  const withFacts = useMemo(() => companies.filter((c) => c.facts), [companies]);
  const metrics = useMemo(() => unionMetrics(companies), [companies]);

  const addonNames = useMemo(() => {
    const order: string[] = [];
    const seen = new Set<string>();
    for (const c of companies) {
      for (const a of c.facts?.addons ?? []) {
        if (!seen.has(a.name)) {
          seen.add(a.name);
          order.push(a.name);
        }
      }
    }
    return order;
  }, [companies]);

  const operationKeys = useMemo(() => {
    const order: { key: string; label: string }[] = [];
    const seen = new Set<string>();
    for (const c of companies) {
      for (const op of c.facts?.operations ?? []) {
        if (!seen.has(op.key)) {
          seen.add(op.key);
          order.push({ key: op.key, label: op.label });
        }
      }
    }
    return order;
  }, [companies]);

  const gridColsClass = withFacts.length <= 2 ? "md:grid-cols-2" : "md:grid-cols-3";

  if (withFacts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-brand-border bg-brand-bg p-10 text-center">
        <Sparkles size={22} className="text-brand-muted" />
        <p className="text-sm font-bold text-brand-dark">아직 구조화된 비교 사실이 없습니다.</p>
        <p className="max-w-md text-xs leading-relaxed text-brand-muted">
          Claude Code 세션에서 &quot;OO업체 평가해줘&quot;라고 요청하면 evaluation-agent가 제안서에서
          콘텐츠 규모·무상제공·부가서비스·운영 장단점을 추출해 이 비교 진단을 채웁니다.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* 안내 배너 */}
      <div className="flex items-start gap-2 rounded-xl border border-brand-amber/40 bg-[#FFF8EC] p-3.5">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-brand-amber" />
        <p className="text-[12px] leading-relaxed text-brand-dark">
          아래는 <b>AI가 제안서에서 추출한 사실 요약</b>입니다. 점수가 아니라 &quot;무엇을 제안했는가&quot;를
          업체별로 나란히 비교하는 자료입니다. <b>(담당자 확인)</b>으로 표시된 항목은 제안서 밖에서
          담당자가 확인·보완한 내용이며, 그 외 항목은 확정 판단 전 원본 제안서로 교차 검증해야 합니다.
        </p>
      </div>

      {/* 1. 콘텐츠 규모 */}
      <div className={cn(CARD, "flex flex-col gap-5")}>
        <SectionHeader
          icon={Boxes}
          title="콘텐츠 규모 — 분야별 과정 수 · 콘텐츠 수 · 총 시간"
          desc="'건수'는 마이크로러닝 포함 여부에 따라 크게 달라지므로, 실질 학습량을 나타내는 총 학습시간을 함께 봅니다. (각 지표는 최댓값 대비 막대 길이)"
        />

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {metrics.map((metric) => {
            const values = companies.map((c) => metricValue(c, metric.key));
            const max = Math.max(1, ...values.map((v) => v ?? 0));
            const isHours = metric.key === "hours";
            return (
              <div
                key={metric.key}
                className={cn(
                  "flex flex-col gap-3 rounded-xl border p-4",
                  isHours ? "border-brand/30 bg-[#FFF4F0]" : "border-brand-border"
                )}
              >
                <span className="flex items-center gap-1.5 text-[12.5px] font-bold text-brand-dark">
                  {isHours && <BadgeCheck size={14} className="text-brand" />}
                  {metric.label}
                </span>
                <div className="flex flex-col gap-2.5">
                  {companies.map((c) => {
                    const v = metricValue(c, metric.key);
                    return (
                      <div key={c.id} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-[12px]">
                          <span className="truncate font-bold text-brand-dark">{c.name}</span>
                          <span className="shrink-0 font-black text-brand-dark">
                            {v === null ? "—" : `${fmt(v)}${metric.unit === "시간" ? "" : ""}`}
                            <span className="ml-0.5 text-[10px] font-medium text-brand-muted">{v === null ? "" : metric.unit}</span>
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-brand-bg">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${((v ?? 0) / max) * 100}%`,
                              backgroundColor: c.color,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* 콘텐츠 구성 성격 + 분야별 */}
        <div className={cn("grid grid-cols-1 gap-4", gridColsClass)}>
          {withFacts.map((c) => (
            <div key={c.id} className="flex flex-col gap-3 rounded-xl border border-brand-border p-4">
              <span className="flex items-center gap-2 text-sm font-black text-brand-dark">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                {c.name}
              </span>
              <p className="rounded-lg bg-brand-bg p-2.5 text-[12px] leading-relaxed text-brand-dark">
                {c.facts!.content.typeNote}
              </p>
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-black uppercase tracking-wide text-brand-muted">분야별 과정</span>
                {c.facts!.content.fields.map((f) => (
                  <div key={f.name} className="flex items-baseline justify-between gap-2 text-[12.5px]">
                    <span className="font-bold text-brand-dark">{f.name}</span>
                    <span className="shrink-0 font-black text-brand-dark">
                      {f.courses === null ? "제공(건수 미집계)" : `${fmt(f.courses)}과정`}
                    </span>
                  </div>
                ))}
              </div>
              {c.facts!.content.verified && (
                <span className="flex items-center gap-1 text-[11px] font-bold text-brand-green">
                  <CheckCircle2 size={12} /> 원본 파일 대조 검증됨
                </span>
              )}
              {c.facts!.content.note && (
                <p className="text-[11px] leading-relaxed text-brand-muted">{c.facts!.content.note}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 2. 비용 · 무상제공 */}
      <div className={cn(CARD, "flex flex-col gap-4")}>
        <SectionHeader
          icon={Wallet}
          title="비용 — 제안가 · 법정필수교육/콘텐츠 무상제공"
          desc="제안가는 낮을수록 유리합니다. 무상제공 여부는 제안서 명시 근거 기준이며, '명시 불충분'은 추가 확인이 필요하다는 뜻입니다."
        />
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-left">
            <thead>
              <tr className="border-b border-brand-border">
                <th className="w-[160px] py-2.5 pr-3 text-[12px] font-bold text-brand-muted">항목</th>
                {withFacts.map((c) => (
                  <th key={c.id} className="py-2.5 px-3 text-[13px] font-black text-brand-dark">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                      {c.name}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-brand-border/60">
                <td className="py-3 pr-3 align-top text-[12.5px] font-bold text-brand-dark">제안가</td>
                {withFacts.map((c) => {
                  const lowest = Math.min(
                    ...withFacts.map((x) => x.bidPrice).filter((p) => p > 0)
                  );
                  const isLowest = c.bidPrice > 0 && c.bidPrice === lowest;
                  return (
                    <td key={c.id} className="py-3 px-3 align-top">
                      <span className="text-[15px] font-black text-brand-dark">{fmt(c.bidPrice)}원</span>
                      {isLowest && (
                        <Badge tone="green" className="ml-2 px-2 py-0.5 text-[11px]">
                          최저가
                        </Badge>
                      )}
                    </td>
                  );
                })}
              </tr>
              <tr className="border-b border-brand-border/60">
                <td className="py-3 pr-3 align-top text-[12.5px] font-bold text-brand-dark">법정필수교육 무상</td>
                {withFacts.map((c) => {
                  const meta = FACT_STATUS_META[c.facts!.cost.legalTrainingFree];
                  return (
                    <td key={c.id} className="py-3 px-3 align-top">
                      <Badge tone={meta.tone} className="px-2.5 py-0.5">{meta.label}</Badge>
                      {c.facts!.cost.legalTrainingNote && (
                        <p className="mt-1.5 text-[11px] leading-relaxed text-brand-muted">
                          {c.facts!.cost.legalTrainingNote}
                        </p>
                      )}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td className="py-3 pr-3 align-top text-[12.5px] font-bold text-brand-dark">콘텐츠 무상 범위</td>
                {withFacts.map((c) => {
                  const meta = CONTENT_FREE_META[c.facts!.cost.contentFreeScope];
                  return (
                    <td key={c.id} className="py-3 px-3 align-top">
                      <Badge tone={meta.tone} className="px-2.5 py-0.5">{meta.label}</Badge>
                      {c.facts!.cost.contentFreeNote && (
                        <p className="mt-1.5 text-[11px] leading-relaxed text-brand-muted">
                          {c.facts!.cost.contentFreeNote}
                        </p>
                      )}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. 부가서비스 매트릭스 */}
      <div className={cn(CARD, "flex flex-col gap-4")}>
        <SectionHeader
          icon={Puzzle}
          title="부가서비스 비교"
          desc="업체별 부가서비스 제공 여부를 한눈에 봅니다. 제공/부분/없음/불명확은 제안서 서면 근거 기준입니다."
        />
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <thead>
              <tr className="border-b border-brand-border">
                <th className="w-[200px] py-2.5 pr-3 text-[12px] font-bold text-brand-muted">부가서비스</th>
                {withFacts.map((c) => (
                  <th key={c.id} className="py-2.5 px-3 text-[13px] font-black text-brand-dark">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                      {c.name}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {addonNames.map((name) => (
                <tr key={name} className="border-b border-brand-border/60 last:border-b-0">
                  <td className="py-3 pr-3 align-top text-[12.5px] font-bold text-brand-dark">{name}</td>
                  {withFacts.map((c) => {
                    const a = c.facts!.addons.find((x) => x.name === name);
                    if (!a)
                      return (
                        <td key={c.id} className="py-3 px-3 align-top text-[12px] text-brand-muted">
                          —
                        </td>
                      );
                    const meta = FACT_STATUS_META[a.status];
                    return (
                      <td key={c.id} className="py-3 px-3 align-top">
                        <span className="flex items-center gap-1.5 text-[12.5px] font-bold" style={{ color: undefined }}>
                          <StatusIcon status={a.status} />
                          <span
                            className={cn(
                              a.status === "provided" && "text-brand-green",
                              a.status === "partial" && "text-brand-amber",
                              a.status === "absent" && "text-brand-red",
                              a.status === "unclear" && "text-brand-muted"
                            )}
                          >
                            {meta.label}
                          </span>
                        </span>
                        {a.note && (
                          <p className="mt-1 text-[11px] leading-relaxed text-brand-muted">{a.note}</p>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. 운영 및 관리 장단점 */}
      <div className={cn(CARD, "flex flex-col gap-5")}>
        <SectionHeader
          icon={Layers}
          title="운영 및 관리 — 장단점 비교"
          desc="교육신청·관리(콜센터/VOC), 자체영상제작·업로드, 보안 세 영역별로 업체 강점·약점을 대조합니다."
        />
        {operationKeys.map(({ key, label }) => {
          const OpIcon = OPERATION_ICONS[key] ?? Layers;
          return (
            <div key={key} className="flex flex-col gap-3">
              <span className="flex items-center gap-2 border-b border-brand-border pb-2 text-[13.5px] font-black text-brand-dark">
                <OpIcon size={15} className="text-brand" />
                {label}
              </span>
              <div className={cn("grid grid-cols-1 gap-4", gridColsClass)}>
                {withFacts.map((c) => {
                  const op = c.facts!.operations.find((x) => x.key === key);
                  return (
                    <div key={c.id} className="flex flex-col gap-2.5 rounded-xl border border-brand-border p-4">
                      <span className="flex items-center gap-2 text-[13px] font-black text-brand-dark">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                        {c.name}
                      </span>
                      {!op ? (
                        <p className="text-[12px] text-brand-muted">이 영역에 대한 요약이 없습니다.</p>
                      ) : (
                        <>
                          <ul className="flex flex-col gap-1.5">
                            {op.pros.map((p, i) => (
                              <li key={i} className="flex items-start gap-1.5 text-[12.5px] leading-relaxed text-brand-dark">
                                <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-brand-green" />
                                <span>{p}</span>
                              </li>
                            ))}
                          </ul>
                          {op.cons.length > 0 && (
                            <ul className="flex flex-col gap-1.5 border-t border-dashed border-brand-border pt-2.5">
                              {op.cons.map((con, i) => (
                                <li key={i} className="flex items-start gap-1.5 text-[12.5px] leading-relaxed text-brand-dark">
                                  <XCircle size={13} className="mt-0.5 shrink-0 text-brand-red" />
                                  <span>{con}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* 5. 업체별 종합 장단점 진단 */}
      <div className={cn(CARD, "flex flex-col gap-4")}>
        <SectionHeader
          icon={Stethoscope}
          title="업체별 종합 장단점 진단"
          desc="강점·약점·반드시 확인할 사항을 업체별로 종합합니다. '확인 필요' 항목은 협상 전 담당자가 원본으로 검증해야 합니다."
        />
        <div className={cn("grid grid-cols-1 gap-4", withFacts.length <= 2 ? "md:grid-cols-2" : "lg:grid-cols-3")}>
          {withFacts.map((c) => {
            const d = c.facts!.diagnosis;
            return (
              <div
                key={c.id}
                className="flex flex-col gap-3 rounded-2xl border border-brand-border p-5 shadow-sm"
                style={{ borderTop: `4px solid ${c.color}` }}
              >
                <span className="text-[15px] font-black text-brand-dark">{c.name}</span>

                <div className="flex flex-col gap-1.5 rounded-lg bg-[#EDF7F0] p-3">
                  <span className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wide text-brand-green">
                    <CheckCircle2 size={13} /> 강점
                  </span>
                  {d.strengths.map((s, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-[12.5px] leading-relaxed text-brand-dark">
                      <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-brand-green" />
                      <span>{s}</span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-1.5 rounded-lg bg-[#FBEEEC] p-3">
                  <span className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wide text-brand-red">
                    <XCircle size={13} /> 약점
                  </span>
                  {d.weaknesses.map((w, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-[12.5px] leading-relaxed text-brand-dark">
                      <XCircle size={13} className="mt-0.5 shrink-0 text-brand-red" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>

                {d.flags.length > 0 && (
                  <div className="flex flex-col gap-1.5 rounded-lg bg-[#FFF3DD] p-3">
                    <span className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wide text-brand-amber">
                      <AlertTriangle size={13} /> 반드시 확인
                    </span>
                    {d.flags.map((f, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-[12.5px] leading-relaxed text-brand-dark">
                        <AlertTriangle size={13} className="mt-0.5 shrink-0 text-brand-amber" />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                )}

                {d.summary && (
                  <p className="rounded-lg bg-brand-bg p-3 text-[12.5px] leading-relaxed text-brand-dark">
                    {d.summary}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
