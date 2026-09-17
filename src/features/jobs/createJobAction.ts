"use server";

import { redirect } from "next/navigation";
import { getSessionUser } from "@/services/auth/getSessionUser";
import { createJob, type CreateJobFieldErrors } from "@/services/jobs/createJob";

export type CreateJobActionState = {
  fieldErrors?: CreateJobFieldErrors;
  formError?: string;
};

/**
 * Re-derives the acting user from the session on every submit — the
 * employer identity behind a created job always comes from here, never
 * from any client-supplied field.
 */
export async function createJobAction(
  _prevState: CreateJobActionState,
  formData: FormData
): Promise<CreateJobActionState> {
  const user = await getSessionUser();
  if (!user || user.role !== "employer" || user.status !== "active") {
    redirect("/sign-in");
  }

  const result = await createJob({
    userId: user.id,
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    countrySlug: String(formData.get("country") ?? ""),
    citySlug: String(formData.get("city") ?? ""),
    categorySlug: String(formData.get("category") ?? ""),
    salaryMin: String(formData.get("salaryMin") ?? ""),
    salaryMax: String(formData.get("salaryMax") ?? ""),
    currencyCode: String(formData.get("currencyCode") ?? ""),
    applicationMethod: String(formData.get("applicationMethod") ?? ""),
    externalApplicationUrl: String(formData.get("externalApplicationUrl") ?? ""),
  });

  if (!result.success) {
    return { fieldErrors: result.fieldErrors, formError: result.formError };
  }

  redirect("/employer?posted=1");
}
