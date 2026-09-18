import { prisma } from "@/lib/prisma";
import type { ApplicationMethod, JobSource, JobStatus } from "@/generated/prisma/enums";

export type AdminJobDetail = {
  id: string;
  title: string;
  description: string;
  slug: string;
  source: JobSource;
  companyName: string;
  countryName: string;
  countrySlug: string;
  cityName: string;
  categoryName: string;
  salaryMin?: number;
  salaryMax?: number;
  currencyCode?: string;
  applicationMethod: ApplicationMethod;
  externalApplicationUrl?: string;
  status: JobStatus;
  rejectionReason?: string;
  createdAt: string;
  employerName: string;
  employerEmail: string;
};

/**
 * Reads one job with everything an admin needs to make an approve/reject
 * decision (see /admin/jobs/[id]). Never used for the public detail page
 * — that stays getPublicJobBySlug, which enforces publish-visibility
 * rules this function deliberately does not (an admin must be able to
 * see a pending_review or rejected job too).
 */
export async function getJobForAdmin(jobId: string): Promise<AdminJobDetail | null> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      title: true,
      description: true,
      slug: true,
      source: true,
      status: true,
      rejectionReason: true,
      applicationMethod: true,
      externalApplicationUrl: true,
      salaryMin: true,
      salaryMax: true,
      currencyCode: true,
      createdAt: true,
      deletedAt: true,
      company: { select: { name: true } },
      country: { select: { name: true, urlSlug: true } },
      city: { select: { name: true } },
      category: { select: { name: true } },
      postedBy: { select: { name: true, email: true } },
    },
  });

  if (!job || job.deletedAt) {
    return null;
  }

  return {
    id: job.id,
    title: job.title,
    description: job.description,
    slug: job.slug,
    source: job.source,
    companyName: job.company.name,
    countryName: job.country.name,
    countrySlug: job.country.urlSlug,
    cityName: job.city.name,
    categoryName: job.category.name,
    salaryMin: job.salaryMin ?? undefined,
    salaryMax: job.salaryMax ?? undefined,
    currencyCode: job.currencyCode ?? undefined,
    applicationMethod: job.applicationMethod,
    externalApplicationUrl: job.externalApplicationUrl ?? undefined,
    status: job.status,
    rejectionReason: job.rejectionReason ?? undefined,
    createdAt: job.createdAt.toISOString(),
    employerName: job.postedBy.name,
    employerEmail: job.postedBy.email,
  };
}
