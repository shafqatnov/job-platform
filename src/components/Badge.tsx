import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/utils/cn";

export type BadgeVariant = "neutral" | "brand" | "success" | "warning" | "danger";

const variantStyles: Record<BadgeVariant, string> = {
  neutral: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200",
  brand: "bg-brand-50 text-brand-700",
  success: "bg-success-50 text-success-700",
  warning: "bg-warning-50 text-warning-700",
  danger: "bg-danger-50 text-danger-700",
};

export type BadgeProps = ComponentPropsWithoutRef<"span"> & {
  variant?: BadgeVariant;
};

/**
 * Small status/label chip (e.g. a future job lifecycle or category tag).
 * Presentational only — callers decide what text/variant to pass.
 */
export function Badge({ variant = "neutral", className, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variantStyles[variant],
        className
      )}
      {...rest}
    />
  );
}
