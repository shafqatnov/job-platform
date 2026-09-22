import Link from "next/link";
import { cn } from "@/utils/cn";

export type PaginationProps = {
  currentPage: number;
  totalPages: number;
  /** Real navigable URL for the previous page — omit to render Previous disabled (also disabled on page 1 regardless). */
  previousHref?: string;
  /** Real navigable URL for the next page — omit to render Next disabled (also disabled on the last page regardless). */
  nextHref?: string;
  className?: string;
};

const CONTROL_CLASSNAME =
  "inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * Real pagination navigation — plain <Link>s (no client-only state), so
 * Previous/Next work without JavaScript and are normal, crawlable,
 * accessible links, per this feature's own requirement. At a boundary
 * (first/last page, or the caller has no href for that direction — e.g.
 * a country with too few jobs for a second page) it falls back to a
 * disabled <button>, exactly as before this component was wired up.
 */
export function Pagination({ currentPage, totalPages, previousHref, nextHref, className }: PaginationProps) {
  const isFirst = currentPage <= 1;
  const isLast = currentPage >= totalPages;

  return (
    <nav aria-label="Pagination" className={cn("flex items-center justify-center gap-3", className)}>
      {!isFirst && previousHref ? (
        <Link href={previousHref} className={CONTROL_CLASSNAME}>
          Previous
        </Link>
      ) : (
        <button type="button" disabled className={CONTROL_CLASSNAME}>
          Previous
        </button>
      )}
      <span className="text-sm text-muted-foreground" aria-current="page">
        Page {currentPage} of {totalPages}
      </span>
      {!isLast && nextHref ? (
        <Link href={nextHref} className={CONTROL_CLASSNAME}>
          Next
        </Link>
      ) : (
        <button type="button" disabled className={CONTROL_CLASSNAME}>
          Next
        </button>
      )}
    </nav>
  );
}
