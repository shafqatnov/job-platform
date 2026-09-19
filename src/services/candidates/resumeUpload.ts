import { prisma } from "@/lib/prisma";
import { getCandidateProfile } from "@/services/candidates/getCandidateProfile";
import { RESUME_PATHNAME } from "@/services/candidates/resumeUploadConstants";
import { vercelBlobProvider, type BlobProvider } from "@/services/storage/blobProvider";

export type AuthorizeResumeUploadResult =
  | { ok: true; candidateProfileId: string }
  | { ok: false; error: string };

/**
 * Authorization gate for the resume-upload route's
 * `onBeforeGenerateToken` callback (src/app/api/candidate/resume/upload/route.ts).
 * Re-derives the candidate's own profile from the session-provided
 * userId — never trusts anything the browser sends. The requested
 * pathname must be exactly the one fixed constant this app's own
 * upload component ever sends; rejecting anything else closes off a
 * crafted request naming an arbitrary path.
 */
export async function authorizeResumeUpload(userId: string, pathname: string): Promise<AuthorizeResumeUploadResult> {
  if (pathname !== RESUME_PATHNAME) {
    return { ok: false, error: "Invalid upload target." };
  }

  const profile = await getCandidateProfile(userId);
  if (!profile) {
    return { ok: false, error: "Create your candidate profile before uploading a resume." };
  }

  return { ok: true, candidateProfileId: profile.id };
}

/**
 * Commits a newly-uploaded resume. Only ever called from the upload
 * route's `onUploadCompleted` callback, whose `tokenPayload` carries the
 * candidateProfileId that authorizeResumeUpload derived server-side —
 * never a client-supplied id (see route.ts for how that payload is
 * produced and why it can't be tampered with by the browser).
 *
 * Deletes the previous resume's blob object only AFTER the DB write
 * commits, so a mid-failure never leaves the DB pointing at a deleted
 * file — the worst case is a harmless orphaned blob, not a broken
 * reference.
 */
export async function commitResumeUpload(
  candidateProfileId: string,
  newUrl: string,
  provider: BlobProvider = vercelBlobProvider
): Promise<void> {
  const previous = await prisma.candidateProfile.findUnique({
    where: { id: candidateProfileId },
    select: { resumeFileUrl: true },
  });

  await prisma.candidateProfile.update({
    where: { id: candidateProfileId },
    data: { resumeFileUrl: newUrl },
  });

  if (previous?.resumeFileUrl && previous.resumeFileUrl !== newUrl) {
    try {
      await provider.deleteObject(previous.resumeFileUrl);
    } catch (error) {
      // Never log the URL itself (it grants access to a private file) —
      // only that cleanup failed. The DB already points at the new
      // resume, so this is a harmless storage-cost leak, not a broken
      // reference.
      console.error("Failed to delete replaced resume blob for candidate", candidateProfileId, error);
    }
  }
}
