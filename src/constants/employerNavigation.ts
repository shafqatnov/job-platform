import type { NavItem } from "@/constants/navigation";

/**
 * Employer Portal 2.0's own persistent sub-navigation, shown on every
 * page under /employer (see EmployerNav.tsx, wired in via
 * src/app/(dashboard)/employer/layout.tsx) — mirrors
 * src/constants/candidateNavigation.ts's own role in Candidate Portal
 * 2.0 exactly, so the employer side reads as one consistent workspace.
 *
 * "Hiring Pipeline" has a real destination here even though there is no
 * multi-stage application pipeline anywhere in this codebase yet (see
 * src/constants/applicationStatus.ts's own doc comment: only the single
 * "received" status exists) — an honest, static placeholder rather than
 * a dead/missing nav entry, so it becomes a real feature later without a
 * URL or navigation change.
 */
export const EMPLOYER_NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/employer" },
  { label: "Company Profile", href: "/employer/company/edit" },
  { label: "Active Jobs", href: "/employer/jobs/active" },
  { label: "Pending Jobs", href: "/employer/jobs/pending" },
  { label: "Applications", href: "/employer/applications" },
  { label: "Analytics", href: "/employer/analytics" },
  { label: "Job Performance", href: "/employer/performance" },
  { label: "Hiring Pipeline", href: "/employer/pipeline" },
];
