"use server";

import { redirect } from "next/navigation";
import { getSessionUser } from "@/services/auth/getSessionUser";
import { updateJob, type UpdateJobFieldErrors } from "@/services/jobs/updateJob";

export type UpdateJobActionState = {
  fieldErrors?: UpdateJobFieldErrors;
  formError?: string;
  success?: boolean;
};

export async function updateJobAction(
  jobId: string,
  _prevState: UpdateJobActionState,
  formData: FormData
): Promise<UpdateJobActionState> {
  const user = await getSessionUser();
  if (!user || user.role !== "employer" || user.status !== "active") {
    redirect("/sign-in");
  }

  const result = await updateJob({
    userId: user.id,
    jobId,
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
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

  redirect(`/employer/jobs/${jobId}`);
}
