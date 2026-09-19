import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getResumeForDownload } from "@/services/candidates/getResumeForDownload";
import { createMockBlobProvider } from "@/test-utils/mockBlobProvider";
import {
  createCandidateTestFixtures,
  cleanupCandidateTestFixtures,
  type CandidateTestFixtures,
} from "@/test-utils/candidateFixtures";

function textStream(content: string): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(content);
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

describe("getResumeForDownload (real dev database, temporary fixtures)", () => {
  let candidateA: CandidateTestFixtures;
  let candidateB: CandidateTestFixtures;

  beforeAll(async () => {
    candidateA = await createCandidateTestFixtures();
    candidateB = await createCandidateTestFixtures();
  });

  afterAll(async () => {
    await cleanupCandidateTestFixtures(candidateA);
    await cleanupCandidateTestFixtures(candidateB);
  });

  afterEach(async () => {
    await prisma.candidateProfile.updateMany({
      where: { id: { in: [candidateA.candidateProfileId, candidateB.candidateProfileId] } },
      data: { resumeFileUrl: null },
    });
  });

  it("streams the candidate's own resume content", async () => {
    await prisma.candidateProfile.update({
      where: { id: candidateA.candidateProfileId },
      data: { resumeFileUrl: "https://blob.example.invalid/candidate-a-resume.pdf" },
    });
    const { provider } = createMockBlobProvider({
      "https://blob.example.invalid/candidate-a-resume.pdf": {
        stream: textStream("%PDF-1.4 fake resume content"),
        contentType: "application/pdf",
      },
    });

    const result = await getResumeForDownload(candidateA.userId, provider);
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.contentType).toBe("application/pdf");
      const reader = result.stream.getReader();
      const { value } = await reader.read();
      expect(new TextDecoder().decode(value)).toContain("%PDF-1.4");
    }
  });

  it("never returns another candidate's resume", async () => {
    await prisma.candidateProfile.update({
      where: { id: candidateA.candidateProfileId },
      data: { resumeFileUrl: "https://blob.example.invalid/candidate-a-resume.pdf" },
    });
    const { provider } = createMockBlobProvider({
      "https://blob.example.invalid/candidate-a-resume.pdf": {
        stream: textStream("candidate A's resume"),
        contentType: "application/pdf",
      },
    });

    const resultForB = await getResumeForDownload(candidateB.userId, provider);
    expect(resultForB).toEqual({ found: false });
  });

  it("reports not found when the candidate has no resume on file", async () => {
    const { provider } = createMockBlobProvider();
    const result = await getResumeForDownload(candidateA.userId, provider);
    expect(result).toEqual({ found: false });
  });

  it("reports not found (no throw) when the account has no candidate profile yet", async () => {
    const noProfileUser = await prisma.user.create({
      data: {
        email: `resume-download-test-noprofile-${crypto.randomUUID()}@example.invalid`,
        name: "[RESUME DOWNLOAD TEST] No Profile",
        role: "candidate",
        status: "active",
        emailVerified: false,
      },
      select: { id: true },
    });

    try {
      const { provider } = createMockBlobProvider();
      const result = await getResumeForDownload(noProfileUser.id, provider);
      expect(result).toEqual({ found: false });
    } finally {
      await prisma.user.deleteMany({ where: { id: noProfileUser.id } });
    }
  });
});
