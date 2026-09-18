import { prisma } from "@/lib/prisma";
import { findCountryBySlug, findCityInCountry } from "@/services/jobs/referenceData";

export type UpdateCandidateProfileInput = {
  /** Must come from the authenticated session — never client-supplied. */
  userId: string;
  fullName: string;
  countrySlug: string;
  /** Optional — CandidateProfile.cityId is nullable. */
  citySlug: string;
  /** Optional — CandidateProfile.headline is nullable. */
  headline: string;
};

export type UpdateCandidateProfileFieldErrors = Partial<
  Record<"fullName" | "country" | "city" | "headline", string>
>;

export type UpdateCandidateProfileResult =
  | { success: true }
  | { success: false; fieldErrors: UpdateCandidateProfileFieldErrors; formError?: string };

const MAX_FULL_NAME_LENGTH = 200;
// Shorter than createJob.ts's MAX_DESCRIPTION_LENGTH (10000) — a
// headline is a one-line tagline, not a document; matches
// MAX_FULL_NAME_LENGTH's existing "short field" convention.
const MAX_HEADLINE_LENGTH = 200;

/**
 * Updates an EXISTING CandidateProfile — the create/update split
 * mirrors createEmployerCompany vs. any future employer-profile editor.
 * Validation logic (name required/length, country must resolve to a
 * real row, city must belong to that country) is deliberately identical
 * to createCandidateProfile.ts's own rules, since editing must not
 * accept anything creation would have rejected.
 *
 * Security: the WHERE clause is always `{ userId: input.userId }` — the
 * unique key derived from the session — so this can never target any
 * profile other than the caller's own, regardless of what a crafted
 * request might otherwise attempt. There is no candidateProfileId
 * parameter anywhere in this function for that reason.
 */
export async function updateCandidateProfile(
  input: UpdateCandidateProfileInput
): Promise<UpdateCandidateProfileResult> {
  const fieldErrors: UpdateCandidateProfileFieldErrors = {};
  const fullName = input.fullName.trim();
  const headline = input.headline.trim();

  if (!fullName) {
    fieldErrors.fullName = "Full name is required.";
  } else if (fullName.length > MAX_FULL_NAME_LENGTH) {
    fieldErrors.fullName = `Full name must be ${MAX_FULL_NAME_LENGTH} characters or fewer.`;
  }

  if (headline.length > MAX_HEADLINE_LENGTH) {
    fieldErrors.headline = `Headline must be ${MAX_HEADLINE_LENGTH} characters or fewer.`;
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
  if (!existingProfile) {
    return {
      success: false,
      fieldErrors: {},
      formError: "Create your candidate profile before editing it.",
    };
  }

  try {
    await prisma.candidateProfile.update({
      where: { userId: input.userId },
      data: {
        fullName,
        countryId: country!.id,
        cityId: city?.id ?? null,
        headline: headline || null,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("updateCandidateProfile failed", error);
    return {
      success: false,
      fieldErrors: {},
      formError: "We couldn't save your profile right now. Please try again.",
    };
  }
}
