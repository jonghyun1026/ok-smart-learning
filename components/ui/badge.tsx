import * as React from "react";
import { cn } from "@/lib/utils";

export type BadgeTone = "neutral" | "green" | "red" | "amber" | "brand";

// OK 디자인 가이드 7.10 — 상태 배지는 소프트 배경 + 상태색 텍스트(색만으로 구분하지 않도록 라벨 병기)
const toneClasses: Record<BadgeTone, string> = {
  neutral: "bg-brand-bg text-brand-muted",
  green: "bg-[#E7F4EE] text-brand-green",
  red: "bg-[#FBEEEC] text-brand-red",
  amber: "bg-[#FFF7DF] text-[#B7791F]",
  brand: "bg-brand text-white",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full px-3.5 py-1 text-[13px] font-bold whitespace-nowrap",
        toneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
