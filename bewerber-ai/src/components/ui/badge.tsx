import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "secondary" | "outline" | "success" | "warning" | "destructive" | "blue";

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-slate-900 text-white",
  secondary: "bg-muted text-slate-700",
  outline: "border border-border text-slate-600",
  success: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border border-amber-200",
  destructive: "bg-red-50 text-red-700 border border-red-200",
  blue: "bg-blue-50 text-blue-700 border border-blue-200",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
