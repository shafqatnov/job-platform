"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/utils/cn";
import { CANDIDATE_NAV_ITEMS } from "@/constants/candidateNavigation";

/**
 * Persistent secondary navigation for the whole /candidate area —
 * mirrors PrimaryNav.tsx's own active-highlight pattern exactly (same
 * usePathname()-based comparison), just for this section's own item
 * list. Horizontally scrollable rather than wrapping, so it stays a
 * single clean row on narrow screens instead of a tall stack.
 */
export function CandidateNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Candidate portal" className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-6xl gap-6 overflow-x-auto px-4 sm:px-6 lg:px-8">
        {CANDIDATE_NAV_ITEMS.map((item) => {
          const isActive = item.href === "/candidate" ? pathname === item.href : pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative whitespace-nowrap py-3 text-sm font-medium transition-colors after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:origin-left after:rounded-full after:bg-brand-600 after:transition-transform after:duration-200",
                isActive
                  ? "text-foreground after:scale-x-100"
                  : "text-muted-foreground after:scale-x-0 hover:text-foreground hover:after:scale-x-100"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
