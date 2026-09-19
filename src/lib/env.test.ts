import { describe, expect, it } from "vitest";
import { checkEnv, validateEnvOnce, __resetEnvValidationForTests } from "@/lib/env";

const FULLY_CONFIGURED_ENV = {
  DATABASE_URL: "postgresql://example.invalid/db",
  BETTER_AUTH_SECRET: "test-secret-value",
  BETTER_AUTH_URL: "http://localhost:3000",
  JOB_EXPIRY_CRON_SECRET: "test-cron-secret",
  AI_MODERATION_TRIGGER_SECRET: "test-moderation-secret",
  BLOB_READ_WRITE_TOKEN: "test-blob-token",
} as unknown as NodeJS.ProcessEnv;

describe("checkEnv", () => {
  it("reports nothing missing when every var is present", () => {
    expect(checkEnv(FULLY_CONFIGURED_ENV)).toEqual({ missingRequired: [], missingRecommended: [] });
  });

  it("reports missing required vars by name only", () => {
    const partial = { ...FULLY_CONFIGURED_ENV, DATABASE_URL: undefined } as unknown as NodeJS.ProcessEnv;
    const result = checkEnv(partial);
    expect(result.missingRequired).toEqual(["DATABASE_URL"]);
  });

  it("reports missing recommended vars separately from required vars", () => {
    const partial = {
      ...FULLY_CONFIGURED_ENV,
      JOB_EXPIRY_CRON_SECRET: undefined,
      AI_MODERATION_TRIGGER_SECRET: undefined,
    } as unknown as NodeJS.ProcessEnv;
    const result = checkEnv(partial);
    expect(result.missingRequired).toEqual([]);
    expect(result.missingRecommended).toEqual(["JOB_EXPIRY_CRON_SECRET", "AI_MODERATION_TRIGGER_SECRET"]);
  });

  it("treats a missing BETTER_AUTH_URL as recommended, never required — Better Auth itself only warns and falls back to a request-derived origin when it's unset, it does not fail (verified against node_modules/better-auth/dist/context/create-context.mjs)", () => {
    const partial = { ...FULLY_CONFIGURED_ENV, BETTER_AUTH_URL: undefined } as unknown as NodeJS.ProcessEnv;
    const result = checkEnv(partial);
    expect(result.missingRequired).toEqual([]);
    expect(result.missingRecommended).toEqual(["BETTER_AUTH_URL"]);
  });

  it("treats a missing BLOB_READ_WRITE_TOKEN as recommended, never required — only the candidate resume feature needs it, and @vercel/blob itself fails closed for that one feature when it's unset", () => {
    const partial = { ...FULLY_CONFIGURED_ENV, BLOB_READ_WRITE_TOKEN: undefined } as unknown as NodeJS.ProcessEnv;
    const result = checkEnv(partial);
    expect(result.missingRequired).toEqual([]);
    expect(result.missingRecommended).toEqual(["BLOB_READ_WRITE_TOKEN"]);
  });

  it("never includes actual secret values in its result, only names", () => {
    const result = checkEnv(FULLY_CONFIGURED_ENV);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("test-secret-value");
    expect(serialized).not.toContain("test-cron-secret");
  });
});

describe("validateEnvOnce", () => {
  it("throws in production when a required var is missing", () => {
    __resetEnvValidationForTests();
    const broken = {
      ...FULLY_CONFIGURED_ENV,
      BETTER_AUTH_SECRET: undefined,
      NODE_ENV: "production",
    } as unknown as NodeJS.ProcessEnv;
    expect(() => validateEnvOnce(broken)).toThrow(/BETTER_AUTH_SECRET/);
  });

  it("does not throw in production when only BETTER_AUTH_URL is missing (the exact first-deployment scenario this was fixed for)", () => {
    __resetEnvValidationForTests();
    const noSiteUrlYet = {
      ...FULLY_CONFIGURED_ENV,
      BETTER_AUTH_URL: undefined,
      NODE_ENV: "production",
    } as unknown as NodeJS.ProcessEnv;
    expect(() => validateEnvOnce(noSiteUrlYet)).not.toThrow();
  });

  it("does not throw in development when a required var is missing (warns instead)", () => {
    __resetEnvValidationForTests();
    const broken = {
      ...FULLY_CONFIGURED_ENV,
      BETTER_AUTH_SECRET: undefined,
      NODE_ENV: "development",
    } as unknown as NodeJS.ProcessEnv;
    expect(() => validateEnvOnce(broken)).not.toThrow();
  });

  it("only runs its check once per process (subsequent calls are no-ops)", () => {
    __resetEnvValidationForTests();
    validateEnvOnce(FULLY_CONFIGURED_ENV);
    const broken = {
      ...FULLY_CONFIGURED_ENV,
      BETTER_AUTH_SECRET: undefined,
      NODE_ENV: "production",
    } as unknown as NodeJS.ProcessEnv;
    // Already validated once above; this must not throw even though
    // this second call's env looks broken.
    expect(() => validateEnvOnce(broken)).not.toThrow();
  });
});
