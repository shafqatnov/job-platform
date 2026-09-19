import { prisma } from "@/lib/prisma";
import type { ApplicationMethod, JobStatus } from "@/generated/prisma/enums";

export type EmployerJobManageDetail = {
  id: string;
  title: string;
  description: string;
  companyName: string;
  status: JobStatus;
  countrySlug: string;
  citySlug: string;
  categorySlug: string;
  salaryMin?: number;
  salaryMax?: number;
  currencyCode?: string;
  applicationMethod: ApplicationMethod;
  externalApplicationUrl?: string;
  expiresAt: string | null;
  closedAt: string | null;
  createdAt: string;
  applicationCount: number;
  savedJobCount: number;
};

/**
 * Reads one job for the employer's own lifecycle-management page
 * (/employer/jobs/[id]) — everything the Edit/Close/Reopen/Delete
 * controls need to decide which actions are safe to show, plus the
 * fields the edit form needs to pre-fill. Scoped to a specific
 * companyId in the query itself (the ownership check, not a lookup
 * followed by a comparison), mirroring getEmployerJobDetail.ts exactly.
 * A separate function from getEmployerJobDetail rather than extending
 * it, so its existing single consumer (the applications page) is never
 * put at risk by this task's changes.
 */
export async function getEmployerJobForManage(
  jobId: string,
  companyId: string
): Promise<EmployerJobManageDetail | null> {
  const job = await prisma.job.findFirst({
    where: { id: jobId, companyId, deletedAt: null },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      applicationMethod: true,
      externalApplicationUrl: true,
      salaryMin: true,
      salaryMax: true,
      currencyCode: true,
      expiresAt: true,
      closedAt: true,
      createdAt: true,
      company: { select: { name: true } },
      country: { select: { urlSlug: true } },
      city: { select: { slug: true } },
      category: { select: { slug: true } },
      _count: {
        select: {
          applications: { where: { deletedAt: null } },
          savedBy: true,
        },
      },
    },
  });

  if (!job) {
    return null;
  }

  return {
    id: job.id,
    title: job.title,
    description: job.description,
    companyName: job.company.name,
    status: job.status,
    countrySlug: job.country.urlSlug,
    citySlug: job.city.slug,
    categorySlug: job.category.slug,
    salaryMin: job.salaryMin ?? undefined,
    salaryMax: job.salaryMax ?? undefined,
    currencyCode: job.currencyCode ?? undefined,
    applicationMethod: job.applicationMethod,
    externalApplicationUrl: job.externalApplicationUrl ?? undefined,
    expiresAt: job.expiresAt ? job.expiresAt.toISOString() : null,
    closedAt: job.closedAt ? job.closedAt.toISOString() : null,
    createdAt: job.createdAt.toISOString(),
    applicationCount: job._count.applications,
    savedJobCount: job._count.savedBy,
  };
}
