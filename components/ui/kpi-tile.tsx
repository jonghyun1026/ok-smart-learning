import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * KPI 타일 (OK 디자인 가이드 7.6) — 흰 표면 + 상단 3px 액센트 + 소프트 아이콘 타일 + 장식 원.
 * 카드 전체를 브랜드색으로 채우지 않고(2.1) 색은 액센트·타일에만 절제한다.
 * accent/soft는 HEX 문자열로 받아 accent-orange/yellow/brown/green 등 어떤 조합도 표현한다.
 */
export function KpiTile({
  icon: Icon,
  label,
  value,
  unit,
  sub,
  accent = "#F55000",
  soft = "#FFF1E9",
  className,
}: {
  icon?: LucideIcon;
  label: string;
  value: React.ReactNode;
  unit?: string;
  sub?: React.ReactNode;
  accent?: string;
  soft?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex min-h-[136px] flex-col gap-3 overflow-hidden rounded-card border border-brand-border bg-white p-5 shadow-card",
        className
      )}
    >
      <span className="absolute inset-x-0 top-0 h-[3px]" style={{ backgroundColor: accent }} />
      <span
        className="pointer-events-none absolute -right-8 -bottom-10 h-[105px] w-[105px] rounded-full opacity-60"
        style={{ backgroundColor: soft }}
      />
      {Icon && (
        <span
          className="relative flex h-10 w-10 items-center justify-center rounded-[11px]"
          style={{ backgroundColor: soft, color: accent }}
        >
          <Icon size={20} />
        </span>
      )}
      <div className="relative mt-auto flex flex-col gap-0.5">
        <span className="text-[11px] font-black uppercase tracking-wide text-brand-muted">
          {label}
        </span>
        <span className="text-[28px] font-black leading-none tracking-[-0.045em] text-brand-brown">
          {value}
          {unit && <span className="ml-0.5 text-[14px] font-bold text-brand-muted">{unit}</span>}
        </span>
        {sub && <span className="text-[11px] leading-relaxed text-brand-muted">{sub}</span>}
      </div>
    </div>
  );
}
