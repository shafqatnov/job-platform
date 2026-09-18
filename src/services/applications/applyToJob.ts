import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { getCandidateProfile } from "@/services/candidates/getCandidateProfile";

export type ApplyToJobInput = {
  /** Must come from the authenticated session — never client-supplied. */
  userId: string;
  jobId: string;
  /** Optional — Application.coverNote is nullable. */
  coverNote?: string;
};

export type ApplyToJobResult =
  | { success: true; applicationId: string }
  | { success: false; error: string };

// Shorter than createJob.ts's MAX_DESCRIPTION_LENGTH (10000) — a cover
// note is a brief note, not a full document.
const MAX_COVER_NOTE_LENGTH = 2000;

/**
 * Creates one on-platform application on behalf of the authenticated
 * candidate. This is the ONLY place allowed to write an Application row
 * — UI/Server Actions must call this, never Prisma directly.
 *
 * The candidate's own profile is derived server-side from their session
 * (never a client-supplied candidateProfileId). The target job is
 * independently re-verified against the same eligibility rule as the
 * public read path (status = active, not soft-deleted, not past
 * expiry — mirrors src/services/jobs/getPublicJobBySlug.ts) plus
 * applicationMethod = on_platform, regardless of what the calling page
 * already checked — a job's state can change between page load and
 * submission, and a request could bypass the UI entirely.
 *
 * Duplicate prevention is defense-in-depth: a friendly pre-check here,
 * backed by the schema's `@@unique([jobId, candidateProfileId])`
 * constraint (caught as P2002) as the real race-safe guarantee.
 */
export async function applyToJob(input: ApplyToJobInput): Promise<ApplyToJobResult> {
  const trimmedCoverNote = input.coverNote?.trim() ?? "";
  if (trimmedCoverNote.length > MAX_COVER_NOTE_LENGTH) {
    return { success: false, error: `Cover note must be ${MAX_COVER_NOTE_LENGTH} characters or fewer.` };
  }

  const candidateProfile = await getCandidateProfile(input.userId);
  if (!candidateProfile) {
    return { success: false, error: "Create your candidate profile before applying." };
  }

  const job = await prisma.job.findFirst({
    where: {
      id: input.jobId,
      status: "active",
      deletedAt: null,
      applicationMethod: "on_platform",
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: { id: true },
  });
  if (!job) {
    return { success: false, error: "This job is no longer accepting applications." };
  }

  const existingApplication = await prisma.application.findFirst({
    where: { jobId: job.id, candidateProfileId: candidateProfile.id, deletedAt: null },
    select: { id: true },
  });
  if (existingApplication) {
    return { success: false, error: "You have already applied to this job." };
  }

  try {
    const application = await prisma.application.create({
      data: {
        jobId: job.id,
        candidateProfileId: candidateProfile.id,
        coverNote: trimmedCoverNote || null,
      },
      select: { id: true },
    });

    return { success: true, applicationId: application.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { success: false, error: "You have already applied to this job." };
    }
    console.error("applyToJob failed", error);
    return { success: false, error: "We couldn't submit your application right now. Please try again." };
  }
}
