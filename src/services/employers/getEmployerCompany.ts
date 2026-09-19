import { prisma } from "@/lib/prisma";

export type EmployerCompany = {
  employerProfileId: string;
  companyId: string;
  companyName: string;
  websiteUrl: string | null;
  description: string | null;
  countrySlug: string | null;
};

/**
 * Reads the authenticated employer's own company association, derived
 * from EmployerProfile.userId — never from a client-supplied
 * employerProfileId/companyId. Phase 1 is one EmployerProfile per one
 * Company (docs/26 §11); this is the only relationship consulted here,
 * no organization/multi-seat logic.
 *
 * Returns null when the signed-in employer hasn't set up a company yet
 * — callers (e.g. the job-creation route) must send them to set one up
 * first rather than assuming it exists.
 */
export async function getEmployerCompany(userId: string): Promise<EmployerCompany | null> {
  const profile = await prisma.employerProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      companyId: true,
      company: {
        select: { name: true, websiteUrl: true, description: true, country: { select: { urlSlug: true } } },
      },
    },
  });

  if (!profile) {
    return null;
  }

  return {
    employerProfileId: profile.id,
    companyId: profile.companyId,
    companyName: profile.company.name,
    websiteUrl: profile.company.websiteUrl,
    description: profile.company.description,
    countrySlug: profile.company.country?.urlSlug ?? null,
  };
}
