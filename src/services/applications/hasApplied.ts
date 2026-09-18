import { prisma } from "@/lib/prisma";

/**
 * Whether this candidate already has a live application on this job —
 * used to render the correct Apply-button state on the job detail page
 * and as a defense-in-depth check before creating a new one (the
 * `@@unique([jobId, candidateProfileId])` constraint is the actual
 * backstop against a race; this is the friendly pre-check).
 */
export async function hasApplied(candidateProfileId: string, jobId: string): Promise<boolean> {
  const existing = await prisma.application.findFirst({
    where: { candidateProfileId, jobId, deletedAt: null },
    select: { id: true },
  });
  return existing !== null;
}
