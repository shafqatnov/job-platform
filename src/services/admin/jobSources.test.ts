import crypto from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { listJobSources, setJobSourceEnabled } from "@/services/admin/jobSources";

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

  it("3. admin can enable a disabled source", async () => {
    const source = await createTestSource({ enabled: false });

    const result = await setJobSourceEnabled(source.id, true);

    expect(result).toEqual({ success: true });
  });

  it("3b. admin can disable an enabled source", async () => {
    const source = await createTestSource({ enabled: true });

    const result = await setJobSourceEnabled(source.id, false);

    expect(result).toEqual({ success: true });
  });

  it("4. the enabled state persists and is reflected on the next read", async () => {
    const source = await createTestSource({ enabled: false });

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
    const sourceA = await createTestSource({ enabled: false });
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
});
