"use server";

import { redirect } from "next/navigation";
import { getSessionUser } from "@/services/auth/getSessionUser";
import {
  updateEmployerCompany,
  type UpdateEmployerCompanyFieldErrors,
} from "@/services/employers/updateEmployerCompany";

export type UpdateCompanyActionState = {
  fieldErrors?: UpdateEmployerCompanyFieldErrors;
  formError?: string;
  success?: boolean;
};

/**
 * Re-derives the acting user from the session on every submit — the
 * client never supplies its own identity or companyId here, matching
 * createCompanyAction.ts and updateCandidateProfileAction.ts exactly.
 */
export async function updateCompanyAction(
  _prevState: UpdateCompanyActionState,
  formData: FormData
): Promise<UpdateCompanyActionState> {
  const user = await getSessionUser();
  if (!user || user.role !== "employer" || user.status !== "active") {
    redirect("/sign-in");
  }

  const result = await updateEmployerCompany({
    userId: user.id,
    name: String(formData.get("name") ?? ""),
    websiteUrl: String(formData.get("websiteUrl") ?? ""),
    description: String(formData.get("description") ?? ""),
    countrySlug: String(formData.get("country") ?? ""),
  });

  if (!result.success) {
    return { fieldErrors: result.fieldErrors, formError: result.formError };
  }

  return { success: true };
}
