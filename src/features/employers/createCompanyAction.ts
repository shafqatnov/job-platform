"use server";

import { redirect } from "next/navigation";
import { getSessionUser } from "@/services/auth/getSessionUser";
import { createEmployerCompany } from "@/services/employers/createEmployerCompany";

export type CreateCompanyActionState = {
  error?: string;
};

/**
 * Re-derives the acting user from the session on every submit — the
 * client never supplies its own identity here, regardless of what a
 * hidden field or prior page state might claim.
 */
export async function createCompanyAction(
  _prevState: CreateCompanyActionState,
  formData: FormData
): Promise<CreateCompanyActionState> {
  const user = await getSessionUser();
  if (!user || user.role !== "employer" || user.status !== "active") {
    redirect("/sign-in");
  }

  const name = String(formData.get("name") ?? "");
  const result = await createEmployerCompany({ userId: user.id, name });

  if (!result.success) {
    return { error: result.error };
  }

  redirect("/employer/jobs/new");
}
