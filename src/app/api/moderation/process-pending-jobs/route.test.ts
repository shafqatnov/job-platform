import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetSecureTriggerBucketsForTests } from "@/lib/security/secureTrigger";

const processPendingJobsMock = vi.fn();
vi.mock("@/services/moderation/processPendingJobs", () => ({
  processPendingJobs: (...args: unknown[]) => processPendingJobsMock(...args),
}));

const ENV_VAR = "AI_MODERATION_TRIGGER_SECRET";
const REAL_SECRET = "moderation-secret-for-tests-only";

async function importRoute() {
  return import("@/app/api/moderation/process-pending-jobs/route");
}

function postWith(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/moderation/process-pending-jobs", { method: "POST", headers });
}

function getWith(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/moderation/process-pending-jobs", { method: "GET", headers });
}

describe("POST /api/moderation/process-pending-jobs", () => {
  const originalValue = process.env[ENV_VAR];

  beforeEach(() => {
    __resetSecureTriggerBucketsForTests();
    processPendingJobsMock.mockReset();
    processPendingJobsMock.mockResolvedValue({ processed: 3, autoApproved: 1, sentToReview: 2 });
    process.env[ENV_VAR] = REAL_SECRET;
  });

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env[ENV_VAR];
    } else {
      process.env[ENV_VAR] = originalValue;
    }
  });

  it("rejects an unauthenticated request with 401 and never calls the service", async () => {
    const { POST } = await importRoute();
    const response = await POST(postWith());
    expect(response.status).toBe(401);
    expect(processPendingJobsMock).not.toHaveBeenCalled();
  });

  it("rejects a wrong-secret request with 401 and never calls the service", async () => {
    const { POST } = await importRoute();
    const response = await POST(postWith({ authorization: "Bearer wrong-secret" }));
    expect(response.status).toBe(401);
    expect(processPendingJobsMock).not.toHaveBeenCalled();
  });

  it("accepts a correct-secret request, calls the service, and returns its summary", async () => {
    const { POST } = await importRoute();
    const response = await POST(postWith({ authorization: `Bearer ${REAL_SECRET}` }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ success: true, processed: 3, autoApproved: 1, sentToReview: 2 });
    expect(processPendingJobsMock).toHaveBeenCalledTimes(1);
  });

  it("never includes the configured secret in any response body (success or failure)", async () => {
    const { POST } = await importRoute();

    const unauthorized = await POST(postWith());
    expect(await unauthorized.text()).not.toContain(REAL_SECRET);

    __resetSecureTriggerBucketsForTests();
    const authorized = await POST(postWith({ authorization: `Bearer ${REAL_SECRET}` }));
    expect(await authorized.text()).not.toContain(REAL_SECRET);
  });
});

describe("GET /api/moderation/process-pending-jobs (Vercel Cron compatibility)", () => {
  const originalValue = process.env[ENV_VAR];

  beforeEach(() => {
    __resetSecureTriggerBucketsForTests();
    processPendingJobsMock.mockReset();
    processPendingJobsMock.mockResolvedValue({ processed: 3, autoApproved: 1, sentToReview: 2 });
    process.env[ENV_VAR] = REAL_SECRET;
  });

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env[ENV_VAR];
    } else {
      process.env[ENV_VAR] = originalValue;
    }
  });

  it("rejects an unauthenticated GET request with 401", async () => {
    const { GET } = await importRoute();
    const response = await GET(getWith());
    expect(response.status).toBe(401);
    expect(processPendingJobsMock).not.toHaveBeenCalled();
  });

  it("accepts a correct-secret GET request exactly like POST (same handler)", async () => {
    const { GET } = await importRoute();
    const response = await GET(getWith({ authorization: `Bearer ${REAL_SECRET}` }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ success: true, processed: 3, autoApproved: 1, sentToReview: 2 });
  });
});
