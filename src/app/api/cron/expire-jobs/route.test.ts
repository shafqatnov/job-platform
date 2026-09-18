import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetSecureTriggerBucketsForTests } from "@/lib/security/secureTrigger";

const expireDueJobsMock = vi.fn();
vi.mock("@/services/jobs/expireJobs", () => ({
  expireDueJobs: (...args: unknown[]) => expireDueJobsMock(...args),
}));

const ENV_VAR = "JOB_EXPIRY_CRON_SECRET";
const REAL_SECRET = "cron-secret-for-tests-only";

async function importRoute() {
  return import("@/app/api/cron/expire-jobs/route");
}

function postWith(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/cron/expire-jobs", { method: "POST", headers });
}

function getWith(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/cron/expire-jobs", { method: "GET", headers });
}

describe("POST /api/cron/expire-jobs", () => {
  const originalValue = process.env[ENV_VAR];

  beforeEach(() => {
    __resetSecureTriggerBucketsForTests();
    expireDueJobsMock.mockReset();
    expireDueJobsMock.mockResolvedValue({ expiredCount: 2 });
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
    expect(expireDueJobsMock).not.toHaveBeenCalled();
  });

  it("rejects a wrong-secret request with 401 and never calls the service", async () => {
    const { POST } = await importRoute();
    const response = await POST(postWith({ authorization: "Bearer wrong-secret" }));
    expect(response.status).toBe(401);
    expect(expireDueJobsMock).not.toHaveBeenCalled();
  });

  it("accepts a correct-secret request, calls the service, and returns its result", async () => {
    const { POST } = await importRoute();
    const response = await POST(postWith({ authorization: `Bearer ${REAL_SECRET}` }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ success: true, expiredCount: 2 });
    expect(expireDueJobsMock).toHaveBeenCalledTimes(1);
  });

  it("never includes the configured secret in any response body (success or failure)", async () => {
    const { POST } = await importRoute();

    const unauthorized = await POST(postWith());
    const unauthorizedText = await unauthorized.text();
    expect(unauthorizedText).not.toContain(REAL_SECRET);

    __resetSecureTriggerBucketsForTests();
    const authorized = await POST(postWith({ authorization: `Bearer ${REAL_SECRET}` }));
    const authorizedText = await authorized.text();
    expect(authorizedText).not.toContain(REAL_SECRET);
  });
});

describe("GET /api/cron/expire-jobs (Vercel Cron compatibility)", () => {
  const originalValue = process.env[ENV_VAR];

  beforeEach(() => {
    __resetSecureTriggerBucketsForTests();
    expireDueJobsMock.mockReset();
    expireDueJobsMock.mockResolvedValue({ expiredCount: 2 });
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
    expect(expireDueJobsMock).not.toHaveBeenCalled();
  });

  it("accepts a correct-secret GET request exactly like POST (same handler)", async () => {
    const { GET } = await importRoute();
    const response = await GET(getWith({ authorization: `Bearer ${REAL_SECRET}` }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ success: true, expiredCount: 2 });
  });
});
