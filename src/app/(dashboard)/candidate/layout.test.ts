import { describe, expect, it, vi } from "vitest";
import { getRedirectDestination } from "@/test-utils/nextRedirect";

const getSessionUserMock = vi.fn();
vi.mock("@/services/auth/getSessionUser", () => ({
  getSessionUser: () => getSessionUserMock(),
}));

async function importLayout() {
  const mod = await import("@/app/(dashboard)/candidate/layout");
  return mod.default;
}

describe("candidate layout guard", () => {
  it("redirects home when there is no session", async () => {
    getSessionUserMock.mockResolvedValue(null);
    const CandidateLayout = await importLayout();
    try {
      await CandidateLayout({ children: null });
      throw new Error("expected redirect to be thrown");
    } catch (error) {
      expect(getRedirectDestination(error)).toBe("/");
    }
  });

  it("redirects home for an employer session (wrong role)", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "u1",
      email: "e@example.invalid",
      name: "E",
      role: "employer",
      status: "active",
    });
    const CandidateLayout = await importLayout();
    try {
      await CandidateLayout({ children: null });
      throw new Error("expected redirect to be thrown");
    } catch (error) {
      expect(getRedirectDestination(error)).toBe("/");
    }
  });

  it("redirects home for an admin session (wrong role)", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "u1",
      email: "adm@example.invalid",
      name: "Admin",
      role: "admin",
      status: "active",
    });
    const CandidateLayout = await importLayout();
    try {
      await CandidateLayout({ children: null });
      throw new Error("expected redirect to be thrown");
    } catch (error) {
      expect(getRedirectDestination(error)).toBe("/");
    }
  });

  it("renders (does not redirect) for a candidate session", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "u1",
      email: "c@example.invalid",
      name: "C",
      role: "candidate",
      status: "active",
    });
    const CandidateLayout = await importLayout();
    const result = await CandidateLayout({ children: null });
    expect(result).toBeTruthy();
  });
});
