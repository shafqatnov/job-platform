"use server";

import { redirect } from "next/navigation";
import { getSessionUser } from "@/services/auth/getSessionUser";
import {
  updateCandidateProfile,
  type UpdateCandidateProfileFieldErrors,
} from "@/services/candidates/updateCandidateProfile";

export type UpdateCandidateProfileActionState = {
  fieldErrors?: UpdateCandidateProfileFieldErrors;
  formError?: string;
  success?: boolean;
};

/**
 * Re-derives the acting user from the session on every submit — the
 * client never supplies its own identity here, matching
 * createCandidateProfileAction.ts exactly.
 */
export async function updateCandidateProfileAction(
  _prevState: UpdateCandidateProfileActionState,
  formData: FormData
): Promise<UpdateCandidateProfileActionState> {
  const user = await getSessionUser();
  if (!user || user.role !== "candidate" || user.status !== "active") {
    redirect("/sign-in");
  }

  const result = await updateCandidateProfile({
    userId: user.id,
    fullName: String(formData.get("fullName") ?? ""),
    countrySlug: String(formData.get("country") ?? ""),
    citySlug: String(formData.get("city") ?? ""),
    headline: String(formData.get("headline") ?? ""),
  });

  if (!result.success) {
    return { fieldErrors: result.fieldErrors, formError: result.formError };
  }

  return { success: true };
}
