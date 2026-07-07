import * as React from "react";
import { cn } from "@/lib/utils";

export type BadgeTone = "neutral" | "green" | "red" | "amber" | "brand";

const toneClasses: Record<BadgeTone, string> = {
  neutral: "bg-brand-bg text-brand-muted",
  green: "bg-brand-bg text-brand-green",
  red: "bg-brand-bg text-brand-red",
  amber: "bg-brand-bg text-brand-amber",
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
