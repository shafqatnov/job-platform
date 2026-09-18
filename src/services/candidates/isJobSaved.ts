import { prisma } from "@/lib/prisma";

/**
 * Whether this candidate has already saved this job — used to render
 * the correct Save/Unsave button state on the job detail page, mirrors
 * src/services/applications/hasApplied.ts exactly.
 */
export async function isJobSaved(candidateProfileId: string, jobId: string): Promise<boolean> {
  const existing = await prisma.savedJob.findFirst({
    where: { candidateProfileId, jobId },
    select: { id: true },
  });
  return existing !== null;
}
