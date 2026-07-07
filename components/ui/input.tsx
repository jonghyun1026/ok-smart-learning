import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full rounded-lg border border-brand-border bg-white px-3 py-2.5 text-sm text-brand-dark placeholder:text-brand-muted focus:outline-none focus:ring-2 focus:ring-brand/40",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          "w-full rounded-lg border border-brand-border bg-white px-3 py-2.5 text-sm font-bold text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand/40",
          className
        )}
        {...props}
      >
        {children}
      </select>
    );
  }
);
Select.displayName = "Select";

export const Label = ({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
  <label className={cn("text-[13px] font-bold text-brand-dark", className)} {...props} />
);
