import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionUserMock = vi.fn();
vi.mock("@/services/auth/getSessionUser", () => ({
  getSessionUser: () => getSessionUserMock(),
}));

const getEmployerCompanyMock = vi.fn();
vi.mock("@/services/employers/getEmployerCompany", () => ({
  getEmployerCompany: (...args: unknown[]) => getEmployerCompanyMock(...args),
}));

const getEmployerJobsMock = vi.fn();
vi.mock("@/services/jobs/getEmployerJobs", () => ({
  getEmployerJobs: (...args: unknown[]) => getEmployerJobsMock(...args),
}));

async function importDashboard() {
  return import("@/app/(dashboard)/employer/page");
}

function job(overrides: Partial<{ id: string; status: string; applicationCount: number }> = {}) {
  return {
    id: overrides.id ?? "job-1",
    title: "A Job",
    status: overrides.status ?? "active",
    rejectionReason: undefined,
    createdAt: new Date().toISOString(),
    countrySlug: "uk",
    slug: "a-job",
    applicationCount: overrides.applicationCount ?? 0,
    savedJobCount: 0,
  };
}

describe("EmployerDashboardPage (mocked services, no real DB access)", () => {
  beforeEach(() => {
    getSessionUserMock.mockReset();
    getEmployerCompanyMock.mockReset();
    getEmployerJobsMock.mockReset().mockResolvedValue([]);
  });

  it("does not fetch jobs at all when the employer has no company yet", async () => {
    getSessionUserMock.mockResolvedValue({ id: "u1", email: "e@example.invalid", name: "E", role: "employer", status: "active" });
    getEmployerCompanyMock.mockResolvedValue(null);

    const { default: EmployerDashboardPage } = await importDashboard();
    const element = await EmployerDashboardPage({ searchParams: Promise.resolve({}) });

    expect(element).toBeTruthy();
    expect(getEmployerJobsMock).not.toHaveBeenCalled();
  });

  it("fetches jobs scoped to exactly this employer's own companyId — no authorization regression", async () => {
    getSessionUserMock.mockResolvedValue({ id: "u1", email: "e@example.invalid", name: "E", role: "employer", status: "active" });
    getEmployerCompanyMock.mockResolvedValue({ employerProfileId: "ep1", companyId: "company-42", companyName: "Acme", websiteUrl: null, description: null, countrySlug: "uk" });

    const { default: EmployerDashboardPage } = await importDashboard();
    await EmployerDashboardPage({ searchParams: Promise.resolve({}) });

    expect(getEmployerJobsMock).toHaveBeenCalledWith("company-42");
  });

  it("renders without throwing for a mix of active, pending, and other-status jobs", async () => {
    getSessionUserMock.mockResolvedValue({ id: "u1", email: "e@example.invalid", name: "E", role: "employer", status: "active" });
    getEmployerCompanyMock.mockResolvedValue({ employerProfileId: "ep1", companyId: "company-42", companyName: "Acme", websiteUrl: null, description: null, countrySlug: "uk" });
    getEmployerJobsMock.mockResolvedValue([
      job({ id: "job-1", status: "active", applicationCount: 3 }),
      job({ id: "job-2", status: "pending_review", applicationCount: 0 }),
      job({ id: "job-3", status: "rejected", applicationCount: 0 }),
    ]);

    const { default: EmployerDashboardPage } = await importDashboard();
    const element = await EmployerDashboardPage({ searchParams: Promise.resolve({}) });
    expect(element).toBeTruthy();
  });

  it("renders without throwing when the company has no jobs at all", async () => {
    getSessionUserMock.mockResolvedValue({ id: "u1", email: "e@example.invalid", name: "E", role: "employer", status: "active" });
    getEmployerCompanyMock.mockResolvedValue({ employerProfileId: "ep1", companyId: "company-42", companyName: "Acme", websiteUrl: null, description: null, countrySlug: "uk" });

    const { default: EmployerDashboardPage } = await importDashboard();
    const element = await EmployerDashboardPage({ searchParams: Promise.resolve({}) });
    expect(element).toBeTruthy();
  });
});
