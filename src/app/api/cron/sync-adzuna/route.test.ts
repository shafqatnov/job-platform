import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetSecureTriggerBucketsForTests } from "@/lib/security/secureTrigger";

const syncAdzunaJobsMock = vi.fn();
vi.mock("@/services/sync/syncAdzunaJobs", () => ({
  syncAdzunaJobs: (...args: unknown[]) => syncAdzunaJobsMock(...args),
}));

const ENV_VAR = "ADZUNA_SYNC_TRIGGER_SECRET";
const REAL_SECRET = "adzuna-sync-secret-for-tests-only";

async function importRoute() {
  return import("@/app/api/cron/sync-adzuna/route");
}

function postWith(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/cron/sync-adzuna", { method: "POST", headers });
}

function getWith(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/cron/sync-adzuna", { method: "GET", headers });
}

describe("POST /api/cron/sync-adzuna", () => {
  const originalValue = process.env[ENV_VAR];

  beforeEach(() => {
    __resetSecureTriggerBucketsForTests();
    syncAdzunaJobsMock.mockReset();
    syncAdzunaJobsMock.mockResolvedValue({ ok: true, fetchedCount: 2, validCount: 2, invalidCount: 0, exactDuplicateCount: 0, possibleDuplicateCount: 0, publishedCount: 1, queuedForReviewCount: 1, rejectedCount: 0, failedCount: 0 });
  });

  afterEach(() => {
    if (originalValue === undefined) delete process.env[ENV_VAR];
    else process.env[ENV_VAR] = originalValue;
  });

  it("15. with no secret configured at all (the default, out-of-the-box state), every request is rejected and the sync never runs", async () => {
    delete process.env[ENV_VAR];
    const { POST } = await importRoute();

    const response = await POST(postWith({ authorization: "Bearer anything" }));

    expect(response.status).toBe(401);
    expect(syncAdzunaJobsMock).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated request with 401 and never calls the sync", async () => {
    process.env[ENV_VAR] = REAL_SECRET;
    const { POST } = await importRoute();

    const response = await POST(postWith());

    expect(response.status).toBe(401);
    expect(syncAdzunaJobsMock).not.toHaveBeenCalled();
  });

  it("rejects a wrong-secret request with 401 and never calls the sync", async () => {
    process.env[ENV_VAR] = REAL_SECRET;
    const { POST } = await importRoute();

    const response = await POST(postWith({ authorization: "Bearer wrong-secret" }));

    expect(response.status).toBe(401);
    expect(syncAdzunaJobsMock).not.toHaveBeenCalled();
  });

  it("accepts a correct-secret request, calls the sync, and returns its summary", async () => {
    process.env[ENV_VAR] = REAL_SECRET;
    const { POST } = await importRoute();

    const response = await POST(postWith({ authorization: `Bearer ${REAL_SECRET}` }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ success: true, ranSync: true, publishedCount: 1 });
    expect(syncAdzunaJobsMock).toHaveBeenCalledTimes(1);
  });

  it("when the sync itself stops safely (gate failure), the route still returns 200 with ranSync: false and the reason", async () => {
    process.env[ENV_VAR] = REAL_SECRET;
    syncAdzunaJobsMock.mockResolvedValue({ ok: false, reason: "disabled" });
    const { POST } = await importRoute();

    const response = await POST(postWith({ authorization: `Bearer ${REAL_SECRET}` }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ success: true, ranSync: false, reason: "disabled" });
  });

  it("never includes the configured secret in any response body (success or failure)", async () => {
    process.env[ENV_VAR] = REAL_SECRET;
    const { POST } = await importRoute();

    const unauthorized = await POST(postWith());
    expect(await unauthorized.text()).not.toContain(REAL_SECRET);

    __resetSecureTriggerBucketsForTests();
    const authorized = await POST(postWith({ authorization: `Bearer ${REAL_SECRET}` }));
    expect(await authorized.text()).not.toContain(REAL_SECRET);
  });
});

describe("GET /api/cron/sync-adzuna (Vercel Cron compatibility)", () => {
  const originalValue = process.env[ENV_VAR];

  beforeEach(() => {
    __resetSecureTriggerBucketsForTests();
    syncAdzunaJobsMock.mockReset();
    syncAdzunaJobsMock.mockResolvedValue({ ok: true, fetchedCount: 0, validCount: 0, invalidCount: 0, exactDuplicateCount: 0, possibleDuplicateCount: 0, publishedCount: 0, queuedForReviewCount: 0, rejectedCount: 0, failedCount: 0 });
    process.env[ENV_VAR] = REAL_SECRET;
  });

  afterEach(() => {
    if (originalValue === undefined) delete process.env[ENV_VAR];
    else process.env[ENV_VAR] = originalValue;
  });

  it("rejects an unauthenticated GET request with 401", async () => {
    const { GET } = await importRoute();
    const response = await GET(getWith());
    expect(response.status).toBe(401);
    expect(syncAdzunaJobsMock).not.toHaveBeenCalled();
  });

  it("accepts a correct-secret GET request exactly like POST (same handler)", async () => {
    const { GET } = await importRoute();
    const response = await GET(getWith({ authorization: `Bearer ${REAL_SECRET}` }));
    expect(response.status).toBe(200);
    expect(syncAdzunaJobsMock).toHaveBeenCalledTimes(1);
  });
});
