import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkSecureTrigger, __resetSecureTriggerBucketsForTests } from "@/lib/security/secureTrigger";

const ENV_VAR = "TEST_TRIGGER_SECRET";
const REAL_SECRET = "correct-horse-battery-staple-0123456789";

function requestWith(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/test-trigger", { method: "POST", headers });
}

describe("checkSecureTrigger", () => {
  const originalValue = process.env[ENV_VAR];

  beforeEach(() => {
    __resetSecureTriggerBucketsForTests();
    process.env[ENV_VAR] = REAL_SECRET;
  });

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env[ENV_VAR];
    } else {
      process.env[ENV_VAR] = originalValue;
    }
  });

  it("rejects with 401 when the env var secret is not configured at all", () => {
    delete process.env[ENV_VAR];
    const result = checkSecureTrigger(requestWith({ authorization: `Bearer ${REAL_SECRET}` }), {
      secretEnvVar: ENV_VAR,
      bucketKey: "test:no-env",
    });
    expect(result).toEqual({ ok: false, status: 401 });
  });

  it("rejects with 401 when no authorization header is present", () => {
    const result = checkSecureTrigger(requestWith(), {
      secretEnvVar: ENV_VAR,
      bucketKey: "test:no-header",
    });
    expect(result).toEqual({ ok: false, status: 401 });
  });

  it("rejects with 401 for a non-Bearer authorization header", () => {
    const result = checkSecureTrigger(requestWith({ authorization: `Basic ${REAL_SECRET}` }), {
      secretEnvVar: ENV_VAR,
      bucketKey: "test:basic-auth",
    });
    expect(result).toEqual({ ok: false, status: 401 });
  });

  it("rejects with 401 for a wrong secret", () => {
    const result = checkSecureTrigger(requestWith({ authorization: "Bearer totally-wrong-secret" }), {
      secretEnvVar: ENV_VAR,
      bucketKey: "test:wrong-secret",
    });
    expect(result).toEqual({ ok: false, status: 401 });
  });

  it("rejects with 401 for a correct-length but wrong secret (no length side-channel)", () => {
    const sameLengthWrong = "x".repeat(REAL_SECRET.length);
    const result = checkSecureTrigger(requestWith({ authorization: `Bearer ${sameLengthWrong}` }), {
      secretEnvVar: ENV_VAR,
      bucketKey: "test:same-length-wrong",
    });
    expect(result).toEqual({ ok: false, status: 401 });
  });

  it("accepts a correct secret", () => {
    const result = checkSecureTrigger(requestWith({ authorization: `Bearer ${REAL_SECRET}` }), {
      secretEnvVar: ENV_VAR,
      bucketKey: "test:correct-secret",
    });
    expect(result).toEqual({ ok: true });
  });

  it("rate-limits after the configured max requests within the window, regardless of secret correctness", () => {
    const bucketKey = "test:rate-limit";
    for (let i = 0; i < 3; i += 1) {
      const result = checkSecureTrigger(requestWith({ authorization: `Bearer ${REAL_SECRET}` }), {
        secretEnvVar: ENV_VAR,
        bucketKey,
        max: 3,
        windowMs: 60_000,
      });
      expect(result).toEqual({ ok: true });
    }

    const limited = checkSecureTrigger(requestWith({ authorization: `Bearer ${REAL_SECRET}` }), {
      secretEnvVar: ENV_VAR,
      bucketKey,
      max: 3,
      windowMs: 60_000,
    });
    expect(limited).toEqual({ ok: false, status: 429 });
  });

  it("keeps separate rate-limit buckets per bucketKey", () => {
    const configA = { secretEnvVar: ENV_VAR, bucketKey: "test:bucket-a", max: 1, windowMs: 60_000 };
    const configB = { secretEnvVar: ENV_VAR, bucketKey: "test:bucket-b", max: 1, windowMs: 60_000 };
    const req = requestWith({ authorization: `Bearer ${REAL_SECRET}` });

    expect(checkSecureTrigger(req, configA)).toEqual({ ok: true });
    expect(checkSecureTrigger(req, configA)).toEqual({ ok: false, status: 429 });
    // A flood against bucket A must never affect bucket B.
    expect(checkSecureTrigger(req, configB)).toEqual({ ok: true });
  });

  it("never includes the configured secret anywhere in its return value", () => {
    const result = checkSecureTrigger(requestWith({ authorization: `Bearer ${REAL_SECRET}` }), {
      secretEnvVar: ENV_VAR,
      bucketKey: "test:no-leak",
    });
    expect(JSON.stringify(result)).not.toContain(REAL_SECRET);
  });
});
