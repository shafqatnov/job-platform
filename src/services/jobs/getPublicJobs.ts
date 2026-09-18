import { prisma } from "@/lib/prisma";
import type { JobListItem } from "@/features/jobs/types";

export type GetPublicJobsOptions = {
  /** Restrict results to one country by its public URL slug (e.g. "uk"), not its ISO code. */
  countryUrlSlug?: string;
  /** Restrict results to one category by its slug (see src/constants/categories.ts). */
  categorySlug?: string;
  /** Case-insensitive substring match against title or description. */
  keywords?: string;
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
 * This is the only place allowed to query Job for the public listing —
 * callers (src/features/jobs) must go through this function, never
 * import src/lib/prisma directly. Supports an optional country scope,
 * category scope, and keyword search (title/description substring,
 * case-insensitive) — no other filter exists because no other filterable
 * field exists on Job today (there is no workMode/employmentType column
 * in prisma/schema.prisma; JobFiltersBar's corresponding selects submit
 * their values but are not applied here, since adding those would
 * require a schema change out of scope for this read path). Errors are
 * intentionally not caught here: a genuine database failure must
 * propagate to the route's error boundary, not be silently presented as
 * "no jobs."
 */
export async function getPublicJobs(options: GetPublicJobsOptions = {}): Promise<JobListItem[]> {
  const keywords = options.keywords?.trim();

  const jobs = await prisma.job.findMany({
    where: {
      status: "active",
      deletedAt: null,
      // Combined via AND rather than a second top-level OR key, which
      // would silently overwrite the expiry check above it (a plain
      // object literal keeps only the last `OR`) — each independent
      // OR-condition gets its own array entry instead.
      AND: [
        { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
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
