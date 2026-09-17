"use client";

import { useState } from "react";
import Link from "next/link";
import type { NavItem } from "@/constants/navigation";

export type MobileNavProps = {
  items: NavItem[];
  className?: string;
};

/**
 * Mobile navigation foundation: a toggle button that reveals a dropdown
 * panel with the same links as the desktop nav. Deliberately simple (no
 * animation library) — a starting point future dashboard/candidate/
 * employer navs can follow the same pattern for.
 */
export function MobileNav({ items, className }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls="mobile-nav-panel"
        onClick={() => setIsOpen((open) => !open)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <span className="sr-only">{isOpen ? "Close menu" : "Open menu"}</span>
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5}>
          {isOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
          )}
        </svg>
      </button>
      {isOpen ? (
        <nav
          id="mobile-nav-panel"
          aria-label="Mobile"
          className="absolute inset-x-0 top-16 z-20 border-b border-border bg-surface px-4 py-3 shadow-lg"
        >
          <ul className="flex flex-col divide-y divide-border">
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className="block rounded-md px-2 py-3.5 text-base font-medium text-foreground transition-colors hover:bg-surface-muted"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
