"use client";

import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ContentMetric } from "@/lib/comparison";
import type { DiagnosisCompany } from "@/components/admin/comparison-diagnosis";

/*
 * 콘텐츠 규모 비교 — 지표별 세로 막대(small multiples).
 * 지표마다 스케일이 크게 다르므로(이러닝 3,563 vs 485, 총콘텐츠 48,513 vs 9,312) 한 축에
 * 섞지 않고 지표별 자체 스케일의 미니 세로 막대로 나눠, 업체 간 우열을 한눈에 비교한다.
 * (dataviz: 스케일 다른 measure는 small multiples) 색은 검증된 업체 categorical 팔레트,
 * 값은 텍스트 토큰(막대색이 아님)으로 찍고 이름 옆 점으로 식별을 보조한다.
 */
function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString();
}

function metricValue(c: DiagnosisCompany, key: string): number | null {
  const m = c.facts?.content.metrics.find((x) => x.key === key);
  return m ? m.value : null;
}

/*
 * 콘텐츠 구성 — 이러닝 vs 마이크로러닝 100% 누적 막대(part-to-whole).
 * 절대 규모(위 세로 막대)와 별개로 "무엇 위주인가"(정규 과정 vs 단발성)를 한눈에 보여준다.
 * 두 구간은 무게감을 나타내는 웜 브라운 명도 2단계(이러닝=진함, 마이크로=옅음)로 구분하고,
 * 값·범례를 병기해 색만으로 식별하지 않게 한다.
 */
const EL_COLOR = "#55474A"; // 이러닝(정규 과정) — 진한 브라운
const MI_COLOR = "#D9CFC9"; // 마이크로러닝 — 옅은 웜 그레이

export function ContentCompositionBars({ companies }: { companies: DiagnosisCompany[] }) {
  const withFacts = companies.filter((c) => c.facts);
  const rows = withFacts
    .map((c) => {
      const el = metricValue(c, "courses");
      const mi = metricValue(c, "micro_courses");
      return { c, el: el ?? 0, mi: mi ?? 0, has: el !== null || mi !== null };
    })
    .filter((r) => r.has && r.el + r.mi > 0);
  if (rows.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-brand-border p-4">
      <span className="text-[12.5px] font-bold text-brand-dark">
        콘텐츠 구성 — 이러닝 vs 마이크로러닝{" "}
        <span className="font-medium text-brand-muted">(과정 수 기준 비율)</span>
      </span>
      <div className="flex flex-col gap-3">
        {rows.map(({ c, el, mi }) => {
          const tot = el + mi;
          const elPct = (el / tot) * 100;
          const miPct = 100 - elPct;
          return (
            <div key={c.id} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between text-[12px]">
                <span className="flex items-center gap-1.5 font-bold text-brand-dark">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                  {c.name}
                </span>
                <span className="font-black text-brand-dark">{tot.toLocaleString()}과정</span>
              </div>
              <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-brand-bg">
                <div
                  className="h-full"
                  style={{ width: `${elPct}%`, backgroundColor: EL_COLOR }}
                  title={`${c.name} · 이러닝 ${el.toLocaleString()}과정 (${elPct.toFixed(0)}%)`}
                />
                <div
                  className="h-full"
                  style={{ width: `${miPct}%`, backgroundColor: MI_COLOR }}
                  title={`${c.name} · 마이크로러닝 ${mi.toLocaleString()}과정 (${miPct.toFixed(0)}%)`}
                />
              </div>
              <div className="flex justify-between text-[10.5px] font-semibold text-brand-muted tabular-nums">
                <span>이러닝 {el.toLocaleString()} ({elPct.toFixed(0)}%)</span>
                <span>마이크로러닝 {mi.toLocaleString()} ({miPct.toFixed(0)}%)</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 border-t border-brand-border/70 pt-2 text-[11px] font-bold text-brand-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: EL_COLOR }} />
          이러닝(정규 과정)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: MI_COLOR }} />
          마이크로러닝
        </span>
      </div>
    </div>
  );
}

export function ContentMetricBars({
  companies,
  metrics,
}: {
  companies: DiagnosisCompany[];
  metrics: ContentMetric[];
}) {
  const withFacts = companies.filter((c) => c.facts);
  if (metrics.length === 0 || withFacts.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {metrics.map((metric) => {
        const vals = withFacts.map((c) => ({ c, v: metricValue(c, metric.key) }));
        const max = Math.max(1, ...vals.map((x) => x.v ?? 0));
        const leadIdx = vals.reduce(
          (best, x, i) => ((x.v ?? -1) > (vals[best].v ?? -1) ? i : best),
          0
        );
        const isHours = metric.key === "hours";
        return (
          <div
            key={metric.key}
            className={cn(
              "flex flex-col gap-3 rounded-xl border p-4",
              isHours ? "border-brand/30 bg-[#FFF4F0]" : "border-brand-border"
            )}
          >
            <span className="flex min-h-[32px] items-start gap-1.5 text-[12px] font-bold leading-tight text-brand-dark">
              {isHours && <BadgeCheck size={14} className="mt-px shrink-0 text-brand" />}
              {metric.label}
            </span>

            {/* 플롯: baseline 위 세로 막대. 값 라벨은 막대 위, 이름은 막대 아래 */}
            <div className="flex items-end justify-center gap-4 border-b border-brand-border pb-0.5"
                 style={{ height: 108 }}>
              {vals.map(({ c, v }, i) => {
                const ratio = v === null ? 0 : v / max;
                const isLead = i === leadIdx && (v ?? 0) > 0 && withFacts.length > 1;
                return (
                  <div
                    key={c.id}
                    className="flex h-full flex-1 flex-col items-center justify-end gap-1"
                    title={`${c.name} · ${metric.label}: ${fmt(v)}${v === null ? "" : metric.unit}`}
                  >
                    <span
                      className={cn(
                        "text-[11px] tabular-nums leading-none",
                        isLead ? "font-black text-brand-dark" : "font-bold text-brand-dark"
                      )}
                    >
                      {fmt(v)}
                    </span>
                    <div
                      className="w-9 max-w-full rounded-t-[4px] transition-[height] duration-500"
                      style={{
                        height: `${Math.max(v ? 3 : 0, ratio * 92)}px`,
                        backgroundColor: c.color,
                        opacity: isLead ? 1 : 0.82,
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {/* 범례/축: 업체명 + 색 점 */}
            <div className="flex items-start justify-center gap-4">
              {vals.map(({ c }) => (
                <div key={c.id} className="flex flex-1 items-center justify-center gap-1">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: c.color }}
                  />
                  <span className="truncate text-[11px] font-bold text-brand-muted">{c.name}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
