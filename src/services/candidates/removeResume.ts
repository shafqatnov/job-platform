import { prisma } from "@/lib/prisma";
import { getCandidateProfile } from "@/services/candidates/getCandidateProfile";
import { vercelBlobProvider, type BlobProvider } from "@/services/storage/blobProvider";

export type RemoveResumeResult = { success: true } | { success: false; error: string };

/**
 * Removes the authenticated candidate's own resume. Mirrors
 * unsaveJob.ts's idempotent style: removing a resume that isn't there
 * is not an error. The DB is cleared to null FIRST (this is the field
 * the rest of the app trusts), then the underlying blob is deleted on a
 * best-effort basis — a failed blob delete here leaves a harmless
 * orphaned object, never a broken reference, since resumeFileUrl is
 * already null by the time it could fail.
 */
export async function removeResume(userId: string, provider: BlobProvider = vercelBlobProvider): Promise<RemoveResumeResult> {
  const profile = await getCandidateProfile(userId);
  if (!profile) {
    return { success: false, error: "Create your candidate profile first." };
  }

  const record = await prisma.candidateProfile.findUnique({
    where: { id: profile.id },
    select: { resumeFileUrl: true },
  });

  if (!record?.resumeFileUrl) {
    return { success: true };
  }

  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { resumeFileUrl: null },
  });

  try {
    await provider.deleteObject(record.resumeFileUrl);
  } catch (error) {
    console.error("Failed to delete removed resume blob for candidate", profile.id, error);
  }

  return { success: true };
}
