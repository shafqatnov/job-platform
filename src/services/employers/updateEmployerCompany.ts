import { prisma } from "@/lib/prisma";
import { getEmployerCompany } from "@/services/employers/getEmployerCompany";
import { findCountryBySlug } from "@/services/jobs/referenceData";
import { isSafeExternalUrl } from "@/services/jobs/createJob";

export type UpdateEmployerCompanyInput = {
  /** Must come from the authenticated session — never client-supplied. */
  userId: string;
  name: string;
  websiteUrl: string;
  description: string;
  countrySlug: string;
};

export type UpdateEmployerCompanyFieldErrors = Partial<Record<"name" | "websiteUrl" | "description" | "country", string>>;

export type UpdateEmployerCompanyResult =
  | { success: true }
  | { success: false; fieldErrors: UpdateEmployerCompanyFieldErrors; formError?: string };

// Matches createEmployerCompany.ts's own name limit exactly — the same
// company name, subject to the same rule whether set at creation or edit.
const MAX_NAME_LENGTH = 200;
// No existing company-description field to match; picked short enough for
// an honest company summary (createJob.ts's 10000 is sized for full job
// postings, not this).
const MAX_DESCRIPTION_LENGTH = 2000;

/**
 * Edits the authenticated employer's OWN company — the companyId to update
 * always comes from getEmployerCompany(userId), never from client input,
 * so an employer can never target another company's row. Slug is
 * deliberately left untouched (it's never exposed as a public URL and
 * regenerating it on every rename would risk unnecessary collisions).
 */
export async function updateEmployerCompany(input: UpdateEmployerCompanyInput): Promise<UpdateEmployerCompanyResult> {
  const fieldErrors: UpdateEmployerCompanyFieldErrors = {};

  const name = input.name.trim();
  if (!name) {
    fieldErrors.name = "Company name is required.";
  } else if (name.length > MAX_NAME_LENGTH) {
    fieldErrors.name = `Company name must be ${MAX_NAME_LENGTH} characters or fewer.`;
  }

  const websiteUrl = input.websiteUrl.trim();
  if (websiteUrl && !isSafeExternalUrl(websiteUrl)) {
    fieldErrors.websiteUrl = "Please enter a valid http:// or https:// URL.";
  }

  const description = input.description.trim();
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    fieldErrors.description = `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`;
  }

  const countrySlug = input.countrySlug.trim();
  const country = countrySlug ? await findCountryBySlug(countrySlug) : null;
  if (countrySlug && !country) {
    fieldErrors.country = "Please select a valid country.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { success: false, fieldErrors };
  }

  const employerCompany = await getEmployerCompany(input.userId);
  if (!employerCompany) {
    return { success: false, fieldErrors: {}, formError: "Set up your company before editing it." };
  }

  try {
    await prisma.company.update({
      where: { id: employerCompany.companyId },
      data: {
        name,
        websiteUrl: websiteUrl || null,
        description: description || null,
        countryId: country?.id ?? null,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("updateEmployerCompany failed", error);
    return {
      success: false,
      fieldErrors: {},
      formError: "We couldn't save these changes right now. Please try again.",
    };
  }
}
