import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { ApplicationMethod, JobStatus } from "@/generated/prisma/enums";

/**
 * Shared setup/teardown for the AI-moderation test suite. Uses the real
 * development database (never a mock DB) with clearly-labeled,
 * disposable fixtures — the actual real employer/company/job data in
 * this environment is never touched, since every fixture created here
 * uses its own freshly-generated `@example.invalid` user and a
 * "[AI MODERATION TEST]"-prefixed company/job title, and every test
 * file deletes everything it created in an `afterAll`/`afterEach` hook.
 * Reference data (country/city/category) is READ, never created —
 * these tests reuse whatever real reference rows already exist rather
 * than inventing fake ones.
 */

export const TEST_LABEL_PREFIX = "[AI MODERATION TEST]";

export type ModerationTestFixtures = {
  userId: string;
  companyId: string;
  countryId: string;
  cityId: string;
  categoryId: string;
};

export async function createModerationTestFixtures(): Promise<ModerationTestFixtures> {
  const country = await prisma.country.findFirst({ select: { id: true } });
  const city = country ? await prisma.city.findFirst({ where: { countryId: country.id }, select: { id: true } }) : null;
  const category = await prisma.category.findFirst({ select: { id: true } });

  if (!country || !city || !category) {
    throw new Error(
      "Reference data (Country/City/Category) is missing in this database — the moderation test suite reuses real reference data and does not create its own."
    );
  }

  const uniqueSuffix = crypto.randomUUID();

  const user = await prisma.user.create({
    data: {
      email: `ai-moderation-test-${uniqueSuffix}@example.invalid`,
      name: `${TEST_LABEL_PREFIX} Employer`,
      role: "employer",
      status: "active",
      emailVerified: false,
    },
    select: { id: true },
  });

  const company = await prisma.company.create({
    data: {
      name: `${TEST_LABEL_PREFIX} Company ${uniqueSuffix.slice(0, 8)}`,
      slug: `ai-mod-test-co-${uniqueSuffix}`,
    },
    select: { id: true },
  });

  await prisma.employerProfile.create({ data: { userId: user.id, companyId: company.id } });

  return { userId: user.id, companyId: company.id, countryId: country.id, cityId: city.id, categoryId: category.id };
}

export type CreateTestJobOptions = {
  title?: string;
  description?: string;
  status?: JobStatus;
  applicationMethod?: ApplicationMethod;
  externalApplicationUrl?: string | null;
  expiresAt?: Date | null;
  deletedAt?: Date | null;
  /** Defaults to the fixture's own country/city — override to construct a different-location duplicate scenario. */
  countryId?: string;
  cityId?: string;
};

export async function createTestJob(
  fixtures: ModerationTestFixtures,
  options: CreateTestJobOptions = {}
): Promise<{ id: string; title: string }> {
  const uniqueSuffix = crypto.randomUUID();
  const title = options.title ?? `${TEST_LABEL_PREFIX} Job ${uniqueSuffix.slice(0, 8)}`;

  const job = await prisma.job.create({
    data: {
      companyId: fixtures.companyId,
      countryId: options.countryId ?? fixtures.countryId,
      cityId: options.cityId ?? fixtures.cityId,
      categoryId: fixtures.categoryId,
      postedByUserId: fixtures.userId,
      title,
      description: options.description ?? "A temporary automated-test job for the AI moderation pipeline.",
      slug: `ai-mod-test-${uniqueSuffix}`,
      status: options.status ?? "pending_review",
      applicationMethod: options.applicationMethod ?? "on_platform",
      externalApplicationUrl: options.externalApplicationUrl ?? null,
      expiresAt: options.expiresAt ?? null,
      deletedAt: options.deletedAt ?? null,
    },
    select: { id: true, title: true },
  });

  return job;
}

export async function cleanupModerationTestFixtures(fixtures: ModerationTestFixtures): Promise<void> {
  await prisma.job.deleteMany({ where: { postedByUserId: fixtures.userId } });
  await prisma.employerProfile.deleteMany({ where: { userId: fixtures.userId } });
  await prisma.company.deleteMany({ where: { id: fixtures.companyId } });
  await prisma.user.deleteMany({ where: { id: fixtures.userId } });
}
