import { prisma } from "@/lib/prisma";
import { findCountryBySlug, findCityInCountry } from "@/services/jobs/referenceData";

export type CreateCandidateProfileInput = {
  /** Must come from the authenticated session — never client-supplied. */
  userId: string;
  fullName: string;
  countrySlug: string;
  /** Optional — CandidateProfile.cityId is nullable. */
  citySlug: string;
};

export type CreateCandidateProfileFieldErrors = Partial<Record<"fullName" | "country" | "city", string>>;

export type CreateCandidateProfileResult =
  | { success: true; candidateProfileId: string }
  | { success: false; fieldErrors: CreateCandidateProfileFieldErrors; formError?: string };

const MAX_FULL_NAME_LENGTH = 200;

/**
 * Creates the minimum viable CandidateProfile a newly-signed-up
 * candidate needs before they can apply to a job — just full name and
 * country (city optional), per this task's "create only the minimum
 * required profile" scope. Resume upload is explicitly out of scope
 * (resumeFileUrl stays null); headline stays null too, since nothing
 * requested it.
 *
 * Fails safely if this user already has a CandidateProfile (1:1 per
 * the schema's unique CandidateProfile.userId).
 */
export async function createCandidateProfile(
  input: CreateCandidateProfileInput
): Promise<CreateCandidateProfileResult> {
  const fieldErrors: CreateCandidateProfileFieldErrors = {};
  const fullName = input.fullName.trim();

  if (!fullName) {
    fieldErrors.fullName = "Full name is required.";
  } else if (fullName.length > MAX_FULL_NAME_LENGTH) {
    fieldErrors.fullName = `Full name must be ${MAX_FULL_NAME_LENGTH} characters or fewer.`;
  }

  const country = await findCountryBySlug(input.countrySlug);
  if (!country) {
    fieldErrors.country = "Please select a valid country.";
  }

  const citySlug = input.citySlug.trim();
  const city = country && citySlug ? await findCityInCountry(citySlug, country.id) : null;
  if (country && citySlug && !city) {
    fieldErrors.city = "Please select a city that belongs to the selected country.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { success: false, fieldErrors };
  }

  const existingProfile = await prisma.candidateProfile.findUnique({
    where: { userId: input.userId },
    select: { id: true },
  });
  if (existingProfile) {
    return { success: false, fieldErrors: {}, formError: "This account already has a candidate profile." };
  }

  try {
    const profile = await prisma.candidateProfile.create({
      data: {
        userId: input.userId,
        countryId: country!.id,
        cityId: city?.id ?? null,
        fullName,
      },
      select: { id: true },
    });

    return { success: true, candidateProfileId: profile.id };
  } catch (error) {
    console.error("createCandidateProfile failed", error);
    return {
      success: false,
      fieldErrors: {},
      formError: "We couldn't save your profile right now. Please try again.",
    };
  }
}
