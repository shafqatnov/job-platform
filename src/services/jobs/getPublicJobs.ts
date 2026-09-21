import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { JobListItem } from "@/features/jobs/types";
import { publicJobVisibilityWhere } from "@/services/jobs/publicJobVisibility";
import { findAdzunaSourceId } from "@/services/jobs/adzunaAttribution";

export type GetPublicJobsOptions = {
  /** Restrict results to one country by its public URL slug (e.g. "uk"), not its ISO code. */
  countryUrlSlug?: string;
  /** Restrict results to one category by its slug (see src/constants/categories.ts). */
  categorySlug?: string;
  /** Case-insensitive substring match against title or description. */
  keywords?: string;
  /** Restrict results to one company by its real Company.id — used by the company profile page's "open jobs" list. */
  companyId?: string;
};

const PUBLIC_JOBS_PAGE_SIZE = 24;

/**
 * Reads the currently publishable jobs for the public jobs listing.
 *
 * "Publishable" means status = active AND not past its expiry date, per
 * docs/18-job-lifecycle.md. Status alone isn't enough: the automated
 * active -> expired transition (src/services/jobs/expireJobs.ts) runs on
 * its own schedule, not synchronously with this read, so a row can
 * still briefly read status = active after its expiresAt has passed —
 * the expiresAt check here stays as a defensive backstop against that
 * window, not a substitute for the transition itself.
 *
 * Also excludes the confirmed disposable test-fixture markers via the
 * shared publicJobVisibilityWhere() rule (see publicJobVisibility.ts) —
 * an exact title-prefix match only, never a "test"/"qa" keyword filter,
 * so legitimate titles like "QA Test Engineer" or "Test Inspector" are
 * never affected.
 *
 * This is the only place allowed to query Job for the public listing —
 * callers (src/features/jobs, the company profile page) must go through
 * this function, never import src/lib/prisma directly. Supports an
 * optional country scope, category scope, company scope (companyId —
 * added for the company profile page's "open jobs" list; the company's
 * own real Company.id, never a client-supplied/guessed value), and
 * keyword search (title/description substring, case-insensitive) — no
 * other filter exists because no other filterable field exists on Job
 * today (there is no workMode/employmentType column in
 * prisma/schema.prisma; JobFiltersBar's corresponding selects submit
 * their values but are not applied here, since adding those would
 * require a schema change out of scope for this read path). Errors are
 * intentionally not caught here: a genuine database failure must
 * propagate to the route's error boundary, not be silently presented as
 * "no jobs."
 */
export async function getPublicJobs(options: GetPublicJobsOptions = {}): Promise<JobListItem[]> {
  const keywords = options.keywords?.trim();

  // One cheap, indexed lookup per call (never per job) — see
  // adzunaAttribution.ts. Resolves to null when no Adzuna source row
  // exists yet, in which case isAdzunaSourced is simply false for every
  // job below.
  const adzunaSourceId = await findAdzunaSourceId();

  const jobs = await prisma.job.findMany({
    where: {
      // The one centralized "is this Job publicly visible" rule (see
      // publicJobVisibility.ts) is nested as its own AND-array entry —
      // rather than spread at the top level — specifically so it can
      // never collide with this function's own top-level `OR` key below
      // (a plain object literal keeps only the last `OR`; each
      // independent OR-condition needs its own array entry instead).
      AND: [
        publicJobVisibilityWhere(),
        ...(keywords
          ? [
              {
                OR: [
                  { title: { contains: keywords, mode: "insensitive" as const } },
                  { description: { contains: keywords, mode: "insensitive" as const } },
                ],
              },
            ]
          : []),
      ],
      ...(options.countryUrlSlug ? { country: { urlSlug: options.countryUrlSlug } } : {}),
      ...(options.categorySlug ? { category: { slug: options.categorySlug } } : {}),
      ...(options.companyId ? { companyId: options.companyId } : {}),
    },
    select: {
      id: true,
      slug: true,
      title: true,
      salaryMin: true,
      salaryMax: true,
      currencyCode: true,
      postedAt: true,
      createdAt: true,
      importedSourceId: true,
      company: { select: { name: true, slug: true } },
      country: { select: { isoCode: true, urlSlug: true, name: true } },
      city: { select: { name: true } },
    },
    orderBy: [{ postedAt: "desc" }, { id: "desc" }],
    take: PUBLIC_JOBS_PAGE_SIZE,
  });

  return jobs.map(
    (job): JobListItem => ({
      id: job.id,
      slug: job.slug,
      title: job.title,
      companyName: job.company.name,
      companySlug: job.company.slug,
      countryCode: job.country.isoCode,
      countrySlug: job.country.urlSlug,
      countryName: job.country.name,
      city: job.city.name,
      salaryMin: job.salaryMin ?? undefined,
      salaryMax: job.salaryMax ?? undefined,
      currencyCode: job.currencyCode ?? undefined,
      // postedAt is nullable in the schema, but is set whenever a job
      // becomes active (docs/18); createdAt is a real, always-present
      // timestamp on the same row used only as a defensive fallback —
      // never a fabricated value.
      postedAt: (job.postedAt ?? job.createdAt).toISOString(),
      isAdzunaSourced: adzunaSourceId !== null && job.importedSourceId === adzunaSourceId,
    })
  );
}

/**
 * Lightweight existence check — true only if this country currently has
 * at least one publicly visible job, using the exact same
 * publicJobVisibilityWhere() rule as getPublicJobs() itself (never a
 * separate/looser rule). Used by [country]/jobs/page.tsx's
 * generateMetadata() to decide whether to emit a conditional noindex —
 * deliberately NOT the same as calling getPublicJobs({ countryUrlSlug })
 * and checking .length, which would fetch up to PUBLIC_JOBS_PAGE_SIZE
 * full job records just to answer a true/false question; findFirst here
 * is a single indexed lookup that stops at the first match.
 *
 * Wrapped in React's cache() — same pattern as getSessionUser.ts's own
 * doc comment explains — so if Next.js's generateMetadata/page-rendering
 * lifecycle happens to need this same country's answer more than once
 * within one request, only one query actually runs. Evaluated fresh
 * every request (no build-time or otherwise-cached result persists
 * across requests): a country automatically becomes eligible again the
 * instant it has its first real job, and automatically reverts if it
 * later has none, with no manual/hardcoded list involved.
 */
export const hasPublicJobsInCountry = cache(async (countryUrlSlug: string): Promise<boolean> => {
  const job = await prisma.job.findFirst({
    where: { AND: [publicJobVisibilityWhere(), { country: { urlSlug: countryUrlSlug } }] },
    select: { id: true },
  });
  return job !== null;
});
