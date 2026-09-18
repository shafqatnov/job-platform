import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getCandidateProfile } from "@/services/candidates/getCandidateProfile";
import { updateCandidateProfile } from "@/services/candidates/updateCandidateProfile";
import {
  createCandidateTestFixtures,
  cleanupCandidateTestFixtures,
  type CandidateTestFixtures,
} from "@/test-utils/candidateFixtures";

describe("updateCandidateProfile (real dev database, temporary fixtures)", () => {
  let fixtureA: CandidateTestFixtures;
  let fixtureB: CandidateTestFixtures;
  let countrySlug: string;
  let citySlug: string;

  beforeAll(async () => {
    fixtureA = await createCandidateTestFixtures();
    fixtureB = await createCandidateTestFixtures();

    const country = await prisma.country.findUniqueOrThrow({
      where: { id: fixtureA.countryId },
      select: { urlSlug: true },
    });
    const city = await prisma.city.findUniqueOrThrow({
      where: { id: fixtureA.cityId },
      select: { slug: true },
    });
    countrySlug = country.urlSlug;
    citySlug = city.slug;
  });

  afterAll(async () => {
    await cleanupCandidateTestFixtures(fixtureA);
    await cleanupCandidateTestFixtures(fixtureB);
  });

  it("reads its own profile via getCandidateProfile", async () => {
    const profile = await getCandidateProfile(fixtureA.userId);
    expect(profile?.id).toBe(fixtureA.candidateProfileId);
    expect(profile?.fullName).toBe("[CANDIDATE DASHBOARD TEST] Full Name");
  });

  it("updates its own profile, including a new headline", async () => {
    const result = await updateCandidateProfile({
      userId: fixtureA.userId,
      fullName: "Updated Name",
      countrySlug,
      citySlug,
      headline: "Senior Petroleum Engineer",
    });

    expect(result.success).toBe(true);

    const profile = await getCandidateProfile(fixtureA.userId);
    expect(profile?.fullName).toBe("Updated Name");
    expect(profile?.headline).toBe("Senior Petroleum Engineer");
  });

  it("clears the headline when an empty value is submitted", async () => {
    const result = await updateCandidateProfile({
      userId: fixtureA.userId,
      fullName: "Updated Name",
      countrySlug,
      citySlug,
      headline: "   ",
    });

    expect(result.success).toBe(true);
    const profile = await getCandidateProfile(fixtureA.userId);
    expect(profile?.headline).toBeNull();
  });

  it("never affects another candidate's profile", async () => {
    await updateCandidateProfile({
      userId: fixtureA.userId,
      fullName: "Fixture A Changed Again",
      countrySlug,
      citySlug,
      headline: "",
    });

    const profileB = await getCandidateProfile(fixtureB.userId);
    expect(profileB?.fullName).toBe("[CANDIDATE DASHBOARD TEST] Full Name");
    expect(profileB?.id).toBe(fixtureB.candidateProfileId);
  });

  it("rejects an invalid country and makes no change", async () => {
    const before = await getCandidateProfile(fixtureB.userId);
    const result = await updateCandidateProfile({
      userId: fixtureB.userId,
      fullName: "Should Not Save",
      countrySlug: "definitely-not-a-real-country",
      citySlug: "",
      headline: "",
    });

    expect(result).toEqual({ success: false, fieldErrors: { country: "Please select a valid country." } });
    const after = await getCandidateProfile(fixtureB.userId);
    expect(after?.fullName).toBe(before?.fullName);
  });

  it("fails safely (no throw) when the account has no candidate profile yet", async () => {
    const noProfileUser = await prisma.user.create({
      data: {
        email: `candidate-dashboard-test-noprofile-${crypto.randomUUID()}@example.invalid`,
        name: "[CANDIDATE DASHBOARD TEST] No Profile",
        role: "candidate",
        status: "active",
        emailVerified: false,
      },
      select: { id: true },
    });

    try {
      const result = await updateCandidateProfile({
        userId: noProfileUser.id,
        fullName: "Someone",
        countrySlug,
        citySlug,
        headline: "",
      });
      expect(result).toEqual({
        success: false,
        fieldErrors: {},
        formError: "Create your candidate profile before editing it.",
      });
    } finally {
      await prisma.user.deleteMany({ where: { id: noProfileUser.id } });
    }
  });
});
