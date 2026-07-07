import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("w-full rounded-xl border border-brand-border bg-white", className)}
      {...props}
    />
  );
}
