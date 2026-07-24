"use client";

import { useState } from "react";
import { Building2, LayoutList, SlidersHorizontal, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { CompanyRegistration } from "@/components/admin/company-registration";
import { ResultsDashboard } from "@/components/admin/results-dashboard";
import { CriteriaManager } from "@/components/admin/criteria-manager";
import { AiEvaluationReport } from "@/components/admin/ai-evaluation-report";
import { PageHero } from "@/components/ui/page-hero";

type AdminTab = "companies" | "results" | "ai-report" | "criteria";

const TABS: { id: AdminTab; label: string; icon: typeof Building2 }[] = [
  { id: "companies", label: "참가업체 등록", icon: Building2 },
  { id: "results", label: "종합결과", icon: LayoutList },
  { id: "ai-report", label: "AI 평가 레포트", icon: Sparkles },
  { id: "criteria", label: "평가기준 관리", icon: SlidersHorizontal },
];

export default function AdminPage() {
  const [tab, setTab] = useState<AdminTab>("companies");
  const [resultsRefreshKey, setResultsRefreshKey] = useState(0);

  return (
    <main className="mx-auto flex w-full max-w-[1560px] flex-col gap-6 px-4 pb-16 pt-6 sm:px-6 lg:px-7">
      <PageHero
        eyebrow="관리자 콘솔"
        title="관리자"
        description="참가업체를 등록·판정하고, 종합 평가 결과(협상적격자)를 확인하고, 평가기준(영역/항목/설정)을 직접 편집합니다."
      />

      <div className="flex gap-1 overflow-x-auto border-b border-brand-border">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "-mb-px flex items-center gap-2 whitespace-nowrap border-b-[3px] px-4 py-3 text-sm font-bold transition-colors",
                active
                  ? "border-brand text-brand"
                  : "border-transparent text-brand-muted hover:text-brand-brown"
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
      {tab === "ai-report" && <AiEvaluationReport />}
      {tab === "criteria" && (
        <CriteriaManager onChanged={() => setResultsRefreshKey((k) => k + 1)} />
      )}
    </main>
  );
}
