export type NavItem = {
  label: string;
  href: string;
};

export type FooterLinkGroup = {
  title: string;
  links: NavItem[];
};

/**
 * Site-wide navigation structure. Several of these routes don't exist yet
 * (e.g. /jobs, /about) — they name the intended information
 * architecture per docs/04-routing-and-url-strategy.md and will resolve
 * as those pages are built, rather than being wired to placeholder pages.
 */
export const PRIMARY_NAV_ITEMS: NavItem[] = [
  { label: "Find Jobs", href: "/jobs" },
  { label: "About", href: "/about" },
];

/**
 * Rendered as a distinct, styled call-to-action in the header rather
 * than a plain nav link. Points at the protected employer dashboard
 * entry point — an unauthenticated visitor is redirected to sign in
 * first (see src/app/(dashboard)/layout.tsx), not a dead page.
 */
export const EMPLOYER_CTA_ITEM: NavItem = { label: "Post a Job", href: "/employer" };

export const FOOTER_LINK_GROUPS: FooterLinkGroup[] = [
  {
    title: "For Candidates",
    links: [
      { label: "Find Jobs", href: "/jobs" },
      { label: "Create a Profile", href: "/sign-up" },
    ],
  },
  {
    title: "For Employers",
    links: [{ label: "Post a Job", href: "/employer" }],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
    ],
  },
];
