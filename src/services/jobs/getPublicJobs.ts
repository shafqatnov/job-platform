import { prisma } from "@/lib/prisma";
import type { JobListItem } from "@/features/jobs/types";

export type GetPublicJobsOptions = {
  /** Restrict results to one country by its public URL slug (e.g. "uk"), not its ISO code. */
  countryUrlSlug?: string;
};

const PUBLIC_JOBS_PAGE_SIZE = 24;

/**
 * Reads the currently publishable jobs for the public jobs listing.
 *
 * "Publishable" means status = active AND not past its expiry date, per
 * docs/18-job-lifecycle.md. Status alone isn't enough: the automated
 * active -> expired transition (docs/09-automation-architecture.md)
 * doesn't exist yet, so a row can still read status = active after its
 * expiresAt has passed — the expiresAt check here enforces the
 * documented lifecycle intent defensively until that worker exists.
 *
 * This is the only place allowed to query Job for the public listing —
 * callers (src/features/jobs) must go through this function, never
 * import src/lib/prisma directly. No search/filter parameters beyond an
 * optional country scope are implemented here; that's out of scope for
 * this read path. Errors are intentionally not caught here: a genuine
 * database failure must propagate to the route's error boundary, not be
 * silently presented as "no jobs."
 */
export async function getPublicJobs(options: GetPublicJobsOptions = {}): Promise<JobListItem[]> {
  const jobs = await prisma.job.findMany({
    where: {
      status: "active",
      deletedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      ...(options.countryUrlSlug ? { country: { urlSlug: options.countryUrlSlug } } : {}),
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
      company: { select: { name: true } },
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
    })
  );
}
