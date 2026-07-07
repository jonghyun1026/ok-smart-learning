import { cn } from "@/lib/utils";

export function DonutGauge({
  value,
  max,
  size = 150,
  strokeWidth = 12,
  color = "#FF9900",
  trackColor = "rgba(255,255,255,0.12)",
  label,
  sublabel,
  labelClassName,
  sublabelClassName,
}: {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  label?: string;
  sublabel?: string;
  labelClassName?: string;
  sublabelClassName?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0;
  const dashOffset = circumference * (1 - ratio);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 0.3s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        {label && <span className={cn("text-2xl font-extrabold", labelClassName)}>{label}</span>}
        {sublabel && <span className={cn("text-[11px] font-semibold", sublabelClassName)}>{sublabel}</span>}
      </div>
    </div>
  );
}
