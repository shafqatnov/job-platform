import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/utils/cn";

export type AdSlotSize = "leaderboard" | "rectangle" | "sidebar" | "mobile-banner";

// Reserved dimensions loosely follow common IAB ad sizes so real ad units
// can be dropped in later without any layout shift.
const sizeStyles: Record<AdSlotSize, string> = {
  leaderboard: "min-h-[90px] w-full max-w-[728px]",
  rectangle: "min-h-[250px] w-full max-w-[300px]",
  sidebar: "min-h-[600px] w-full max-w-[160px]",
  "mobile-banner": "min-h-[50px] w-full max-w-[320px]",
};

export type AdSlotProps = ComponentPropsWithoutRef<"div"> & {
  size: AdSlotSize;
  label?: string;
};

/**
 * Reserves layout space for a future ad placement. This does not load
 * Google AdSense or any ad network script, does not fetch or render real
 * ads, and does not claim any AdSense approval or policy compliance — it
 * only prevents layout shift once a real ad unit is added later, and must
 * never be placed where it would interrupt search, filters, or apply
 * actions (see docs/21-adsense-readiness.md).
 */
export function AdSlot({ size, label = "Advertisement", className, ...rest }: AdSlotProps) {
  return (
    <div
      role="complementary"
      aria-label={label}
      className={cn(
        "mx-auto flex flex-col items-center justify-center gap-1 rounded-lg border border-border bg-surface-muted",
        sizeStyles[size],
        className
      )}
      {...rest}
    >
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
        {label}
      </span>
    </div>
  );
}
