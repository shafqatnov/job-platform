import type { NavItem } from "@/constants/navigation";

/**
 * The candidate portal's own persistent sub-navigation, shown on every
 * page under /candidate (see CandidateNav.tsx, wired in via
 * src/app/(dashboard)/candidate/layout.tsx) so the whole area reads as
 * one consistent dashboard rather than a set of disconnected pages.
 *
 * "Job Alerts" and "Recently Viewed" have real destinations here even
 * though neither has real underlying functionality yet (see their own
 * pages) — each is an honest, static placeholder rather than a
 * dead/missing nav entry, and turns into a real feature later without
 * a URL or navigation change.
 */
export const CANDIDATE_NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/candidate" },
  { label: "Saved Jobs", href: "/candidate/saved-jobs" },
  { label: "Applications", href: "/candidate/applications" },
  { label: "Profile", href: "/candidate/profile" },
  { label: "Resume", href: "/candidate/resume" },
  { label: "Recommended Jobs", href: "/candidate/recommended" },
  { label: "Job Alerts", href: "/candidate/alerts" },
  { label: "Recently Viewed", href: "/candidate/recently-viewed" },
];
