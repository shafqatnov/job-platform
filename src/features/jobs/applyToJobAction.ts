"use server";

import { redirect } from "next/navigation";
import { getSessionUser } from "@/services/auth/getSessionUser";
import { applyToJob } from "@/services/applications/applyToJob";

export type ApplyToJobActionState = {
  success?: boolean;
  error?: string;
};

/**
 * Re-derives the acting user and role from the session on every submit
 * — the client never supplies its own identity, and this is the actual
 * authorization boundary (not the button's visibility on the page,
 * which is only UX). Employer and admin sessions are rejected here
 * regardless of how the request was made.
 */
export async function applyToJobAction(
  jobId: string,
  // Required by useActionState's action signature (see ApplyButton.tsx)
  // even though applying needs no prior state or form fields.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prevState: ApplyToJobActionState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData
): Promise<ApplyToJobActionState> {
  const user = await getSessionUser();
  if (!user || user.status !== "active") {
    redirect("/sign-in");
  }
  if (user.role !== "candidate") {
    return { error: "Only candidate accounts can apply for jobs." };
  }

  const result = await applyToJob({ userId: user.id, jobId });
  if (!result.success) {
    return { error: result.error };
  }

  return { success: true };
}
