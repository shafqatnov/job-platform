import { describe, expect, it, vi, beforeEach } from "vitest";
import { getRedirectDestination } from "@/test-utils/nextRedirect";
import type { SyncAdzunaJobsResult } from "@/services/sync/syncAdzunaJobs";

const getSessionUserMock = vi.fn();
vi.mock("@/services/auth/getSessionUser", () => ({
  getSessionUser: () => getSessionUserMock(),
}));

const syncAdzunaJobsMock = vi.fn();
vi.mock("@/services/sync/syncAdzunaJobs", () => ({
  syncAdzunaJobs: (...args: unknown[]) => syncAdzunaJobsMock(...args),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const ADMIN_USER = { id: "admin-1", email: "a@example.invalid", name: "A", role: "admin", status: "active" };

function makeSummary(overrides: Partial<Extract<SyncAdzunaJobsResult, { ok: true }>> = {}): SyncAdzunaJobsResult {
  return {
    ok: true,
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
  const mod = await import("@/features/admin/syncAdzunaNowAction");
  return mod.syncAdzunaNowAction;
}

describe("syncAdzunaNowAction", () => {
  beforeEach(() => {
    getSessionUserMock.mockReset();
    syncAdzunaJobsMock.mockReset();
  });

  it("non-admin: redirects to /sign-in and never calls syncAdzunaJobs", async () => {
    getSessionUserMock.mockResolvedValue({ id: "u1", email: "c@example.invalid", name: "C", role: "candidate", status: "active" });
    const action = await importAction();

    try {
      await action({}, new FormData());
      throw new Error("expected redirect to be thrown");
    } catch (error) {
      expect(getRedirectDestination(error)).toBe("/sign-in");
    }
    expect(syncAdzunaJobsMock).not.toHaveBeenCalled();
  });

  it("unauthenticated: redirects to /sign-in and never calls syncAdzunaJobs", async () => {
    getSessionUserMock.mockResolvedValue(null);
    const action = await importAction();

    try {
      await action({}, new FormData());
      throw new Error("expected redirect to be thrown");
    } catch (error) {
      expect(getRedirectDestination(error)).toBe("/sign-in");
    }
    expect(syncAdzunaJobsMock).not.toHaveBeenCalled();
  });

  it("admin: calls the existing syncAdzunaJobs() exactly once and maps its result to the 5 admin-facing buckets", async () => {
    getSessionUserMock.mockResolvedValue(ADMIN_USER);
    syncAdzunaJobsMock.mockResolvedValue(
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

    const result = await action({}, new FormData());

    expect(syncAdzunaJobsMock).toHaveBeenCalledTimes(1);
    expect(result.summary).toEqual({
      imported: 10,
      published: 3,
      adminReview: 2,
      duplicates: 2, // exact + possible
      rejected: 3, // rejected + failed + invalid
      durationMs: expect.any(Number),
    });
  });

  it("when syncAdzunaJobs stops safely (gate failure), returns a clear error rather than a fabricated summary", async () => {
    getSessionUserMock.mockResolvedValue(ADMIN_USER);
    syncAdzunaJobsMock.mockResolvedValue({ ok: false, reason: "disabled" });
    const action = await importAction();

    const result = await action({}, new FormData());

    expect(result.summary).toBeUndefined();
    expect(result.error).toContain("disabled");
  });

  it("never surfaces raw JSON or internal reason codes — only the 6 labeled numeric/duration fields", async () => {
    getSessionUserMock.mockResolvedValue(ADMIN_USER);
    syncAdzunaJobsMock.mockResolvedValue(makeSummary());
    const action = await importAction();

    const result = await action({}, new FormData());

    expect(Object.keys(result.summary ?? {}).sort()).toEqual(
      ["adminReview", "duplicates", "durationMs", "imported", "published", "rejected"].sort()
    );
  });

  it("a second concurrent call is rejected safely while the first is still running, then succeeds once the first finishes", async () => {
    getSessionUserMock.mockResolvedValue(ADMIN_USER);
    let resolveFirstSync!: (value: SyncAdzunaJobsResult) => void;
    syncAdzunaJobsMock.mockImplementation(
      () =>
        new Promise<SyncAdzunaJobsResult>((resolve) => {
          resolveFirstSync = resolve;
        })
    );
    const action = await importAction();

    const firstCall = action({}, new FormData());
    // Let the first call's synchronous prelude (session check, acquiring
    // the in-process lock) run before starting the second.
    await new Promise((r) => setTimeout(r, 20));

    const secondResult = await action({}, new FormData());
    expect(secondResult.error).toMatch(/already running/i);
    expect(syncAdzunaJobsMock).toHaveBeenCalledTimes(1);

    resolveFirstSync(makeSummary());
    const firstResult = await firstCall;
    expect(firstResult.summary).toBeDefined();

    // The lock is released after the first call finishes — a THIRD call
    // now succeeds normally, proving this isn't a stuck/leaked lock.
    syncAdzunaJobsMock.mockResolvedValue(makeSummary());
    const thirdResult = await action({}, new FormData());
    expect(thirdResult.summary).toBeDefined();
  });
});
