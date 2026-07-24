import * as React from "react";
import { cn } from "@/lib/utils";

/*
 * OK 디자인 가이드 3장 Hero — 화면 목적을 한 번에 전달하는 머리 영역.
 * eyebrow(오렌지 대문자) → 대형 브라운 타이틀(자간 좁힘) → Muted 설명 → 우측 주요 행동.
 * 브랜드색을 넓게 채우지 않고 텍스트 위계로 인상을 만든다(2.1 Brand-led / 2.3 Warm).
 */
export function PageHero({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex flex-col items-start justify-between gap-6 px-0.5 pb-6 pt-2.5 md:flex-row md:items-end md:gap-7",
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2.5">{eyebrow}</p>}
        <h1 className="text-[clamp(26px,3vw,40px)] font-black leading-[1.12] tracking-[-0.045em] text-brand-brown">
          {title}
        </h1>
        {description && (
          <p className="mt-3 max-w-[680px] text-[14px] leading-[1.65] text-brand-muted">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap gap-2.5 md:justify-end">{actions}</div>
      )}
    </section>
  );
}
