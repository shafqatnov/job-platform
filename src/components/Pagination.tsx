import { cn } from "@/utils/cn";

export type PaginationProps = {
  currentPage: number;
  totalPages: number;
  className?: string;
};

/**
 * Presentational pagination foundation. Previous/Next are disabled at the
 * natural boundaries (including when there is only one page) — it has no
 * navigation behavior yet, ready to be wired to real paging later.
 */
export function Pagination({ currentPage, totalPages, className }: PaginationProps) {
  const isFirst = currentPage <= 1;
  const isLast = currentPage >= totalPages;

  return (
    <nav aria-label="Pagination" className={cn("flex items-center justify-center gap-3", className)}>
      <button
        type="button"
        disabled={isFirst}
        className="inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Previous
      </button>
      <span className="text-sm text-muted-foreground">
        Page {currentPage} of {totalPages}
      </span>
      <button
        type="button"
        disabled={isLast}
        className="inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Next
      </button>
    </nav>
  );
}
