import { describe, expect, it, vi, beforeEach } from "vitest";
import { getRedirectDestination } from "@/test-utils/nextRedirect";

const getSessionUserMock = vi.fn();
vi.mock("@/services/auth/getSessionUser", () => ({
  getSessionUser: () => getSessionUserMock(),
}));

const resolveLocationReviewMock = vi.fn();
const rejectLocationReviewMock = vi.fn();
vi.mock("@/services/admin/locationReviews", () => ({
  resolveLocationReview: (...args: unknown[]) => resolveLocationReviewMock(...args),
  rejectLocationReview: (...args: unknown[]) => rejectLocationReviewMock(...args),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

async function importActions() {
  const resolveMod = await import("@/features/admin/resolveLocationReviewAction");
  const rejectMod = await import("@/features/admin/rejectLocationReviewAction");
  return { resolveLocationReviewAction: resolveMod.resolveLocationReviewAction, rejectLocationReviewAction: rejectMod.rejectLocationReviewAction };
}

/**
 * Test scenario "non-admin cannot resolve/reject a location review" —
 * both actions share the exact same re-derive-session-and-check-role
 * shape as every other admin action in this codebase (see
 * closeJobAsAdminAction.test.ts), so both are covered directly here
 * rather than duplicated per non-admin role.
 */
describe("resolveLocationReviewAction / rejectLocationReviewAction authorization", () => {
  beforeEach(() => {
    getSessionUserMock.mockReset();
    resolveLocationReviewMock.mockReset();
    rejectLocationReviewMock.mockReset();
  });

  it("resolve: redirects an unauthenticated caller and never calls the service", async () => {
    getSessionUserMock.mockResolvedValue(null);
    const { resolveLocationReviewAction } = await importActions();

    const formData = new FormData();
    formData.set("countryId", "country-1");
    try {
      await resolveLocationReviewAction("review-1", {}, formData);
      throw new Error("expected redirect to be thrown");
    } catch (error) {
      expect(getRedirectDestination(error)).toBe("/sign-in");
    }
    expect(resolveLocationReviewMock).not.toHaveBeenCalled();
  });

  it("resolve: redirects a candidate session and never calls the service", async () => {
    getSessionUserMock.mockResolvedValue({ id: "u1", email: "c@example.invalid", name: "C", role: "candidate", status: "active" });
    const { resolveLocationReviewAction } = await importActions();

    const formData = new FormData();
    formData.set("countryId", "country-1");
    try {
      await resolveLocationReviewAction("review-1", {}, formData);
      throw new Error("expected redirect to be thrown");
    } catch (error) {
      expect(getRedirectDestination(error)).toBe("/sign-in");
    }
    expect(resolveLocationReviewMock).not.toHaveBeenCalled();
  });

  it("resolve: calls the service using the session's own admin userId for an authorized admin", async () => {
    getSessionUserMock.mockResolvedValue({ id: "admin-1", email: "a@example.invalid", name: "A", role: "admin", status: "active" });
    resolveLocationReviewMock.mockResolvedValue({ success: true });
    const { resolveLocationReviewAction } = await importActions();

    const formData = new FormData();
    formData.set("countryId", "country-1");
    formData.set("cityId", "city-1");
    const result = await resolveLocationReviewAction("review-1", {}, formData);

    expect(result).toEqual({});
    expect(resolveLocationReviewMock).toHaveBeenCalledWith("review-1", "country-1", "city-1", "admin-1");
  });

  it("reject: redirects a non-admin (employer) session and never calls the service", async () => {
    getSessionUserMock.mockResolvedValue({ id: "u1", email: "e@example.invalid", name: "E", role: "employer", status: "active" });
    const { rejectLocationReviewAction } = await importActions();

    try {
      await rejectLocationReviewAction("review-1", {}, new FormData());
      throw new Error("expected redirect to be thrown");
    } catch (error) {
      expect(getRedirectDestination(error)).toBe("/sign-in");
    }
    expect(rejectLocationReviewMock).not.toHaveBeenCalled();
  });

  it("reject: calls the service using the session's own admin userId for an authorized admin", async () => {
    getSessionUserMock.mockResolvedValue({ id: "admin-1", email: "a@example.invalid", name: "A", role: "admin", status: "active" });
    rejectLocationReviewMock.mockResolvedValue({ success: true });
    const { rejectLocationReviewAction } = await importActions();

    const result = await rejectLocationReviewAction("review-1", {}, new FormData());

    expect(result).toEqual({});
    expect(rejectLocationReviewMock).toHaveBeenCalledWith("review-1", "admin-1");
  });
});
