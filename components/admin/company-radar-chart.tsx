"use client";

import { useMemo, useState } from "react";
import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { CriteriaData } from "@/lib/scoring";
import { getCompanyColor } from "@/lib/company-colors";

export type RadarCompanyRow = {
  company_id: string;
  company_name: string;
  avg_total_score: number | null;
  /** area_code -> 평가자 평균 소계 (calcAreaSubtotal 평균) */
  areaScores: Record<string, number>;
};

const AUTO_DISPLAY_LIMIT = 5;
const CUSTOM_TOGGLE_THRESHOLD = 6;

/**
 * 업체 간 강약점 비교 레이더 차트 (작업 3).
 * - 축: criteria.areas 중 type === 'score' 인 영역 전체(일반/콘텐츠/운영/시스템/가격 등, 관리자가
 *   영역을 추가/삭제해도 그대로 반영됨)
 * - 배점이 영역마다 달라 왜곡되므로 각 축을 영역 만점 대비 백분율(0~100%)로 정규화
 * - 업체가 6개 초과면 총점 상위 5개사만 기본 표시하고 "전체 보기/선택" 토글 제공
 * - 색상: lib/company-colors.ts (dataviz 스킬 검증 팔레트, OK 브랜드 오렌지 계열 슬롯 1 고정)
 */
export function CompanyRadarChart({
  criteria,
  companies,
}: {
  criteria: CriteriaData;
  /** 총점 내림차순으로 이미 정렬된 업체 목록 (results-dashboard의 rankCompanies 결과) */
  companies: RadarCompanyRow[];
}) {
  const scoreAreas = useMemo(() => criteria.areas.filter((a) => a.type === "score"), [criteria]);

  // 업체명이 중복될 수 있어(예: "OK에듀테크" 2개 등록 사례 — 평가입력 화면의 버그 B와 동일한 문제가
  // 범례에서도 발생한다) 이름이 겹치는 업체만 ID 뒷 4자리를 덧붙여 구분한다.
  const displayNames = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of companies) counts.set(c.company_name, (counts.get(c.company_name) ?? 0) + 1);
    const map = new Map<string, string>();
    for (const c of companies) {
      const isDup = (counts.get(c.company_name) ?? 0) > 1;
      map.set(c.company_id, isDup ? `${c.company_name} (#${c.company_id.slice(-4)})` : c.company_name);
    }
    return map;
  }, [companies]);

  const [customMode, setCustomMode] = useState(false);
  const [customSelection, setCustomSelection] = useState<Set<string> | null>(null);

  const defaultSelectedIds = useMemo(() => {
    const ids =
      companies.length > CUSTOM_TOGGLE_THRESHOLD
        ? companies.slice(0, AUTO_DISPLAY_LIMIT).map((c) => c.company_id)
        : companies.map((c) => c.company_id);
    return new Set(ids);
  }, [companies]);

  const activeIds = customMode ? customSelection ?? defaultSelectedIds : defaultSelectedIds;
  const activeCompanies = companies.filter((c) => activeIds.has(c.company_id));

  const chartData = scoreAreas.map((area) => {
    const row: Record<string, number | string> = { area: area.name, __max: area.maxPoints };
    for (const c of activeCompanies) {
      const raw = c.areaScores[area.code] ?? 0;
      row[c.company_id] = area.maxPoints > 0 ? Math.round((raw / area.maxPoints) * 1000) / 10 : 0;
      row[`${c.company_id}__raw`] = Math.round(raw * 100) / 100;
    }
    return row;
  });

  function toggleCompany(id: string) {
    setCustomSelection((prev) => {
      const base = prev ?? new Set(defaultSelectedIds);
      const next = new Set(base);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (companies.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-brand-border bg-white p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="text-base font-bold text-brand-dark">업체 간 비교 (레이더 차트)</span>
          <span className="text-[12px] text-brand-muted">
            영역별 평가자 평균 점수를 영역 만점 대비 백분율로 정규화해 겹쳐 표시합니다.
            {companies.length > CUSTOM_TOGGLE_THRESHOLD &&
              !customMode &&
              ` 업체가 ${companies.length}개라 총점 상위 ${AUTO_DISPLAY_LIMIT}개사만 기본 표시됩니다.`}
          </span>
        </div>
        {companies.length > AUTO_DISPLAY_LIMIT && (
          <button
            type="button"
            onClick={() => {
              if (customMode) {
                setCustomMode(false);
                setCustomSelection(null);
              } else {
                setCustomMode(true);
                setCustomSelection(new Set(defaultSelectedIds));
              }
            }}
            className="w-fit shrink-0 rounded-lg border border-brand-border px-3 py-1.5 text-[12px] font-bold text-brand hover:bg-brand-bg"
          >
            {customMode ? `상위 ${AUTO_DISPLAY_LIMIT}개만 보기` : "전체 보기 / 선택"}
          </button>
        )}
      </div>

      {customMode && (
        <div className="flex flex-wrap gap-2">
          {companies.map((c) => {
            const idx = companies.findIndex((x) => x.company_id === c.company_id);
            const color = getCompanyColor(idx);
            const checked = activeIds.has(c.company_id);
            return (
              <button
                key={c.company_id}
                type="button"
                onClick={() => toggleCompany(c.company_id)}
                className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-bold transition-colors"
                style={
                  checked
                    ? { backgroundColor: color, borderColor: color, color: "#fff" }
                    : { borderColor: "#E8E2DD", color: "#8A7F86" }
                }
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: checked ? "#fff" : color }}
                />
                {displayNames.get(c.company_id) ?? c.company_name}
              </button>
            );
          })}
        </div>
      )}

      {activeCompanies.length === 0 ? (
        <p className="text-sm text-brand-muted">비교할 업체를 1개 이상 선택해주세요.</p>
      ) : (
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={chartData} outerRadius="72%">
              <PolarGrid stroke="#e1e0d9" />
              <PolarAngleAxis dataKey="area" tick={{ fill: "#52514E", fontSize: 12, fontWeight: 700 }} />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                tick={{ fill: "#898781", fontSize: 10 }}
                tickFormatter={(v: number) => `${v}%`}
              />
              {activeCompanies.map((c) => {
                const idx = companies.findIndex((x) => x.company_id === c.company_id);
                const color = getCompanyColor(idx);
                return (
                  <Radar
                    key={c.company_id}
                    name={displayNames.get(c.company_id) ?? c.company_name}
                    dataKey={c.company_id}
                    stroke={color}
                    fill={color}
                    fillOpacity={0.12}
                    strokeWidth={2}
                  />
                );
              })}
              <Legend wrapperStyle={{ fontSize: 12, fontWeight: 700 }} />
              <Tooltip
                formatter={(value, name, item) => {
                  const dataKey = String(item?.dataKey ?? "");
                  const payload = item?.payload as Record<string, number> | undefined;
                  const raw = payload ? payload[`${dataKey}__raw`] : undefined;
                  const max = payload ? payload.__max : undefined;
                  return [`${value}% (${raw ?? "-"} / ${max ?? "-"}점)`, name];
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
