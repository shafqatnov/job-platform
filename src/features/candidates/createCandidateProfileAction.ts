"use server";

import { redirect } from "next/navigation";
import { getSessionUser } from "@/services/auth/getSessionUser";
import { createCandidateProfile, type CreateCandidateProfileFieldErrors } from "@/services/candidates/createCandidateProfile";

export type CreateCandidateProfileActionState = {
  fieldErrors?: CreateCandidateProfileFieldErrors;
  formError?: string;
};

/** Only ever a same-origin relative path — never an absolute/external URL (open-redirect guard). */
function safeRedirectTarget(value: FormDataEntryValue | null): string {
  if (typeof value === "string" && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return "/";
}

/**
 * Re-derives the acting user from the session on every submit — the
 * client never supplies its own identity here.
 */
export async function createCandidateProfileAction(
  _prevState: CreateCandidateProfileActionState,
  formData: FormData
): Promise<CreateCandidateProfileActionState> {
  const user = await getSessionUser();
  if (!user || user.role !== "candidate" || user.status !== "active") {
    redirect("/sign-in");
  }

  const result = await createCandidateProfile({
    userId: user.id,
    fullName: String(formData.get("fullName") ?? ""),
    countrySlug: String(formData.get("country") ?? ""),
    citySlug: String(formData.get("city") ?? ""),
  });

  if (!result.success) {
    return { fieldErrors: result.fieldErrors, formError: result.formError };
  }

  redirect(safeRedirectTarget(formData.get("redirectTo")));
}
