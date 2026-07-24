import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * 섹션 구분 제목 — 브라운 볼드 타이틀 + 얇은 라인, 선택적 우측 액션/설명.
 * 정보 위계(2.2 Data-first)를 유지하기 위해 화면 곳곳에서 일관된 위계로 쓴다.
 */
export function SectionTitle({
  icon: Icon,
  children,
  aside,
  className,
}: {
  icon?: LucideIcon;
  children: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="flex items-center gap-2 whitespace-nowrap text-[15px] font-black tracking-[-0.01em] text-brand-brown">
        {Icon && <Icon size={17} className="text-brand" />}
        {children}
      </span>
      <span className="h-px flex-1 bg-brand-border" />
      {aside && <span className="shrink-0 text-[12px] font-bold text-brand-muted">{aside}</span>}
    </div>
  );
}
