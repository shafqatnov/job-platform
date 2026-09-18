import { prisma } from "@/lib/prisma";
import type { JobListItem } from "@/features/jobs/types";

/**
 * Reads the candidate's saved jobs for their "Saved Jobs" page. Applies
 * the exact same public-visibility rule as
 * src/services/jobs/getPublicJobs.ts (status = active, not soft-deleted,
 * not past expiry) on the JOINED job, not just the SavedJob row itself
 * — a job that has since expired, been closed/rejected, or been
 * deleted simply drops out of this list rather than ever being
 * returned, per this feature's own visibility requirement.
 */
export async function getSavedJobs(candidateProfileId: string): Promise<JobListItem[]> {
  const savedJobs = await prisma.savedJob.findMany({
    where: {
      candidateProfileId,
      job: {
        status: "active",
        deletedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    },
    select: {
      createdAt: true,
      job: {
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
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return savedJobs.map(
    ({ job }): JobListItem => ({
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
      postedAt: (job.postedAt ?? job.createdAt).toISOString(),
    })
  );
}

/**
 * Batched "which of these job IDs has this candidate already saved"
 * check — used by job listing pages to render each JobCard's Save
 * button state without an N+1 query (one call for the whole page, not
 * one per card).
 */
export async function getSavedJobIdSet(candidateProfileId: string, jobIds: string[]): Promise<Set<string>> {
  if (jobIds.length === 0) {
    return new Set();
  }
  const rows = await prisma.savedJob.findMany({
    where: { candidateProfileId, jobId: { in: jobIds } },
    select: { jobId: true },
  });
  return new Set(rows.map((row) => row.jobId));
}
