"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getButtonClassName } from "@/components/Button";
import { EMPLOYER_CTA_ITEM } from "@/constants/navigation";

/**
 * Matches PrimaryNav.tsx's own plain nav-link styling exactly (same
 * className, duplicated rather than shared to avoid touching that
 * component for a one-line style string) — this is what "Post a Job"
 * should look like everywhere except the actual employer area, per the
 * explicit instruction to reuse established normal-link styling rather
 * than a bordered/outlined button.
 */
const NORMAL_LINK_CLASSNAME =
  "relative py-1 text-sm font-medium text-muted-foreground transition-colors after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:origin-left after:scale-x-0 after:rounded-full after:bg-brand-600 after:transition-transform after:duration-200 hover:text-foreground hover:after:scale-x-100";

/**
 * The header's "Post a Job" CTA. Solid primary-button styling only
 * while the visitor is actually within the employer area (/employer and
 * its sub-pages); a plain nav link — no fill, no border — everywhere
 * else, including the homepage.
 *
 * Needs usePathname() (client-only), so this one interactive bit is
 * split out of the otherwise fully server-rendered Header rather than
 * converting the whole header to a client component.
 */
export function EmployerCtaLink() {
  const pathname = usePathname();
  const isActive = pathname === EMPLOYER_CTA_ITEM.href || pathname.startsWith(`${EMPLOYER_CTA_ITEM.href}/`);

  return (
    <Link
      href={EMPLOYER_CTA_ITEM.href}
      aria-current={isActive ? "page" : undefined}
      className={isActive ? getButtonClassName({ variant: "primary", size: "sm" }) : NORMAL_LINK_CLASSNAME}
    >
      {EMPLOYER_CTA_ITEM.label}
    </Link>
  );
}
