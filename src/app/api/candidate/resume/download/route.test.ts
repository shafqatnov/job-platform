import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionUserMock = vi.fn();
vi.mock("@/services/auth/getSessionUser", () => ({
  getSessionUser: () => getSessionUserMock(),
}));

const getResumeForDownloadMock = vi.fn();
vi.mock("@/services/candidates/getResumeForDownload", () => ({
  getResumeForDownload: (...args: unknown[]) => getResumeForDownloadMock(...args),
}));

async function importRoute() {
  return import("@/app/api/candidate/resume/download/route");
}

function textStream(content: string): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(content);
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

describe("GET /api/candidate/resume/download", () => {
  beforeEach(() => {
    getSessionUserMock.mockReset();
    getResumeForDownloadMock.mockReset();
  });

  it("rejects an unauthenticated request with 401 and never reads any resume", async () => {
    getSessionUserMock.mockResolvedValue(null);
    const { GET } = await importRoute();

    const response = await GET();

    expect(response.status).toBe(401);
    expect(getResumeForDownloadMock).not.toHaveBeenCalled();
  });

  it("rejects a non-candidate session with 401", async () => {
    getSessionUserMock.mockResolvedValue({ id: "u1", role: "employer", status: "active" });
    const { GET } = await importRoute();

    const response = await GET();

    expect(response.status).toBe(401);
    expect(getResumeForDownloadMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the signed-in candidate has no resume on file", async () => {
    getSessionUserMock.mockResolvedValue({ id: "candidate-1", role: "candidate", status: "active" });
    getResumeForDownloadMock.mockResolvedValue({ found: false });

    const { GET } = await importRoute();
    const response = await GET();

    expect(response.status).toBe(404);
  });

  it("streams the candidate's own resume with a private, non-cacheable response", async () => {
    getSessionUserMock.mockResolvedValue({ id: "candidate-1", role: "candidate", status: "active" });
    getResumeForDownloadMock.mockResolvedValue({
      found: true,
      stream: textStream("%PDF-1.4 fake resume content"),
      contentType: "application/pdf",
    });

    const { GET } = await importRoute();
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const text = await response.text();
    expect(text).toContain("%PDF-1.4");
  });

  it("resolves the resume using only the session-derived userId — the route takes no id parameter at all", async () => {
    getSessionUserMock.mockResolvedValue({ id: "candidate-1", role: "candidate", status: "active" });
    getResumeForDownloadMock.mockResolvedValue({ found: false });

    const { GET } = await importRoute();
    await GET();

    expect(getResumeForDownloadMock).toHaveBeenCalledWith("candidate-1");
  });
});
