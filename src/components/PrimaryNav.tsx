"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/utils/cn";
import type { NavItem } from "@/constants/navigation";

export type PrimaryNavProps = {
  items: NavItem[];
  className?: string;
};

/**
 * Desktop primary navigation. Hidden on small screens by the caller.
 * Needs usePathname() to correctly highlight whichever item matches the
 * current page (e.g. "Home" only on "/", never on other public pages).
 */
export function PrimaryNav({ items, className }: PrimaryNavProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className={cn("flex items-center gap-8", className)}>
      {items.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative py-1 text-sm font-medium transition-colors after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:origin-left after:rounded-full after:bg-brand-600 after:transition-transform after:duration-200",
              isActive
                ? "text-foreground after:scale-x-100"
                : "text-muted-foreground after:scale-x-0 hover:text-foreground hover:after:scale-x-100"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
