import { describe, expect, it, vi, beforeEach } from "vitest";
import { getRedirectDestination } from "@/test-utils/nextRedirect";

const getSessionUserMock = vi.fn();
vi.mock("@/services/auth/getSessionUser", () => ({
  getSessionUser: () => getSessionUserMock(),
}));

const approveImportedJobReviewMock = vi.fn();
vi.mock("@/services/publishing/publishImportedJob", () => ({
  approveImportedJobReview: (...args: unknown[]) => approveImportedJobReviewMock(...args),
}));

const findUniqueMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { importedJobReview: { findUnique: (...args: unknown[]) => findUniqueMock(...args) } },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

async function importAction() {
  const mod = await import("@/features/admin/approveImportedJobReviewAction");
  return mod.approveImportedJobReviewAction;
}

/**
 * Covers the silent-approval UX fix (Jobnura — Fix Imported Job Review
 * Discoverability and Silent Location-Stuck Workflow): a "queued_for_review"
 * outcome must never be reported as an error (the business logic already
 * treats it as a valid intermediate state — see publishImportedJob.ts),
 * but the admin must no longer see a bare "success" with no explanation.
 */
describe("approveImportedJobReviewAction", () => {
  beforeEach(() => {
    getSessionUserMock.mockReset();
    approveImportedJobReviewMock.mockReset();
    findUniqueMock.mockReset();
  });

  it("redirects an unauthenticated caller and never calls the service", async () => {
    getSessionUserMock.mockResolvedValue(null);
    const action = await importAction();

    try {
      await action("review-1", {}, new FormData());
      throw new Error("expected redirect to be thrown");
    } catch (error) {
      expect(getRedirectDestination(error)).toBe("/sign-in");
    }
    expect(approveImportedJobReviewMock).not.toHaveBeenCalled();
  });

  it("redirects a non-admin (employer) session and never calls the service", async () => {
    getSessionUserMock.mockResolvedValue({ id: "u1", email: "e@example.invalid", name: "E", role: "employer", status: "active" });
    const action = await importAction();

    try {
      await action("review-1", {}, new FormData());
      throw new Error("expected redirect to be thrown");
    } catch (error) {
      expect(getRedirectDestination(error)).toBe("/sign-in");
    }
    expect(approveImportedJobReviewMock).not.toHaveBeenCalled();
  });

  it("existing successful-approval behavior is unchanged: a 'published' outcome returns an empty state", async () => {
    getSessionUserMock.mockResolvedValue({ id: "admin-1", email: "a@example.invalid", name: "A", role: "admin", status: "active" });
    approveImportedJobReviewMock.mockResolvedValue({ outcome: "published", jobId: "job-1", reviewId: "review-1" });
    const action = await importAction();

    const result = await action("review-1", {}, new FormData());

    expect(result).toEqual({});
    expect(findUniqueMock).not.toHaveBeenCalled();
    expect(approveImportedJobReviewMock).toHaveBeenCalledWith("review-1", "admin-1");
  });

  it("existing failed-approval behavior is unchanged: a 'failed' outcome surfaces its own error, not an info message", async () => {
    getSessionUserMock.mockResolvedValue({ id: "admin-1", email: "a@example.invalid", name: "A", role: "admin", status: "active" });
    approveImportedJobReviewMock.mockResolvedValue({ outcome: "failed", error: "This imported job is missing required information and cannot be published." });
    const action = await importAction();

    const result = await action("review-1", {}, new FormData());

    expect(result).toEqual({ error: "This imported job is missing required information and cannot be published." });
    expect(result.info).toBeUndefined();
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("a 'queued_for_review' outcome blocked on location is never reported as an error, and explains the location cause", async () => {
    getSessionUserMock.mockResolvedValue({ id: "admin-1", email: "a@example.invalid", name: "A", role: "admin", status: "active" });
    approveImportedJobReviewMock.mockResolvedValue({ outcome: "queued_for_review", reviewId: "review-1" });
    findUniqueMock.mockResolvedValue({ locationReviewStatus: "pending" });
    const action = await importAction();

    const result = await action("review-1", {}, new FormData());

    expect(result.error).toBeUndefined();
    expect(result.info).toMatch(/location/i);
    expect(findUniqueMock).toHaveBeenCalledWith({ where: { id: "review-1" }, select: { locationReviewStatus: true } });
  });

  it("a 'queued_for_review' outcome NOT blocked on location still explains it wasn't published, without inventing a location cause", async () => {
    getSessionUserMock.mockResolvedValue({ id: "admin-1", email: "a@example.invalid", name: "A", role: "admin", status: "active" });
    approveImportedJobReviewMock.mockResolvedValue({ outcome: "queued_for_review", reviewId: "review-1" });
    findUniqueMock.mockResolvedValue({ locationReviewStatus: null });
    const action = await importAction();

    const result = await action("review-1", {}, new FormData());

    expect(result.error).toBeUndefined();
    expect(result.info).toBeTruthy();
    expect(result.info).not.toMatch(/location/i);
  });

  it("never reinterprets 'queued_for_review' as a forced publication — the service is only ever called once", async () => {
    getSessionUserMock.mockResolvedValue({ id: "admin-1", email: "a@example.invalid", name: "A", role: "admin", status: "active" });
    approveImportedJobReviewMock.mockResolvedValue({ outcome: "queued_for_review", reviewId: "review-1" });
    findUniqueMock.mockResolvedValue({ locationReviewStatus: "pending" });
    const action = await importAction();

    await action("review-1", {}, new FormData());

    expect(approveImportedJobReviewMock).toHaveBeenCalledTimes(1);
  });
});
