"use client";

import { useState } from "react";
import { Building2, GitCompare, LayoutList, SlidersHorizontal, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { CompanyRegistration } from "@/components/admin/company-registration";
import { ResultsDashboard } from "@/components/admin/results-dashboard";
import { CriteriaManager } from "@/components/admin/criteria-manager";
import { AiRationale } from "@/components/admin/ai-rationale";
import { AiComparison } from "@/components/admin/ai-comparison";

type AdminTab = "companies" | "results" | "ai-rationale" | "ai-comparison" | "criteria";

const TABS: { id: AdminTab; label: string; icon: typeof Building2 }[] = [
  { id: "companies", label: "참가업체 등록", icon: Building2 },
  { id: "results", label: "종합결과", icon: LayoutList },
  { id: "ai-rationale", label: "AI 평가근거", icon: Sparkles },
  { id: "ai-comparison", label: "AI 평가 비교", icon: GitCompare },
  { id: "criteria", label: "평가기준 관리", icon: SlidersHorizontal },
];

export default function AdminPage() {
  const [tab, setTab] = useState<AdminTab>("companies");
  const [resultsRefreshKey, setResultsRefreshKey] = useState(0);

  return (
    <main className="flex flex-col gap-7 px-8 py-10 md:px-16">
      <div className="flex flex-col gap-1">
        <h1 className="text-[22px] font-black text-brand-dark">관리자</h1>
        <p className="text-[13px] text-brand-muted">
          참가업체를 등록·판정하고, 종합 평가 결과(협상적격자)를 확인하고, 평가기준(영역/항목/설정)을
          직접 편집합니다.
        </p>
      </div>

      <div className="flex gap-2 border-b border-brand-border">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 border-b-[3px] -mb-px px-4 py-3 text-sm font-bold whitespace-nowrap transition-colors",
                active
                  ? "border-brand text-brand"
                  : "border-transparent text-brand-muted hover:text-brand-dark"
              )}
            >
              <Icon size={16} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "companies" && (
        <CompanyRegistration onChanged={() => setResultsRefreshKey((k) => k + 1)} />
      )}
      {tab === "results" && <ResultsDashboard refreshKey={resultsRefreshKey} />}
      {tab === "ai-rationale" && <AiRationale />}
      {tab === "ai-comparison" && <AiComparison />}
      {tab === "criteria" && (
        <CriteriaManager onChanged={() => setResultsRefreshKey((k) => k + 1)} />
      )}
    </main>
  );
}
