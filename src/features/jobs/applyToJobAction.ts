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
  _prevState: ApplyToJobActionState,
  formData: FormData
): Promise<ApplyToJobActionState> {
  const user = await getSessionUser();
  if (!user || user.status !== "active") {
    redirect("/sign-in");
  }
  if (user.role !== "candidate") {
    return { error: "Only candidate accounts can apply for jobs." };
  }

  const coverNote = String(formData.get("coverNote") ?? "");
  const result = await applyToJob({ userId: user.id, jobId, coverNote });
  if (!result.success) {
    return { error: result.error };
  }

  return { success: true };
}
