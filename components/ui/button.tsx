import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

/*
 * OK 디자인 가이드 7.2 — 버튼.
 * Primary는 화면당 1개 원칙(2.1)에 맞춰 오렌지 채움 + 웜 그림자로 딱 하나만 강조하고,
 * 나머지 행동은 흰 표면 + 브라운 텍스트의 절제된 secondary/outline로 둔다.
 */
const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control font-extrabold transition-[transform,background-color,border-color,box-shadow] duration-150 ease-out disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/15";

const variantClasses: Record<Variant, string> = {
  primary:
    "min-h-[42px] px-4 text-sm border border-brand bg-brand text-white shadow-primary hover:-translate-y-px hover:border-brand-deep hover:bg-brand-deep",
  secondary:
    "min-h-[42px] px-4 text-sm border border-brand-borderStrong bg-white text-brand-brown hover:-translate-y-px hover:border-[#c9c0bb]",
  outline:
    "min-h-[42px] px-4 text-sm border border-brand bg-white text-brand hover:-translate-y-px hover:bg-brand-highlight",
  ghost:
    "min-h-[34px] px-3 text-[12px] bg-transparent text-brand-brown hover:bg-brand-highlight hover:text-brand",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", ...props }, ref) => {
    return (
      <button ref={ref} className={cn(base, variantClasses[variant], className)} {...props} />
    );
  }
);
Button.displayName = "Button";
