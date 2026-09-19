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
    expect(profile?.hasResume).toBe(false);
  });

  it("reports hasResume: true once a resume URL is on file, and never exposes the URL itself", async () => {
    await prisma.candidateProfile.update({
      where: { id: fixtureA.candidateProfileId },
      data: { resumeFileUrl: "https://blob.example.invalid/resume.pdf" },
    });

    const profile = await getCandidateProfile(fixtureA.userId);
    expect(profile?.hasResume).toBe(true);
    expect(JSON.stringify(profile)).not.toContain("blob.example.invalid");

    await prisma.candidateProfile.update({
      where: { id: fixtureA.candidateProfileId },
      data: { resumeFileUrl: null },
    });
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

  it("rejects a city that does not belong to the selected country and makes no change", async () => {
    const otherCountry = await prisma.country.findFirst({
      where: { id: { not: fixtureA.countryId } },
      select: { id: true },
    });
    const otherCity = otherCountry
      ? await prisma.city.findFirst({ where: { countryId: otherCountry.id }, select: { slug: true } })
      : null;
    if (!otherCity) {
      throw new Error("This test needs a second Country with at least one City already in the database.");
    }

    const before = await getCandidateProfile(fixtureA.userId);
    const result = await updateCandidateProfile({
      userId: fixtureA.userId,
      fullName: "Should Not Save Either",
      countrySlug, // fixtureA's own country
      citySlug: otherCity.slug, // belongs to a DIFFERENT country
      headline: "",
    });

    expect(result).toEqual({
      success: false,
      fieldErrors: { city: "Please select a city that belongs to the selected country." },
    });
    const after = await getCandidateProfile(fixtureA.userId);
    expect(after?.fullName).toBe(before?.fullName);
  });

  it("ownership cannot be changed — a client-supplied candidateProfileId is not part of the input type and cannot redirect the update to a different profile", async () => {
    const beforeB = await getCandidateProfile(fixtureB.userId);

    // Simulates a hostile caller attempting to smuggle in a
    // candidateProfileId despite the type system rejecting it at
    // compile time — updateCandidateProfile's input has no such field,
    // and the underlying Prisma call is always
    // `where: { userId: input.userId }`, so an extra property here can
    // never redirect the write to fixture B's profile.
    const maliciousInput = {
      userId: fixtureA.userId,
      candidateProfileId: fixtureB.candidateProfileId,
      fullName: "Attempted Hijack",
      countrySlug,
      citySlug,
      headline: "",
    } as unknown as Parameters<typeof updateCandidateProfile>[0];

    await updateCandidateProfile(maliciousInput);

    const afterB = await getCandidateProfile(fixtureB.userId);
    expect(afterB?.fullName).toBe(beforeB?.fullName);
    expect(afterB?.id).toBe(fixtureB.candidateProfileId);

    const afterA = await getCandidateProfile(fixtureA.userId);
    expect(afterA?.fullName).toBe("Attempted Hijack");
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
