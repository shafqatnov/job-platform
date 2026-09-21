import { describe, expect, it, vi, beforeEach } from "vitest";
import { getRedirectDestination } from "@/test-utils/nextRedirect";
import type { SyncGreenhouseJobsResult } from "@/services/sync/syncGreenhouseJobs";

const getSessionUserMock = vi.fn();
vi.mock("@/services/auth/getSessionUser", () => ({
  getSessionUser: () => getSessionUserMock(),
}));

const syncGreenhouseJobsMock = vi.fn();
vi.mock("@/services/sync/syncGreenhouseJobs", () => ({
  syncGreenhouseJobs: (...args: unknown[]) => syncGreenhouseJobsMock(...args),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const ADMIN_USER = { id: "admin-1", email: "a@example.invalid", name: "A", role: "admin", status: "active" };
const SOURCE_ID = "gh-source-1";

function makeSummary(overrides: Partial<Extract<SyncGreenhouseJobsResult, { ok: true }>> = {}): SyncGreenhouseJobsResult {
  return {
    ok: true,
    sourceId: SOURCE_ID,
    sourceName: "Greenhouse - Acme Co",
    fetchedCount: 5,
    validCount: 5,
    invalidCount: 0,
    exactDuplicateCount: 0,
    possibleDuplicateCount: 0,
    publishedCount: 2,
    queuedForReviewCount: 1,
    rejectedCount: 1,
    failedCount: 1,
    ...overrides,
  };
}

async function importAction() {
  const mod = await import("@/features/admin/syncGreenhouseNowAction");
  return mod.syncGreenhouseNowAction;
}

describe("syncGreenhouseNowAction", () => {
  beforeEach(() => {
    getSessionUserMock.mockReset();
    syncGreenhouseJobsMock.mockReset();
  });

  it("1. non-admin: redirects to /sign-in and never calls syncGreenhouseJobs", async () => {
    getSessionUserMock.mockResolvedValue({ id: "u1", email: "c@example.invalid", name: "C", role: "candidate", status: "active" });
    const action = await importAction();

    try {
      await action(SOURCE_ID, {}, new FormData());
      throw new Error("expected redirect to be thrown");
    } catch (error) {
      expect(getRedirectDestination(error)).toBe("/sign-in");
    }
    expect(syncGreenhouseJobsMock).not.toHaveBeenCalled();
  });

  it("unauthenticated: redirects to /sign-in and never calls syncGreenhouseJobs", async () => {
    getSessionUserMock.mockResolvedValue(null);
    const action = await importAction();

    try {
      await action(SOURCE_ID, {}, new FormData());
      throw new Error("expected redirect to be thrown");
    } catch (error) {
      expect(getRedirectDestination(error)).toBe("/sign-in");
    }
    expect(syncGreenhouseJobsMock).not.toHaveBeenCalled();
  });

  it("4+5. admin: calls the existing syncGreenhouseJobs(sourceId) exactly once with the correct source id, and maps its result to the 5 admin-facing buckets", async () => {
    getSessionUserMock.mockResolvedValue(ADMIN_USER);
    syncGreenhouseJobsMock.mockResolvedValue(
      makeSummary({
        fetchedCount: 10,
        publishedCount: 3,
        queuedForReviewCount: 2,
        exactDuplicateCount: 1,
        possibleDuplicateCount: 1,
        rejectedCount: 1,
        failedCount: 1,
        invalidCount: 1,
      })
    );
    const action = await importAction();

    const result = await action(SOURCE_ID, {}, new FormData());

    expect(syncGreenhouseJobsMock).toHaveBeenCalledTimes(1);
    expect(syncGreenhouseJobsMock).toHaveBeenCalledWith(SOURCE_ID);
    expect(result.summary).toEqual({
      imported: 10,
      published: 3,
      adminReview: 2,
      duplicates: 2,
      rejected: 3,
      durationMs: expect.any(Number),
    });
  });

  it("2+3. when syncGreenhouseJobs stops safely (gate failure), returns a clear error rather than a fabricated summary", async () => {
    getSessionUserMock.mockResolvedValue(ADMIN_USER);
    syncGreenhouseJobsMock.mockResolvedValue({ ok: false, reason: "disabled" });
    const action = await importAction();

    const result = await action(SOURCE_ID, {}, new FormData());

    expect(result.summary).toBeUndefined();
    expect(result.error).toContain("disabled");
  });

  it("a fetch-failure gate result includes the connector's own already-sanitized detail, never a raw error", async () => {
    getSessionUserMock.mockResolvedValue(ADMIN_USER);
    syncGreenhouseJobsMock.mockResolvedValue({ ok: false, reason: "fetch_failed", detail: "Could not reach the Greenhouse job board." });
    const action = await importAction();

    const result = await action(SOURCE_ID, {}, new FormData());

    expect(result.error).toContain("fetch_failed");
    expect(result.error).toContain("Could not reach the Greenhouse job board.");
  });

  it("never surfaces raw JSON or internal reason codes — only the 6 labeled numeric/duration fields", async () => {
    getSessionUserMock.mockResolvedValue(ADMIN_USER);
    syncGreenhouseJobsMock.mockResolvedValue(makeSummary());
    const action = await importAction();

    const result = await action(SOURCE_ID, {}, new FormData());

    expect(Object.keys(result.summary ?? {}).sort()).toEqual(
      ["adminReview", "duplicates", "durationMs", "imported", "published", "rejected"].sort()
    );
  });

  it("7. a second concurrent call (even for a different source) is rejected safely while the first is still running, then a third succeeds once the first finishes", async () => {
    getSessionUserMock.mockResolvedValue(ADMIN_USER);
    let resolveFirstSync!: (value: SyncGreenhouseJobsResult) => void;
    syncGreenhouseJobsMock.mockImplementation(
      () =>
        new Promise<SyncGreenhouseJobsResult>((resolve) => {
          resolveFirstSync = resolve;
        })
    );
    const action = await importAction();

    const firstCall = action(SOURCE_ID, {}, new FormData());
    await new Promise((r) => setTimeout(r, 20));

    const secondResult = await action("gh-source-2", {}, new FormData());
    expect(secondResult.error).toMatch(/already running/i);
    expect(syncGreenhouseJobsMock).toHaveBeenCalledTimes(1);

    resolveFirstSync(makeSummary());
    const firstResult = await firstCall;
    expect(firstResult.summary).toBeDefined();

    // The lock is released after the first call finishes — a THIRD call
    // now succeeds normally, proving this isn't a stuck/leaked lock.
    syncGreenhouseJobsMock.mockResolvedValue(makeSummary());
    const thirdResult = await action(SOURCE_ID, {}, new FormData());
    expect(thirdResult.summary).toBeDefined();
  });
});
