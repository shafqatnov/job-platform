import { prisma } from "@/lib/prisma";

export type CandidateProfileSummary = {
  id: string;
  fullName: string;
};

/**
 * Reads the authenticated candidate's own profile, derived from
 * CandidateProfile.userId — never from a client-supplied
 * candidateProfileId. Mirrors src/services/employers/getEmployerCompany.ts.
 *
 * Returns null when the signed-in candidate hasn't created a profile
 * yet — callers (the job-detail apply flow, the apply service) must
 * send them to create one first rather than assuming it exists.
 */
export async function getCandidateProfile(userId: string): Promise<CandidateProfileSummary | null> {
  const profile = await prisma.candidateProfile.findUnique({
    where: { userId },
    select: { id: true, fullName: true },
  });

  return profile;
}
