import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_RESUME_SIZE_BYTES, RESUME_CONTENT_TYPE } from "@/services/candidates/resumeUploadConstants";

const getSessionUserMock = vi.fn();
vi.mock("@/services/auth/getSessionUser", () => ({
  getSessionUser: () => getSessionUserMock(),
}));

const authorizeResumeUploadMock = vi.fn();
const commitResumeUploadMock = vi.fn();
vi.mock("@/services/candidates/resumeUpload", () => ({
  authorizeResumeUpload: (...args: unknown[]) => authorizeResumeUploadMock(...args),
  commitResumeUpload: (...args: unknown[]) => commitResumeUploadMock(...args),
}));

type OnBeforeGenerateToken = (pathname: string, clientPayload: string | null, multipart: boolean) => Promise<unknown>;
type OnUploadCompleted = (body: { blob: { url: string }; tokenPayload?: string | null }) => Promise<void>;

const handleUploadMock = vi.fn<
  (options: { onBeforeGenerateToken: OnBeforeGenerateToken; onUploadCompleted: OnUploadCompleted }) => Promise<unknown>
>();
vi.mock("@vercel/blob/client", () => ({
  handleUpload: (...args: [{ onBeforeGenerateToken: OnBeforeGenerateToken; onUploadCompleted: OnUploadCompleted }]) =>
    handleUploadMock(...args),
}));

async function importRoute() {
  return import("@/app/api/candidate/resume/upload/route");
}

function postWith(body: unknown): Request {
  return new Request("http://localhost/api/candidate/resume/upload", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const tokenRequestBody = { type: "blob.generate-client-token", payload: { pathname: "resume.pdf", multipart: false, clientPayload: null } };

describe("POST /api/candidate/resume/upload", () => {
  beforeEach(() => {
    getSessionUserMock.mockReset();
    authorizeResumeUploadMock.mockReset();
    commitResumeUploadMock.mockReset();
    handleUploadMock.mockReset();
  });

  it("passes through handleUpload's successful response", async () => {
    handleUploadMock.mockResolvedValue({ type: "blob.generate-client-token", clientToken: "token-abc" });
    const { POST } = await importRoute();

    const response = await POST(postWith(tokenRequestBody));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ type: "blob.generate-client-token", clientToken: "token-abc" });
  });

  it("onBeforeGenerateToken rejects when there is no session, without ever authorizing", async () => {
    getSessionUserMock.mockResolvedValue(null);
    handleUploadMock.mockImplementation(async ({ onBeforeGenerateToken }) => {
      await onBeforeGenerateToken("resume.pdf", null, false);
      return { type: "blob.generate-client-token", clientToken: "unused" };
    });

    const { POST } = await importRoute();
    const response = await POST(postWith(tokenRequestBody));

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("Unauthorized");
    expect(authorizeResumeUploadMock).not.toHaveBeenCalled();
  });

  it("onBeforeGenerateToken rejects a non-candidate session", async () => {
    getSessionUserMock.mockResolvedValue({ id: "u1", role: "employer", status: "active" });
    handleUploadMock.mockImplementation(async ({ onBeforeGenerateToken }) => {
      await onBeforeGenerateToken("resume.pdf", null, false);
      return { type: "blob.generate-client-token", clientToken: "unused" };
    });

    const { POST } = await importRoute();
    const response = await POST(postWith(tokenRequestBody));

    expect(response.status).toBe(400);
    expect(authorizeResumeUploadMock).not.toHaveBeenCalled();
  });

  it("onBeforeGenerateToken authorizes using the session's own userId and the requested pathname — never a client-supplied id", async () => {
    getSessionUserMock.mockResolvedValue({ id: "candidate-1", role: "candidate", status: "active" });
    authorizeResumeUploadMock.mockResolvedValue({ ok: true, candidateProfileId: "profile-1" });

    let capturedOptions: unknown;
    handleUploadMock.mockImplementation(async ({ onBeforeGenerateToken }) => {
      capturedOptions = await onBeforeGenerateToken("resume.pdf", null, false);
      return { type: "blob.generate-client-token", clientToken: "token-abc" };
    });

    const { POST } = await importRoute();
    const response = await POST(postWith(tokenRequestBody));

    expect(response.status).toBe(200);
    expect(authorizeResumeUploadMock).toHaveBeenCalledWith("candidate-1", "resume.pdf");
    expect(capturedOptions).toMatchObject({
      allowedContentTypes: [RESUME_CONTENT_TYPE],
      maximumSizeInBytes: MAX_RESUME_SIZE_BYTES,
      addRandomSuffix: true,
      tokenPayload: JSON.stringify({ candidateProfileId: "profile-1" }),
    });
  });

  it("onBeforeGenerateToken rejects when authorizeResumeUpload fails (e.g. no candidate profile)", async () => {
    getSessionUserMock.mockResolvedValue({ id: "candidate-1", role: "candidate", status: "active" });
    authorizeResumeUploadMock.mockResolvedValue({
      ok: false,
      error: "Create your candidate profile before uploading a resume.",
    });

    handleUploadMock.mockImplementation(async ({ onBeforeGenerateToken }) => {
      await onBeforeGenerateToken("resume.pdf", null, false);
      return { type: "blob.generate-client-token", clientToken: "unused" };
    });

    const { POST } = await importRoute();
    const response = await POST(postWith(tokenRequestBody));

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("Create your candidate profile before uploading a resume.");
  });

  it("onUploadCompleted commits using the server-set tokenPayload's candidateProfileId", async () => {
    handleUploadMock.mockImplementation(async ({ onUploadCompleted }) => {
      await onUploadCompleted({
        blob: { url: "https://blob.example.invalid/resume-xyz.pdf" },
        tokenPayload: JSON.stringify({ candidateProfileId: "profile-1" }),
      });
      return { type: "blob.upload-completed", response: "ok" };
    });

    const { POST } = await importRoute();
    const response = await POST(postWith({ type: "blob.upload-completed", payload: {} }));

    expect(response.status).toBe(200);
    expect(commitResumeUploadMock).toHaveBeenCalledWith("profile-1", "https://blob.example.invalid/resume-xyz.pdf");
  });

  it("onUploadCompleted never commits when tokenPayload is missing", async () => {
    handleUploadMock.mockImplementation(async ({ onUploadCompleted }) => {
      await onUploadCompleted({ blob: { url: "https://blob.example.invalid/resume-xyz.pdf" }, tokenPayload: null });
      return { type: "blob.upload-completed", response: "ok" };
    });

    const { POST } = await importRoute();
    await POST(postWith({ type: "blob.upload-completed", payload: {} }));

    expect(commitResumeUploadMock).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid JSON body without throwing", async () => {
    const { POST } = await importRoute();
    const badRequest = new Request("http://localhost/api/candidate/resume/upload", {
      method: "POST",
      body: "not json",
      headers: { "content-type": "application/json" },
    });

    const response = await POST(badRequest);
    expect(response.status).toBe(400);
  });
});
