import { describe, expect, it, vi } from "vitest";
import { getRedirectDestination } from "@/test-utils/nextRedirect";

const getSessionUserMock = vi.fn();
vi.mock("@/services/auth/getSessionUser", () => ({
  getSessionUser: () => getSessionUserMock(),
}));

async function importLayout() {
  const mod = await import("@/app/(dashboard)/layout");
  return mod.default;
}

describe("(dashboard) layout guard", () => {
  it("redirects to /sign-in when there is no session", async () => {
    getSessionUserMock.mockResolvedValue(null);
    const DashboardLayout = await importLayout();

    try {
      await DashboardLayout({ children: null });
      throw new Error("expected redirect to be thrown");
    } catch (error) {
      expect(getRedirectDestination(error)).toBe("/sign-in");
    }
  });

  it("redirects to /sign-in when the session's account status is not active", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "u1",
      email: "a@example.invalid",
      name: "A",
      role: "candidate",
      status: "suspended",
    });
    const DashboardLayout = await importLayout();

    try {
      await DashboardLayout({ children: null });
      throw new Error("expected redirect to be thrown");
    } catch (error) {
      expect(getRedirectDestination(error)).toBe("/sign-in");
    }
  });

  it("renders (does not redirect) for a valid, active session", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "u1",
      email: "a@example.invalid",
      name: "A",
      role: "candidate",
      status: "active",
    });
    const DashboardLayout = await importLayout();

    const result = await DashboardLayout({ children: null });
    expect(result).toBeTruthy();
  });
});
