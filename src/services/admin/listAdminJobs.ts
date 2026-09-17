import { prisma } from "@/lib/prisma";
import type { JobStatus } from "@/generated/prisma/enums";

export type AdminJobRow = {
  id: string;
  title: string;
  companyName: string;
  countryName: string;
  cityName: string;
  categoryName: string;
  createdAt: string;
  employerName: string;
  employerEmail: string;
  status: JobStatus;
};

export type ListAdminJobsOptions = {
  /** Omit to list every status (the /admin/jobs overview). */
  status?: JobStatus;
};

/**
 * Reads jobs for the admin surface — every status, not just publicly
 * visible ones, since this is the moderation/management view. This is
 * the only place allowed to query Job for /admin/jobs* pages; it is a
 * deliberately separate query from getPublicJobs (public visibility
 * rules) and getEmployerJobs (one employer's own company), since each
 * surface has genuinely different scope.
 *
 * Pending jobs are ordered oldest-first (FIFO queue, so nothing waits
 * indefinitely); every other view is newest-first.
 */
export async function listAdminJobs(options: ListAdminJobsOptions = {}): Promise<AdminJobRow[]> {
  const jobs = await prisma.job.findMany({
    where: {
      deletedAt: null,
      ...(options.status ? { status: options.status } : {}),
    },
    select: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
      company: { select: { name: true } },
      country: { select: { name: true } },
      city: { select: { name: true } },
      category: { select: { name: true } },
      postedBy: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: options.status === "pending_review" ? "asc" : "desc" },
  });

  return jobs.map((job) => ({
    id: job.id,
    title: job.title,
    companyName: job.company.name,
    countryName: job.country.name,
    cityName: job.city.name,
    categoryName: job.category.name,
    createdAt: job.createdAt.toISOString(),
    employerName: job.postedBy.name,
    employerEmail: job.postedBy.email,
    status: job.status,
  }));
}
