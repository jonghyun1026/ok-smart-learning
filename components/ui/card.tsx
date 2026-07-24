import * as React from "react";
import { cn } from "@/lib/utils";

/*
 * OK 디자인 가이드 6.1 — 기본 카드(Warm 표면).
 * 순백 패널 + 얇은 웜 라인 + 낮은 대비의 브라운 그림자로 레이어를 나눈다.
 */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "w-full rounded-card border border-brand-border bg-white shadow-card",
        className
      )}
      {...props}
    />
  );
}

/** 차트·리스트 등 헤더(제목/설명/범례)를 가진 콘텐츠 패널. 가이드 7.7 */
export function Panel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <Card className={cn("p-[21px]", className)} {...props} />;
}
