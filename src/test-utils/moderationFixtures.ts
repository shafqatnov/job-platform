import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { ApplicationMethod, JobStatus } from "@/generated/prisma/enums";

/**
 * Shared setup/teardown for the AI-moderation test suite. Uses the real
 * development database (never a mock DB) with clearly-labeled,
 * disposable fixtures — the actual real employer/company/job data in
 * this environment is never touched, since every fixture created here
 * uses its own freshly-generated `@example.invalid` user and a
 * "[AI MODERATION TEST]"-prefixed company/job title, and every test
 * file deletes everything it created in an `afterAll`/`afterEach` hook.
 * Country/City are READ, never created — these tests reuse whatever
 * real reference rows already exist. Category is the one exception:
 * it's created fresh per fixture set (see below) rather than reused.
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

  if (!country || !city) {
    throw new Error(
      "Reference data (Country/City) is missing in this database — the moderation test suite reuses real reference data and does not create its own."
    );
  }

  const uniqueSuffix = crypto.randomUUID();

  // A dedicated, disposable test Category — never a real production
  // category looked up via findFirst(). That used to pick "whichever
  // category Postgres returns first" with no deterministic ordering, so
  // its answer could silently change (and did: adding the Oil & Gas
  // child categories shifted it onto "Technology," a real category with
  // real jobs already on it) and corrupt any test asserting this
  // fixture's category starts with zero jobs. A fresh, uniquely-slugged
  // category every call can never collide with real data or with
  // another concurrently-running test's own fixture category.
  const category = await prisma.category.create({
    data: {
      name: `${TEST_LABEL_PREFIX} Category ${uniqueSuffix.slice(0, 8)}`,
      slug: `ai-mod-test-cat-${uniqueSuffix}`,
    },
    select: { id: true },
  });

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
  // Jobs deleted first — they hold the FK to this fixture's own
  // Category, so the category can only be removed once nothing still
  // references it. Matching on categoryId (not just postedByUserId) is
  // required: the imported-job publishing pipeline attributes a
  // published job to the shared "import system" user, not to this
  // fixture's own userId, so a test that publishes through that
  // pipeline using this fixture's category can otherwise leave a job
  // behind that postedByUserId alone would never find — and the
  // category delete below would then fail its foreign-key check. Since
  // this category is freshly created and uniquely slugged per fixture
  // set (never a shared/real category), every job on it is guaranteed
  // to be this fixture's own disposable test data.
  await prisma.job.deleteMany({ where: { OR: [{ postedByUserId: fixtures.userId }, { categoryId: fixtures.categoryId }] } });
  await prisma.employerProfile.deleteMany({ where: { userId: fixtures.userId } });
  await prisma.company.deleteMany({ where: { id: fixtures.companyId } });
  await prisma.user.deleteMany({ where: { id: fixtures.userId } });

  // A test that times out (a pre-existing characteristic of this suite
  // under real-database contention — see this module's own doc comment)
  // can leave its in-flight job-creation promise still running after
  // Vitest has already moved on; if that promise finally inserts its Job
  // row after the deleteMany above already ran, it lands here as an
  // orphan the rest of this cleanup never sees, and the category delete
  // below would otherwise throw and fail teardown for every other
  // fixture in the same process. Since this category is always a
  // disposable, uniquely-slugged test row (never shared/real data),
  // failing to remove it this one time is harmless — it simply waits to
  // be removed by a future cleanup run — so only this specific,
  // expected race is swallowed; any other error still propagates.
  try {
    await prisma.category.deleteMany({ where: { id: fixtures.categoryId } });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2003") {
      throw error;
    }
    console.warn(
      `cleanupModerationTestFixtures: left disposable test category ${fixtures.categoryId} in place — a job from a timed-out test still referenced it.`
    );
  }
}
