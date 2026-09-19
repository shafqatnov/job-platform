import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { updateEmployerCompany } from "@/services/employers/updateEmployerCompany";
import { getEmployerCompany } from "@/services/employers/getEmployerCompany";
import {
  createModerationTestFixtures,
  createTestJob,
  cleanupModerationTestFixtures,
  type ModerationTestFixtures,
} from "@/test-utils/moderationFixtures";

describe("updateEmployerCompany (real dev database, temporary fixtures)", () => {
  let employerA: ModerationTestFixtures;
  let employerB: ModerationTestFixtures;
  let countrySlug: string;

  beforeAll(async () => {
    employerA = await createModerationTestFixtures();
    employerB = await createModerationTestFixtures();
    const country = await prisma.country.findUniqueOrThrow({
      where: { id: employerA.countryId },
      select: { urlSlug: true },
    });
    countrySlug = country.urlSlug;
  });

  afterAll(async () => {
    await cleanupModerationTestFixtures(employerA);
    await cleanupModerationTestFixtures(employerB);
  });

  function baseInput(userId: string, overrides: Partial<Parameters<typeof updateEmployerCompany>[0]> = {}) {
    return {
      userId,
      name: "[AI MODERATION TEST] Renamed Company",
      websiteUrl: "https://example.com",
      description: "An updated company description for this automated test.",
      countrySlug,
      ...overrides,
    };
  }

  it("1. employer can edit their own company", async () => {
    const result = await updateEmployerCompany(baseInput(employerA.userId));

    expect(result).toEqual({ success: true });

    const updated = await prisma.company.findUniqueOrThrow({
      where: { id: employerA.companyId },
      select: { name: true, websiteUrl: true, description: true },
    });
    expect(updated.name).toBe("[AI MODERATION TEST] Renamed Company");
    expect(updated.websiteUrl).toBe("https://example.com");
    expect(updated.description).toBe("An updated company description for this automated test.");
  });

  it("2. an employer's edit never touches another employer's company (companyId is derived from session, never client-supplied)", async () => {
    const beforeCompany = await prisma.company.findUniqueOrThrow({
      where: { id: employerB.companyId },
      select: { name: true },
    });

    // Employer A submits an edit — updateEmployerCompany has no companyId
    // parameter at all, so there is no way for this call to name
    // employer B's company even if it wanted to.
    await updateEmployerCompany(baseInput(employerA.userId, { name: "[AI MODERATION TEST] A's New Name" }));

    const afterCompany = await prisma.company.findUniqueOrThrow({
      where: { id: employerB.companyId },
      select: { name: true },
    });
    expect(afterCompany.name).toBe(beforeCompany.name);
  });

  it("3a. rejects an empty company name without writing to the database", async () => {
    const before = await prisma.company.findUniqueOrThrow({ where: { id: employerA.companyId }, select: { name: true } });

    const result = await updateEmployerCompany(baseInput(employerA.userId, { name: "   " }));

    expect(result).toEqual({ success: false, fieldErrors: { name: "Company name is required." } });
    const after = await prisma.company.findUniqueOrThrow({ where: { id: employerA.companyId }, select: { name: true } });
    expect(after.name).toBe(before.name);
  });

  it("3b. rejects an invalid website URL", async () => {
    const result = await updateEmployerCompany(baseInput(employerA.userId, { websiteUrl: "not-a-url" }));

    expect(result).toEqual({
      success: false,
      fieldErrors: { websiteUrl: "Please enter a valid http:// or https:// URL." },
    });
  });

  it("3c. rejects an overly long description", async () => {
    const result = await updateEmployerCompany(baseInput(employerA.userId, { description: "x".repeat(2001) }));

    expect(result).toEqual({
      success: false,
      fieldErrors: { description: "Description must be 2000 characters or fewer." },
    });
  });

  it("3d. rejects an unrecognized country slug", async () => {
    const result = await updateEmployerCompany(baseInput(employerA.userId, { countrySlug: "not-a-real-country" }));

    expect(result).toEqual({ success: false, fieldErrors: { country: "Please select a valid country." } });
  });

  it("3e. website and description are optional — blank values clear them rather than failing", async () => {
    const result = await updateEmployerCompany(
      baseInput(employerA.userId, { websiteUrl: "", description: "", countrySlug: "" })
    );

    expect(result).toEqual({ success: true });
    const updated = await prisma.company.findUniqueOrThrow({
      where: { id: employerA.companyId },
      select: { websiteUrl: true, description: true, countryId: true },
    });
    expect(updated.websiteUrl).toBeNull();
    expect(updated.description).toBeNull();
    expect(updated.countryId).toBeNull();
  });

  it("4. the updated company name is what getEmployerCompany (used by the Post Job page) returns", async () => {
    await updateEmployerCompany(baseInput(employerA.userId, { name: "[AI MODERATION TEST] Post-Edit Name" }));

    const employerCompany = await getEmployerCompany(employerA.userId);
    expect(employerCompany?.companyName).toBe("[AI MODERATION TEST] Post-Edit Name");
  });

  it("5. existing jobs continue pointing at the same companyId after the company is edited", async () => {
    const job = await createTestJob(employerA);

    await updateEmployerCompany(baseInput(employerA.userId, { name: "[AI MODERATION TEST] Renamed Again" }));

    const jobAfter = await prisma.job.findUniqueOrThrow({ where: { id: job.id }, select: { companyId: true } });
    expect(jobAfter.companyId).toBe(employerA.companyId);
  });

  it("returns a form error rather than throwing when the acting user has no company yet", async () => {
    const orphanUser = await prisma.user.create({
      data: {
        email: `ai-moderation-test-orphan-${crypto.randomUUID()}@example.invalid`,
        name: "[AI MODERATION TEST] Orphan Employer",
        role: "employer",
        status: "active",
        emailVerified: false,
      },
      select: { id: true },
    });

    try {
      const result = await updateEmployerCompany(baseInput(orphanUser.id));
      expect(result).toEqual({
        success: false,
        fieldErrors: {},
        formError: "Set up your company before editing it.",
      });
    } finally {
      await prisma.user.delete({ where: { id: orphanUser.id } });
    }
  });
});
