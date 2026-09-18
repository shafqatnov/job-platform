import { prisma } from "@/lib/prisma";

export type CandidateProfileSummary = {
  id: string;
  fullName: string;
  headline: string | null;
  countrySlug: string;
  countryName: string;
  citySlug: string | null;
  cityName: string | null;
};

/**
 * Reads the authenticated candidate's own profile, derived from
 * CandidateProfile.userId — never from a client-supplied
 * candidateProfileId. Mirrors src/services/employers/getEmployerCompany.ts.
 *
 * Returns null when the signed-in candidate hasn't created a profile
 * yet — callers (the job-detail apply flow, the apply service, the
 * profile/saved-jobs/applications pages) must send them to create one
 * first rather than assuming it exists.
 *
 * Extended (Version 1.1 candidate dashboard) to include headline and
 * the country/city needed to render/pre-fill a real profile view/edit
 * page — existing callers that only read `.id`/`.fullName` are
 * unaffected, since these are additive fields.
 */
export async function getCandidateProfile(userId: string): Promise<CandidateProfileSummary | null> {
  const profile = await prisma.candidateProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      fullName: true,
      headline: true,
      country: { select: { urlSlug: true, name: true } },
      city: { select: { slug: true, name: true } },
    },
  });

  if (!profile) {
    return null;
  }

  return {
    id: profile.id,
    fullName: profile.fullName,
    headline: profile.headline,
    countrySlug: profile.country.urlSlug,
    countryName: profile.country.name,
    citySlug: profile.city?.slug ?? null,
    cityName: profile.city?.name ?? null,
  };
}
