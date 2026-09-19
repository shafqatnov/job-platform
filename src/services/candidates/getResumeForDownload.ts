import { prisma } from "@/lib/prisma";
import { getCandidateProfile } from "@/services/candidates/getCandidateProfile";
import { vercelBlobProvider, type BlobProvider } from "@/services/storage/blobProvider";

export type ResumeDownloadResult =
  | { found: true; stream: ReadableStream<Uint8Array>; contentType: string }
  | { found: false };

/**
 * Reads the authenticated candidate's OWN resume content for the secure
 * download/view route (src/app/api/candidate/resume/download/route.ts).
 * There is no candidateProfileId (or any other id) parameter anywhere in
 * this function's signature — ownership is derived entirely from the
 * session-provided userId, so there is nothing here a client could
 * override to read another candidate's file.
 */
export async function getResumeForDownload(
  userId: string,
  provider: BlobProvider = vercelBlobProvider
): Promise<ResumeDownloadResult> {
  const profile = await getCandidateProfile(userId);
  if (!profile) {
    return { found: false };
  }

  const record = await prisma.candidateProfile.findUnique({
    where: { id: profile.id },
    select: { resumeFileUrl: true },
  });
  if (!record?.resumeFileUrl) {
    return { found: false };
  }

  const object = await provider.getObject(record.resumeFileUrl);
  if (!object) {
    return { found: false };
  }

  return { found: true, stream: object.stream, contentType: object.contentType };
}
