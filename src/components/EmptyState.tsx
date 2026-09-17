import type { ReactNode } from "react";
import { cn } from "@/utils/cn";
import { InboxIcon } from "@/components/icons";

export type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  /** Decorative icon shown above the title. Defaults to a generic inbox glyph. */
  icon?: ReactNode;
  className?: string;
};

/**
 * Generic "nothing here yet" placeholder for any list/section with no
 * data to show. Presentational only — callers decide the copy.
 */
export function EmptyState({ title, description, action, icon, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border border-border bg-surface-muted px-6 py-14 text-center",
        className
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
        {icon ?? <InboxIcon className="h-6 w-6" />}
      </div>
      <p className="text-base font-semibold text-foreground">{title}</p>
      {description ? <p className="max-w-md text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
