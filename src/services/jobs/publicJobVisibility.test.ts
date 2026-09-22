import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { publicJobVisibilityWhere } from "@/services/jobs/publicJobVisibility";
import { prisma } from "@/lib/prisma";
import {
  createModerationTestFixtures,
  createTestJob,
  cleanupModerationTestFixtures,
} from "@/test-utils/moderationFixtures";

const SOURCE = readFileSync(new URL("./publicJobVisibility.ts", import.meta.url), "utf8");

describe("publicJobVisibilityWhere", () => {
  it("never imports OpenAI or any Greenhouse pipeline module — purely a Prisma where-fragment", () => {
    expect(SOURCE).not.toMatch(/from ["']openai["']/i);
    expect(SOURCE).not.toMatch(/greenhouse/i);
  });

  it("excludes only exact bracketed fixture-marker prefixes, never a bare 'test'/'qa' keyword", () => {
    // "Test Inspector" contains neither confirmed marker as a PREFIX —
    // this is a structural sanity check on the marker list itself, not
    // a query test (see getPublicJobs.test.ts for the real DB behavior).
    expect(SOURCE).toContain('"[IMPORT TEST]"');
    expect(SOURCE).toContain('"[LOCATION REVIEW TEST]"');
    expect(SOURCE).not.toMatch(/title:\s*{\s*contains:\s*["']test["']/i);
  });

  it("real dev database: excludes an [IMPORT TEST] job and keeps a legitimate 'Test Inspector' job, via the shared function directly", async () => {
    const fixtures = await createModerationTestFixtures();
    try {
      const fixtureJob = await createTestJob(fixtures, { title: "[IMPORT TEST] Backend Engineer", status: "active" });
      const legitimateJob = await createTestJob(fixtures, { title: "Test Inspector", status: "active" });

      const visibleIds = (
        await prisma.job.findMany({ where: publicJobVisibilityWhere(), select: { id: true } })
      ).map((j) => j.id);

      expect(visibleIds).not.toContain(fixtureJob.id);
      expect(visibleIds).toContain(legitimateJob.id);
    } finally {
      await cleanupModerationTestFixtures(fixtures);
    }
  });

  it("a [GH LOCATION WIRING TEST] job (like the two other title markers) is excluded even while active", async () => {
    const fixtures = await createModerationTestFixtures();
    try {
      const job = await createTestJob(fixtures, { title: "[GH LOCATION WIRING TEST] Backend Engineer", status: "active" });
      const visibleIds = (
        await prisma.job.findMany({ where: publicJobVisibilityWhere(), select: { id: true } })
      ).map((j) => j.id);
      expect(visibleIds).not.toContain(job.id);
    } finally {
      await cleanupModerationTestFixtures(fixtures);
    }
  });

  /**
   * The orphaned-disposable-fixture safeguard (DISPOSABLE_TEST_POSTER_EMAIL_SUFFIX
   * + ORPHANED_TEST_FIXTURE_MAX_AGE_MS in publicJobVisibility.ts). This is the
   * fix for the actual reported production leak: a "[AI MODERATION TEST]" job
   * whose test process never ran its cleanup. Backdating createdAt (rather than
   * waiting a real hour) is the same "simulate elapsed time deterministically"
   * technique this codebase already uses for expiresAt-based tests.
   */
  describe("orphaned disposable-fixture safeguard (real dev database, temporary fixtures)", () => {
    it("an [AI MODERATION TEST] job stays visible while fresh (existing tests rely on this)", async () => {
      const fixtures = await createModerationTestFixtures();
      try {
        const job = await createTestJob(fixtures, { title: "[AI MODERATION TEST] Fresh Fixture", status: "active" });
        const visibleIds = (
          await prisma.job.findMany({ where: publicJobVisibilityWhere(), select: { id: true } })
        ).map((j) => j.id);
        expect(visibleIds).toContain(job.id);
      } finally {
        await cleanupModerationTestFixtures(fixtures);
      }
    });

    it("an [AI MODERATION TEST] job becomes excluded once orphaned (createdAt older than the safety threshold)", async () => {
      const fixtures = await createModerationTestFixtures();
      try {
        const job = await createTestJob(fixtures, { title: "[AI MODERATION TEST] Orphaned Fixture", status: "active" });
        await prisma.job.update({
          where: { id: job.id },
          data: { createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
        });
        const visibleIds = (
          await prisma.job.findMany({ where: publicJobVisibilityWhere(), select: { id: true } })
        ).map((j) => j.id);
        expect(visibleIds).not.toContain(job.id);
      } finally {
        await cleanupModerationTestFixtures(fixtures);
      }
    });

    it("generalizes to ANY future @example.invalid-posted fixture, not just the known bracketed markers", async () => {
      const fixtures = await createModerationTestFixtures();
      try {
        const job = await createTestJob(fixtures, {
          title: "Totally Ordinary Job Title With No Bracketed Marker At All",
          status: "active",
        });
        await prisma.job.update({
          where: { id: job.id },
          data: { createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
        });
        const visibleIds = (
          await prisma.job.findMany({ where: publicJobVisibilityWhere(), select: { id: true } })
        ).map((j) => j.id);
        expect(visibleIds).not.toContain(job.id);
      } finally {
        await cleanupModerationTestFixtures(fixtures);
      }
    });

    it("never excludes a job posted by a non-@example.invalid (i.e. real-shaped) user, no matter how old", async () => {
      const fixtures = await createModerationTestFixtures();
      // A one-off poster whose email does NOT end in "@example.invalid" —
      // simulating a genuine account, distinct from this suite's own
      // disposable fixture user, to prove the age check alone (with a
      // real-shaped poster) never excludes anything.
      const realShapedUser = await prisma.user.create({
        data: {
          email: `public-job-visibility-test-real-shaped-${crypto.randomUUID()}@jobnura-test.com`,
          name: "Real-Shaped Poster",
          role: "employer",
          status: "active",
          emailVerified: false,
        },
        select: { id: true },
      });
      try {
        const job = await prisma.job.create({
          data: {
            companyId: fixtures.companyId,
            countryId: fixtures.countryId,
            cityId: fixtures.cityId,
            categoryId: fixtures.categoryId,
            postedByUserId: realShapedUser.id,
            title: "Test Inspector",
            description: "A temporary automated-test job simulating a real, non-fixture poster.",
            slug: `real-shaped-poster-test-${crypto.randomUUID()}`,
            status: "active",
            applicationMethod: "on_platform",
            createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
          },
          select: { id: true },
        });
        try {
          const visibleIds = (
            await prisma.job.findMany({ where: publicJobVisibilityWhere(), select: { id: true } })
          ).map((j) => j.id);
          expect(visibleIds).toContain(job.id);
        } finally {
          await prisma.job.delete({ where: { id: job.id } });
        }
      } finally {
        await prisma.user.delete({ where: { id: realShapedUser.id } });
        await cleanupModerationTestFixtures(fixtures);
      }
    });
  });
});
