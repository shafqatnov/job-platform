import { describe, expect, it, vi, beforeEach } from "vitest";
import { getRedirectDestination } from "@/test-utils/nextRedirect";

const getSessionUserMock = vi.fn();
vi.mock("@/services/auth/getSessionUser", () => ({
  getSessionUser: () => getSessionUserMock(),
}));

const closeJobAsAdminMock = vi.fn();
vi.mock("@/services/admin/moderateJob", () => ({
  closeJobAsAdmin: (...args: unknown[]) => closeJobAsAdminMock(...args),
}));

async function importAction() {
  const mod = await import("@/features/admin/closeJobAsAdminAction");
  return mod.closeJobAsAdminAction;
}

/**
 * Represents test item 18 ("non-admin cannot use admin lifecycle
 * actions") for the whole admin close/reopen/delete family — all three
 * share the exact same re-derive-session-and-check-role shape (see
 * reopenJobAsAdminAction.ts/deleteJobAsAdminAction.ts), so this one is
 * the representative case, mirroring how this codebase doesn't
 * duplicate an identical authorization test per near-identical action.
 */
describe("closeJobAsAdminAction authorization", () => {
  beforeEach(() => {
    getSessionUserMock.mockReset();
    closeJobAsAdminMock.mockReset();
  });

  it("redirects home an unauthenticated caller and never calls the service", async () => {
    getSessionUserMock.mockResolvedValue(null);
    const action = await importAction();

    try {
      await action("job-1", {}, new FormData());
      throw new Error("expected redirect to be thrown");
    } catch (error) {
      expect(getRedirectDestination(error)).toBe("/sign-in");
    }
    expect(closeJobAsAdminMock).not.toHaveBeenCalled();
  });

  it("redirects a candidate session and never calls the service", async () => {
    getSessionUserMock.mockResolvedValue({ id: "u1", email: "c@example.invalid", name: "C", role: "candidate", status: "active" });
    const action = await importAction();

    try {
      await action("job-1", {}, new FormData());
      throw new Error("expected redirect to be thrown");
    } catch (error) {
      expect(getRedirectDestination(error)).toBe("/sign-in");
    }
    expect(closeJobAsAdminMock).not.toHaveBeenCalled();
  });

  it("redirects an employer session and never calls the service", async () => {
    getSessionUserMock.mockResolvedValue({ id: "u1", email: "e@example.invalid", name: "E", role: "employer", status: "active" });
    const action = await importAction();

    try {
      await action("job-1", {}, new FormData());
      throw new Error("expected redirect to be thrown");
    } catch (error) {
      expect(getRedirectDestination(error)).toBe("/sign-in");
    }
    expect(closeJobAsAdminMock).not.toHaveBeenCalled();
  });

  it("calls the service using the session's own admin userId for an authorized admin", async () => {
    getSessionUserMock.mockResolvedValue({ id: "admin-1", email: "a@example.invalid", name: "A", role: "admin", status: "active" });
    closeJobAsAdminMock.mockResolvedValue({ success: true });
    const action = await importAction();

    const result = await action("job-1", {}, new FormData());

    expect(result).toEqual({ success: true });
    expect(closeJobAsAdminMock).toHaveBeenCalledWith("admin-1", "job-1");
  });
});
