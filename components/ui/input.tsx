import * as React from "react";
import { cn } from "@/lib/utils";

/*
 * OK 디자인 가이드 7.4 — 입력·선택.
 * 44px 높이, 11px 라운드, 포커스 시 오렌지 보더 + 4px 소프트 링(rgba .09).
 */
const control =
  "w-full min-h-[44px] rounded-control border border-brand-borderStrong bg-white px-3 py-2.5 text-sm text-brand-dark placeholder:text-brand-muted transition-[border-color,box-shadow] duration-150 focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/[0.09]";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return <input ref={ref} className={cn(control, className)} {...props} />;
  }
);
Input.displayName = "Input";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <select ref={ref} className={cn(control, "font-bold", className)} {...props}>
        {children}
      </select>
    );
  }
);
Select.displayName = "Select";

export const Label = ({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
  <label
    className={cn("ml-0.5 text-[11px] font-black text-brand-brown", className)}
    {...props}
  />
);
