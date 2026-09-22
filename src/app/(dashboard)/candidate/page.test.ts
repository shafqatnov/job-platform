import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionUserMock = vi.fn();
vi.mock("@/services/auth/getSessionUser", () => ({
  getSessionUser: () => getSessionUserMock(),
}));

const getCandidateProfileMock = vi.fn();
vi.mock("@/services/candidates/getCandidateProfile", () => ({
  getCandidateProfile: (...args: unknown[]) => getCandidateProfileMock(...args),
}));

const getSavedJobsMock = vi.fn();
vi.mock("@/services/candidates/getSavedJobs", () => ({
  getSavedJobs: (...args: unknown[]) => getSavedJobsMock(...args),
}));

const getApplicationsForCandidateMock = vi.fn();
vi.mock("@/services/applications/getApplicationsForCandidate", () => ({
  getApplicationsForCandidate: (...args: unknown[]) => getApplicationsForCandidateMock(...args),
}));

const getRecommendedJobsForCandidateMock = vi.fn();
vi.mock("@/services/candidates/getRecommendedJobs", () => ({
  getRecommendedJobsForCandidate: (...args: unknown[]) => getRecommendedJobsForCandidateMock(...args),
}));

async function importDashboard() {
  return import("@/app/(dashboard)/candidate/page");
}

const mockProfile = {
  id: "candidate-profile-1",
  fullName: "Jordan Candidate",
  headline: "Senior Engineer",
  countrySlug: "uk",
  countryName: "United Kingdom",
  citySlug: "london",
  cityName: "London",
  hasResume: true,
};

describe("CandidateDashboardOverview (mocked services, no real DB access)", () => {
  beforeEach(() => {
    getSavedJobsMock.mockReset().mockResolvedValue([]);
    getApplicationsForCandidateMock.mockReset().mockResolvedValue([]);
    getRecommendedJobsForCandidateMock.mockReset().mockResolvedValue([]);
  });

  it("fetches saved jobs, applications, and recommendations scoped to exactly this candidate's own profile id — no authorization regression", async () => {
    const { CandidateDashboardOverview } = await importDashboard();
    await CandidateDashboardOverview({ profile: mockProfile });

    expect(getSavedJobsMock).toHaveBeenCalledWith(mockProfile.id);
    expect(getApplicationsForCandidateMock).toHaveBeenCalledWith(mockProfile.id);
    expect(getRecommendedJobsForCandidateMock).toHaveBeenCalledWith(mockProfile.id, mockProfile.countrySlug);
  });

  it("renders without throwing when every section is empty", async () => {
    const { CandidateDashboardOverview } = await importDashboard();
    const element = await CandidateDashboardOverview({ profile: mockProfile });
    expect(element).toBeTruthy();
  });

  it("renders without throwing when every section has real data", async () => {
    getSavedJobsMock.mockResolvedValue([
      {
        id: "job-1",
        slug: "job-1",
        title: "Job One",
        companyName: "Co",
        companySlug: "co",
        countryCode: "GB",
        countrySlug: "uk",
        countryName: "United Kingdom",
        city: "London",
        postedAt: new Date().toISOString(),
      },
    ]);
    getApplicationsForCandidateMock.mockResolvedValue([
      {
        id: "app-1",
        jobTitle: "Job One",
        jobSlug: "job-1",
        countrySlug: "uk",
        countryName: "United Kingdom",
        companyName: "Co",
        appliedDate: new Date().toISOString(),
        status: "received",
      },
    ]);
    getRecommendedJobsForCandidateMock.mockResolvedValue([
      {
        id: "job-2",
        slug: "job-2",
        title: "Job Two",
        companyName: "Co",
        companySlug: "co",
        countryCode: "GB",
        countrySlug: "uk",
        countryName: "United Kingdom",
        city: "London",
        postedAt: new Date().toISOString(),
      },
    ]);

    const { CandidateDashboardOverview } = await importDashboard();
    const element = await CandidateDashboardOverview({ profile: mockProfile });
    expect(element).toBeTruthy();
  });

  it("a profile with no optional fields filled still renders (0% completion is a valid, non-throwing state)", async () => {
    const { CandidateDashboardOverview } = await importDashboard();
    const element = await CandidateDashboardOverview({
      profile: { ...mockProfile, headline: null, cityName: null, hasResume: false },
    });
    expect(element).toBeTruthy();
  });
});

describe("CandidateDashboardPage default export (mocked session, no real DB access)", () => {
  beforeEach(() => {
    getSessionUserMock.mockReset();
    getCandidateProfileMock.mockReset();
    getSavedJobsMock.mockReset().mockResolvedValue([]);
    getApplicationsForCandidateMock.mockReset().mockResolvedValue([]);
    getRecommendedJobsForCandidateMock.mockReset().mockResolvedValue([]);
  });

  it("does not fetch saved jobs/applications/recommendations at all when the candidate has no profile yet", async () => {
    getSessionUserMock.mockResolvedValue({ id: "u1", email: "c@example.invalid", name: "C", role: "candidate", status: "active" });
    getCandidateProfileMock.mockResolvedValue(null);

    const { default: CandidateDashboardPage } = await importDashboard();
    const element = await CandidateDashboardPage();

    expect(element).toBeTruthy();
    expect(getSavedJobsMock).not.toHaveBeenCalled();
    expect(getApplicationsForCandidateMock).not.toHaveBeenCalled();
    expect(getRecommendedJobsForCandidateMock).not.toHaveBeenCalled();
  });

  it("resolves the profile using only the session-derived userId — never a client-supplied value", async () => {
    getSessionUserMock.mockResolvedValue({ id: "session-user-42", email: "c@example.invalid", name: "C", role: "candidate", status: "active" });
    getCandidateProfileMock.mockResolvedValue(mockProfile);

    const { default: CandidateDashboardPage } = await importDashboard();
    await CandidateDashboardPage();

    expect(getCandidateProfileMock).toHaveBeenCalledWith("session-user-42");
  });
});
