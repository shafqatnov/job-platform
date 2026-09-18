import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { getCandidateProfile } from "@/services/candidates/getCandidateProfile";

export type SaveJobResult = { success: true } | { success: false; error: string };

/**
 * Saves one job as a bookmark for the authenticated candidate. This is
 * the ONLY place allowed to write a SavedJob row — UI/Server Actions
 * must call this, never Prisma directly, mirroring
 * src/services/applications/applyToJob.ts's own role for Application.
 *
 * The candidate's own profile is derived server-side from their session
 * (never a client-supplied candidateProfileId). The target job is
 * independently re-verified against the same public-visibility rule as
 * getPublicJobs.ts (status = active, not soft-deleted, not past expiry)
 * regardless of what the calling page already checked — a job's state
 * can change between page load and the save click.
 *
 * Duplicate saves are treated as an idempotent success (not an error):
 * the schema's `@@unique([candidateProfileId, jobId])` constraint
 * (caught as P2002) is the race-safe backstop, exactly like
 * applyToJob's own P2002 handling — the difference is what happens
 * after: applying twice is a real error to surface ("you already
 * applied"), but saving twice is not a mistake worth reporting to the
 * user, it's just already done.
 */
export async function saveJob(userId: string, jobId: string): Promise<SaveJobResult> {
  const candidateProfile = await getCandidateProfile(userId);
  if (!candidateProfile) {
    return { success: false, error: "Create your candidate profile before saving jobs." };
  }

  const job = await prisma.job.findFirst({
    where: {
      id: jobId,
      status: "active",
      deletedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: { id: true },
  });
  if (!job) {
    return { success: false, error: "This job is no longer available to save." };
  }

  try {
    await prisma.savedJob.create({
      data: { candidateProfileId: candidateProfile.id, jobId: job.id },
    });
    return { success: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { success: true };
    }
    console.error("saveJob failed", error);
    return { success: false, error: "We couldn't save this job right now. Please try again." };
  }
}
