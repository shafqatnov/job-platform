import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * Shared setup/teardown for the candidate-dashboard test suite (Version
 * 1.1 Phase 1) — mirrors src/test-utils/moderationFixtures.ts exactly:
 * real dev database, disposable `@example.invalid` users, everything
 * created here is deleted by cleanupCandidateTestFixtures. Reference
 * data (country/city) is READ, never created.
 */

export const CANDIDATE_TEST_LABEL_PREFIX = "[CANDIDATE DASHBOARD TEST]";

export type CandidateTestFixtures = {
  userId: string;
  candidateProfileId: string;
  countryId: string;
  cityId: string;
};

export async function createCandidateTestFixtures(): Promise<CandidateTestFixtures> {
  const country = await prisma.country.findFirst({ select: { id: true } });
  const city = country
    ? await prisma.city.findFirst({ where: { countryId: country.id }, select: { id: true } })
    : null;

  if (!country || !city) {
    throw new Error(
      "The candidate-dashboard test suite reuses real reference data and does not create its own — at least one Country and City must already exist in this database."
    );
  }

  const uniqueSuffix = crypto.randomUUID();

  const user = await prisma.user.create({
    data: {
      email: `candidate-dashboard-test-${uniqueSuffix}@example.invalid`,
      name: `${CANDIDATE_TEST_LABEL_PREFIX} Candidate`,
      role: "candidate",
      status: "active",
      emailVerified: false,
    },
    select: { id: true },
  });

  const profile = await prisma.candidateProfile.create({
    data: {
      userId: user.id,
      countryId: country.id,
      cityId: city.id,
      fullName: `${CANDIDATE_TEST_LABEL_PREFIX} Full Name`,
    },
    select: { id: true },
  });

  return { userId: user.id, candidateProfileId: profile.id, countryId: country.id, cityId: city.id };
}

export async function cleanupCandidateTestFixtures(fixtures: CandidateTestFixtures): Promise<void> {
  await prisma.savedJob.deleteMany({ where: { candidateProfileId: fixtures.candidateProfileId } });
  await prisma.application.deleteMany({ where: { candidateProfileId: fixtures.candidateProfileId } });
  await prisma.candidateProfile.deleteMany({ where: { id: fixtures.candidateProfileId } });
  await prisma.user.deleteMany({ where: { id: fixtures.userId } });
}
