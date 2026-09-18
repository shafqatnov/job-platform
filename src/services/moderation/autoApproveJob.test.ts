import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { autoApproveJob } from "@/services/moderation/autoApproveJob";
import {
  createModerationTestFixtures,
  createTestJob,
  cleanupModerationTestFixtures,
  type ModerationTestFixtures,
} from "@/test-utils/moderationFixtures";

const revalidatePathMock = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}));

describe("autoApproveJob revalidation (real dev database, temporary fixtures)", () => {
  let fixtures: ModerationTestFixtures;

  beforeAll(async () => {
    fixtures = await createModerationTestFixtures();
  });

  afterEach(() => {
    revalidatePathMock.mockClear();
  });

  afterAll(async () => {
    await cleanupModerationTestFixtures(fixtures);
  });

  it("publishes an eligible pending job and revalidates /jobs and /", async () => {
    const job = await createTestJob(fixtures, { status: "pending_review" });

    const result = await autoApproveJob(job.id);

    expect(result).toEqual({ success: true });

    const updated = await prisma.job.findUniqueOrThrow({
      where: { id: job.id },
      select: { status: true, postedAt: true, expiresAt: true },
    });
    expect(updated.status).toBe("active");
    expect(updated.postedAt).not.toBeNull();
    expect(updated.expiresAt).not.toBeNull();

    expect(revalidatePathMock).toHaveBeenCalledWith("/jobs");
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
    expect(revalidatePathMock).toHaveBeenCalledTimes(2);
  });

  it("does NOT revalidate when the job is no longer pending review (lost the race / already decided)", async () => {
    const job = await createTestJob(fixtures, { status: "active" });

    const result = await autoApproveJob(job.id);

    expect(result).toEqual({ success: false, reason: "not_eligible" });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});
