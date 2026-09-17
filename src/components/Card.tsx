import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/utils/cn";

export type CardPadding = "none" | "sm" | "md" | "lg";

const paddingStyles: Record<CardPadding, string> = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export type CardProps = ComponentPropsWithoutRef<"div"> & {
  padding?: CardPadding;
};

/**
 * Generic elevated surface for grouping content (e.g. a future job-listing
 * card). Presentational only — no data fetching or domain knowledge.
 */
export function Card({ padding = "md", className, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface shadow-sm",
        paddingStyles[padding],
        className
      )}
      {...rest}
    />
  );
}
