import { prisma } from "@/lib/prisma";

export type EmployerJobDetail = {
  id: string;
  title: string;
};

/**
 * Reads one job for the employer's own management views, scoped to a
 * specific companyId in the query itself — a job belonging to a
 * different company simply isn't found (null), rather than being
 * fetched and compared after the fact. This is the ownership check,
 * not just a lookup; callers must never skip passing the real
 * companyId derived from the session.
 */
export async function getEmployerJobDetail(jobId: string, companyId: string): Promise<EmployerJobDetail | null> {
  const job = await prisma.job.findFirst({
    where: { id: jobId, companyId, deletedAt: null },
    select: { id: true, title: true },
  });

  return job;
}
