import { afterAll, beforeAll, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { authorizeResumeUpload, commitResumeUpload } from "@/services/candidates/resumeUpload";
import { RESUME_PATHNAME } from "@/services/candidates/resumeUploadConstants";
import { createMockBlobProvider } from "@/test-utils/mockBlobProvider";
import {
  createCandidateTestFixtures,
  cleanupCandidateTestFixtures,
  type CandidateTestFixtures,
} from "@/test-utils/candidateFixtures";

describe("authorizeResumeUpload (real dev database, temporary fixtures)", () => {
  let fixture: CandidateTestFixtures;

  beforeAll(async () => {
    fixture = await createCandidateTestFixtures();
  });

  afterAll(async () => {
    await cleanupCandidateTestFixtures(fixture);
  });

  it("authorizes a candidate with a profile uploading to the fixed pathname", async () => {
    const result = await authorizeResumeUpload(fixture.userId, RESUME_PATHNAME);
    expect(result).toEqual({ ok: true, candidateProfileId: fixture.candidateProfileId });
  });

  it("rejects any pathname other than the one fixed constant", async () => {
    const result = await authorizeResumeUpload(fixture.userId, "../../etc/passwd");
    expect(result).toEqual({ ok: false, error: "Invalid upload target." });
  });

  it("rejects a user with no candidate profile yet, without throwing", async () => {
    const noProfileUser = await prisma.user.create({
      data: {
        email: `resume-upload-test-noprofile-${crypto.randomUUID()}@example.invalid`,
        name: "[RESUME UPLOAD TEST] No Profile",
        role: "candidate",
        status: "active",
        emailVerified: false,
      },
      select: { id: true },
    });

    try {
      const result = await authorizeResumeUpload(noProfileUser.id, RESUME_PATHNAME);
      expect(result).toEqual({
        ok: false,
        error: "Create your candidate profile before uploading a resume.",
      });
    } finally {
      await prisma.user.deleteMany({ where: { id: noProfileUser.id } });
    }
  });
});

describe("commitResumeUpload (real dev database, temporary fixtures)", () => {
  let fixture: CandidateTestFixtures;

  beforeAll(async () => {
    fixture = await createCandidateTestFixtures();
  });

  afterAll(async () => {
    await cleanupCandidateTestFixtures(fixture);
  });

  it("stores the new resume URL on the candidate's own profile", async () => {
    const { provider } = createMockBlobProvider();
    await commitResumeUpload(fixture.candidateProfileId, "https://blob.example.invalid/resume-abc.pdf", provider);

    const profile = await prisma.candidateProfile.findUniqueOrThrow({
      where: { id: fixture.candidateProfileId },
      select: { resumeFileUrl: true },
    });
    expect(profile.resumeFileUrl).toBe("https://blob.example.invalid/resume-abc.pdf");
  });

  it("deletes the previous blob object after replacing it, never before", async () => {
    const { provider, deletedUrls } = createMockBlobProvider();

    await commitResumeUpload(fixture.candidateProfileId, "https://blob.example.invalid/resume-v2.pdf", provider);
    expect(deletedUrls).toEqual(["https://blob.example.invalid/resume-abc.pdf"]);

    const profile = await prisma.candidateProfile.findUniqueOrThrow({
      where: { id: fixture.candidateProfileId },
      select: { resumeFileUrl: true },
    });
    expect(profile.resumeFileUrl).toBe("https://blob.example.invalid/resume-v2.pdf");
  });

  it("does not attempt to delete anything on a candidate's first-ever upload (no previous resume)", async () => {
    const fresh = await createCandidateTestFixtures();
    try {
      const { provider, deletedUrls } = createMockBlobProvider();
      await commitResumeUpload(fresh.candidateProfileId, "https://blob.example.invalid/resume-fresh.pdf", provider);
      expect(deletedUrls).toEqual([]);
    } finally {
      await cleanupCandidateTestFixtures(fresh);
    }
  });

  it("still commits the DB update even if the old blob's deletion fails, and does not throw", async () => {
    const { provider } = createMockBlobProvider();
    provider.deleteObject = async () => {
      throw new Error("simulated blob delete failure");
    };

    await expect(
      commitResumeUpload(fixture.candidateProfileId, "https://blob.example.invalid/resume-v3.pdf", provider)
    ).resolves.toBeUndefined();

    const profile = await prisma.candidateProfile.findUniqueOrThrow({
      where: { id: fixture.candidateProfileId },
      select: { resumeFileUrl: true },
    });
    expect(profile.resumeFileUrl).toBe("https://blob.example.invalid/resume-v3.pdf");
  });
});
