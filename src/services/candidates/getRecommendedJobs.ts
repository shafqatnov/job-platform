import { prisma } from "@/lib/prisma";
import { getPublicJobs } from "@/services/jobs/getPublicJobs";
import type { JobListItem } from "@/features/jobs/types";

const RECOMMENDED_JOBS_LIMIT = 6;

/**
 * Deterministic, non-AI recommendations for the candidate dashboard —
 * reuses getPublicJobs() (the one place allowed to query Job for a
 * public listing), never a parallel job-fetching system, and applies no
 * runtime classification of its own.
 *
 * Uses only real, already-available profile data: CandidateProfile has
 * no stored category/skill preference today (confirmed against
 * prisma/schema.prisma — only country/city), so category-based
 * recommendation is gracefully omitted rather than guessed or invented.
 * Country is the one real preference signal available, so recommended
 * jobs are simply "other public jobs in the candidate's own country."
 *
 * Excludes jobs the candidate has already saved or applied to, so a
 * recommendation always points at something genuinely new to them.
 */
export async function getRecommendedJobsForCandidate(
  candidateProfileId: string,
  countryUrlSlug: string
): Promise<JobListItem[]> {
  const [countryJobs, savedRows, appliedRows] = await Promise.all([
    getPublicJobs({ countryUrlSlug }),
    prisma.savedJob.findMany({ where: { candidateProfileId }, select: { jobId: true } }),
    prisma.application.findMany({ where: { candidateProfileId, deletedAt: null }, select: { jobId: true } }),
  ]);

  const excludedJobIds = new Set([...savedRows.map((row) => row.jobId), ...appliedRows.map((row) => row.jobId)]);

  return countryJobs.filter((job) => !excludedJobIds.has(job.id)).slice(0, RECOMMENDED_JOBS_LIMIT);
}
