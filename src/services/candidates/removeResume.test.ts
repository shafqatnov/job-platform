import { afterAll, beforeAll, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { removeResume } from "@/services/candidates/removeResume";
import { createMockBlobProvider } from "@/test-utils/mockBlobProvider";
import {
  createCandidateTestFixtures,
  cleanupCandidateTestFixtures,
  type CandidateTestFixtures,
} from "@/test-utils/candidateFixtures";

describe("removeResume (real dev database, temporary fixtures)", () => {
  let fixture: CandidateTestFixtures;

  beforeAll(async () => {
    fixture = await createCandidateTestFixtures();
  });

  afterAll(async () => {
    await cleanupCandidateTestFixtures(fixture);
  });

  it("clears resumeFileUrl and deletes the underlying blob", async () => {
    await prisma.candidateProfile.update({
      where: { id: fixture.candidateProfileId },
      data: { resumeFileUrl: "https://blob.example.invalid/resume-to-remove.pdf" },
    });

    const { provider, deletedUrls } = createMockBlobProvider();
    const result = await removeResume(fixture.userId, provider);

    expect(result).toEqual({ success: true });
    expect(deletedUrls).toEqual(["https://blob.example.invalid/resume-to-remove.pdf"]);

    const profile = await prisma.candidateProfile.findUniqueOrThrow({
      where: { id: fixture.candidateProfileId },
      select: { resumeFileUrl: true },
    });
    expect(profile.resumeFileUrl).toBeNull();
  });

  it("is idempotent — removing when there is no resume is still a success, and deletes nothing", async () => {
    const { provider, deletedUrls } = createMockBlobProvider();
    const result = await removeResume(fixture.userId, provider);

    expect(result).toEqual({ success: true });
    expect(deletedUrls).toEqual([]);
  });

  it("fails safely (no throw) when the account has no candidate profile yet", async () => {
    const noProfileUser = await prisma.user.create({
      data: {
        email: `remove-resume-test-noprofile-${crypto.randomUUID()}@example.invalid`,
        name: "[REMOVE RESUME TEST] No Profile",
        role: "candidate",
        status: "active",
        emailVerified: false,
      },
      select: { id: true },
    });

    try {
      const { provider } = createMockBlobProvider();
      const result = await removeResume(noProfileUser.id, provider);
      expect(result).toEqual({ success: false, error: "Create your candidate profile first." });
    } finally {
      await prisma.user.deleteMany({ where: { id: noProfileUser.id } });
    }
  });

  it("never affects another candidate's resume", async () => {
    const otherFixture = await createCandidateTestFixtures();
    try {
      await prisma.candidateProfile.update({
        where: { id: otherFixture.candidateProfileId },
        data: { resumeFileUrl: "https://blob.example.invalid/other-candidate-resume.pdf" },
      });

      const { provider } = createMockBlobProvider();
      await removeResume(fixture.userId, provider);

      const otherProfile = await prisma.candidateProfile.findUniqueOrThrow({
        where: { id: otherFixture.candidateProfileId },
        select: { resumeFileUrl: true },
      });
      expect(otherProfile.resumeFileUrl).toBe("https://blob.example.invalid/other-candidate-resume.pdf");
    } finally {
      await cleanupCandidateTestFixtures(otherFixture);
    }
  });
});
