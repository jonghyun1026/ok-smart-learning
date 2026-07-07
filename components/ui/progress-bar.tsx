import { cn } from "@/lib/utils";

/** 항목/영역 배점 대비 진행률을 보여주는 얇은 미니 진행바. */
export function ProgressBar({
  value,
  max,
  className,
  trackClassName,
  barClassName,
  colorHex,
}: {
  value: number;
  max: number;
  className?: string;
  trackClassName?: string;
  barClassName?: string;
  colorHex?: string;
}) {
  const ratio = max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0;
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-brand-bg", trackClassName, className)}>
      <div
        className={cn("h-full rounded-full bg-brand", barClassName)}
        style={{ width: `${ratio * 100}%`, backgroundColor: colorHex }}
      />
    </div>
  );
}
