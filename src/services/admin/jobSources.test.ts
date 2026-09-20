import crypto from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { listJobSources, setJobSourceEnabled, setJobSourceAuthorization } from "@/services/admin/jobSources";

const TEST_LABEL_PREFIX = "[JOB SOURCE TEST]";

describe("jobSources (real dev database, temporary fixtures)", () => {
  const createdSourceIds: string[] = [];

  async function createTestSource(overrides: Partial<Parameters<typeof prisma.authorizedJobSource.create>[0]["data"]> = {}) {
    const uniqueSuffix = crypto.randomUUID();
    const source = await prisma.authorizedJobSource.create({
      data: {
        name: `${TEST_LABEL_PREFIX} Source ${uniqueSuffix.slice(0, 8)}`,
        sourceType: "API",
        ...overrides,
      },
    });
    createdSourceIds.push(source.id);
    return source;
  }

  afterAll(async () => {
    await prisma.authorizedJobSource.deleteMany({ where: { id: { in: createdSourceIds } } });
  });

  it("1. admin-facing read returns sources from the registry", async () => {
    const source = await createTestSource();

    const sources = await listJobSources();

    expect(sources.some((row) => row.id === source.id)).toBe(true);
  });

  it("3. admin can enable a disabled, authorization-verified source", async () => {
    const source = await createTestSource({ enabled: false, authorizationStatus: "verified" });

    const result = await setJobSourceEnabled(source.id, true);

    expect(result).toEqual({ success: true });
  });

  it("3b. admin can disable an enabled source", async () => {
    const source = await createTestSource({ enabled: true });

    const result = await setJobSourceEnabled(source.id, false);

    expect(result).toEqual({ success: true });
  });

  it("4. the enabled state persists and is reflected on the next read", async () => {
    const source = await createTestSource({ enabled: false, authorizationStatus: "verified" });

    await setJobSourceEnabled(source.id, true);
    const sources = await listJobSources();
    const updated = sources.find((row) => row.id === source.id);

    expect(updated?.enabled).toBe(true);
  });

  it("5. a configured credential env var name is never returned — only a derived boolean", async () => {
    const originalValue = process.env.__JOB_SOURCE_TEST_CREDENTIAL__;
    process.env.__JOB_SOURCE_TEST_CREDENTIAL__ = "sk-not-a-real-secret-value";
    try {
      const source = await createTestSource({ credentialEnvVarName: "__JOB_SOURCE_TEST_CREDENTIAL__" });

      const sources = await listJobSources();
      const row = sources.find((r) => r.id === source.id);

      expect(row?.hasCredentialConfigured).toBe(true);
      expect(Object.keys(row ?? {})).not.toContain("credentialEnvVarName");
      expect(JSON.stringify(row)).not.toContain("sk-not-a-real-secret-value");
    } finally {
      if (originalValue === undefined) {
        delete process.env.__JOB_SOURCE_TEST_CREDENTIAL__;
      } else {
        process.env.__JOB_SOURCE_TEST_CREDENTIAL__ = originalValue;
      }
    }
  });

  it("5b. a source with no credential configured reports hasCredentialConfigured as false", async () => {
    const source = await createTestSource({ credentialEnvVarName: null });

    const sources = await listJobSources();
    const row = sources.find((r) => r.id === source.id);

    expect(row?.hasCredentialConfigured).toBe(false);
  });

  it("6. multiple sources remain independent — enabling one never affects another", async () => {
    const sourceA = await createTestSource({ enabled: false, authorizationStatus: "verified" });
    const sourceB = await createTestSource({ enabled: false });

    await setJobSourceEnabled(sourceA.id, true);

    const sources = await listJobSources();
    expect(sources.find((r) => r.id === sourceA.id)?.enabled).toBe(true);
    expect(sources.find((r) => r.id === sourceB.id)?.enabled).toBe(false);
  });

  it("7. a disabled source is clearly represented as enabled: false", async () => {
    const source = await createTestSource({ enabled: false });

    const sources = await listJobSources();
    const row = sources.find((r) => r.id === source.id);

    expect(row?.enabled).toBe(false);
  });

  it("returns a safe error rather than throwing when the source does not exist", async () => {
    const result = await setJobSourceEnabled("00000000-0000-0000-0000-000000000000", true);

    expect(result).toEqual({ success: false, error: "Job source not found." });
  });

  describe("authorization gate", () => {
    it("1. an unverified source cannot be enabled", async () => {
      const source = await createTestSource({ enabled: false, authorizationStatus: "unverified" });

      const result = await setJobSourceEnabled(source.id, true);

      expect(result.success).toBe(false);
      const row = await prisma.authorizedJobSource.findUniqueOrThrow({ where: { id: source.id } });
      expect(row.enabled).toBe(false);
    });

    it("2. a verified source can be enabled", async () => {
      const source = await createTestSource({ enabled: false, authorizationStatus: "verified" });

      const result = await setJobSourceEnabled(source.id, true);

      expect(result).toEqual({ success: true });
    });

    it("3. an unverified source remains disabled after a rejected enable attempt", async () => {
      const source = await createTestSource({ enabled: false, authorizationStatus: "unverified" });

      await setJobSourceEnabled(source.id, true);

      const row = await prisma.authorizedJobSource.findUniqueOrThrow({ where: { id: source.id } });
      expect(row.enabled).toBe(false);
    });

    it("4. attempting to enable an unverified source returns a safe, specific error", async () => {
      const source = await createTestSource({ enabled: false, authorizationStatus: "unverified" });

      const result = await setJobSourceEnabled(source.id, true);

      expect(result).toEqual({
        success: false,
        error: "This source's usage authorization has not been verified yet. Mark it as verified before enabling it.",
      });
    });

    it("7. marking a source verified records a verification timestamp", async () => {
      const source = await createTestSource({ authorizationStatus: "unverified" });

      const result = await setJobSourceAuthorization(source.id, true, "Employer confirmed permission by email");

      expect(result).toEqual({ success: true });
      const row = await prisma.authorizedJobSource.findUniqueOrThrow({ where: { id: source.id } });
      expect(row.authorizationStatus).toBe("verified");
      expect(row.authorizationVerifiedAt).not.toBeNull();
      expect(row.authorizationReference).toBe("Employer confirmed permission by email");
    });

    it("8. marking a verified source unverified clears the verification timestamp and disables it", async () => {
      const source = await createTestSource({ authorizationStatus: "verified", authorizationVerifiedAt: new Date(), enabled: true });

      const result = await setJobSourceAuthorization(source.id, false, null);

      expect(result).toEqual({ success: true });
      const row = await prisma.authorizedJobSource.findUniqueOrThrow({ where: { id: source.id } });
      expect(row.authorizationStatus).toBe("unverified");
      expect(row.authorizationVerifiedAt).toBeNull();
      expect(row.enabled).toBe(false);
    });

    it("9. unrelated source configuration (name, sourceType, baseEndpoint) is untouched by an authorization change", async () => {
      const source = await createTestSource({
        name: `${TEST_LABEL_PREFIX} Config Preserved ${crypto.randomUUID().slice(0, 8)}`,
        baseEndpoint: "https://example-source.invalid/jobs",
      });

      await setJobSourceAuthorization(source.id, true, "test reference");

      const row = await prisma.authorizedJobSource.findUniqueOrThrow({ where: { id: source.id } });
      expect(row.name).toBe(source.name);
      expect(row.baseEndpoint).toBe("https://example-source.invalid/jobs");
      expect(row.sourceType).toBe(source.sourceType);
    });

    it("returns a safe error rather than throwing when authorizing a nonexistent source", async () => {
      const result = await setJobSourceAuthorization("00000000-0000-0000-0000-000000000000", true, null);

      expect(result).toEqual({ success: false, error: "Job source not found." });
    });

    it("a reference note is never required to mark a source verified", async () => {
      const source = await createTestSource();

      const result = await setJobSourceAuthorization(source.id, true, null);

      expect(result).toEqual({ success: true });
    });

    it("authorization reference is stored independently of credentialEnvVarName — the two are never conflated", async () => {
      const source = await createTestSource({ credentialEnvVarName: null });

      await setJobSourceAuthorization(source.id, true, "Employer emailed written approval on file");
      const row = await prisma.authorizedJobSource.findUniqueOrThrow({ where: { id: source.id } });

      expect(row.authorizationReference).toBe("Employer emailed written approval on file");
      expect(row.credentialEnvVarName).toBeNull();
    });
  });
});
