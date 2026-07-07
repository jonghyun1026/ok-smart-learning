import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand/90",
  secondary: "bg-brand-dark text-white hover:bg-brand-dark/90",
  outline: "bg-white text-brand-dark border border-brand-border hover:bg-brand-bg",
  ghost: "bg-transparent text-brand-dark hover:bg-brand-bg",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
          variantClasses[variant],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
