"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getButtonClassName } from "@/components/Button";
import { EMPLOYER_CTA_ITEM } from "@/constants/navigation";

/**
 * The header's "Post a Job" CTA. Previously always rendered with the
 * solid "primary" button style regardless of the current page — which
 * made it look permanently highlighted/active, including on the
 * homepage. Now solid only while the visitor is actually within the
 * employer area (/employer and its sub-pages), and a plain outline link
 * everywhere else, matching how a genuine "current page" nav indicator
 * should behave.
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
      className={getButtonClassName({ variant: isActive ? "primary" : "outline", size: "sm" })}
    >
      {EMPLOYER_CTA_ITEM.label}
    </Link>
  );
}
