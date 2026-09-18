import { prisma } from "@/lib/prisma";
import { getCandidateProfile } from "@/services/candidates/getCandidateProfile";

export type UnsaveJobResult = { success: true } | { success: false; error: string };

/**
 * Removes one job bookmark for the authenticated candidate. Uses
 * deleteMany (not delete) scoped to the candidate's own
 * candidateProfileId, so this can never remove anyone else's saved job,
 * and correctly no-ops (still success) when the row is already absent
 * — unsaving something not saved is not an error.
 */
export async function unsaveJob(userId: string, jobId: string): Promise<UnsaveJobResult> {
  const candidateProfile = await getCandidateProfile(userId);
  if (!candidateProfile) {
    return { success: false, error: "Create your candidate profile first." };
  }

  await prisma.savedJob.deleteMany({
    where: { candidateProfileId: candidateProfile.id, jobId },
  });

  return { success: true };
}
