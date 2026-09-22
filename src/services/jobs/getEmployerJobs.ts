import { prisma } from "@/lib/prisma";
import type { JobStatus } from "@/generated/prisma/enums";

export type EmployerJobRow = {
  id: string;
  title: string;
  status: JobStatus;
  rejectionReason?: string;
  createdAt: string;
  countrySlug: string;
  slug: string;
  applicationCount: number;
  /**
   * How many candidates currently have this job bookmarked — added for
   * Employer Portal 2.0's Analytics/Job Performance views. Additive: the
   * existing dashboard usage (which never read this field) is
   * unaffected, and it costs nothing extra to compute since it's the
   * same _count selection Prisma already builds for applicationCount.
   */
  savedJobCount: number;
};

/**
 * Reads the authenticated employer's own company's real jobs — every
 * lifecycle status, since this is the employer's own management view,
 * not the public listing (which only ever shows `active`, see
 * src/services/jobs/getPublicJobs.ts — a deliberately separate query,
 * not reused here, since the visibility rules are genuinely different).
 * Scoped by companyId (not just postedByUserId) since the company, not
 * the individual poster, is what an employer manages (docs/26 §11).
 *
 * `status` optionally narrows to one or more lifecycle states (Employer
 * Portal 2.0's Active Jobs / Pending Jobs pages) — omitted, the default,
 * preserves the exact original "every status" behavior the dashboard and
 * Job Performance page both still rely on.
 */
export async function getEmployerJobs(companyId: string, status?: JobStatus | JobStatus[]): Promise<EmployerJobRow[]> {
  const jobs = await prisma.job.findMany({
    where: {
      companyId,
      deletedAt: null,
      ...(status ? { status: Array.isArray(status) ? { in: status } : status } : {}),
    },
    select: {
      id: true,
      title: true,
      status: true,
      rejectionReason: true,
      createdAt: true,
      slug: true,
      country: { select: { urlSlug: true } },
      _count: { select: { applications: { where: { deletedAt: null } }, savedBy: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return jobs.map((job) => ({
    id: job.id,
    title: job.title,
    status: job.status,
    rejectionReason: job.rejectionReason ?? undefined,
    createdAt: job.createdAt.toISOString(),
    countrySlug: job.country.urlSlug,
    slug: job.slug,
    applicationCount: job._count.applications,
    savedJobCount: job._count.savedBy,
  }));
}
