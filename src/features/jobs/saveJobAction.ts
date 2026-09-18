"use server";

import { redirect } from "next/navigation";
import { getSessionUser } from "@/services/auth/getSessionUser";
import { saveJob } from "@/services/candidates/saveJob";

export type SaveJobActionState = { success?: boolean; error?: string };

/**
 * Re-derives the acting user and role from the session on every submit
 * — mirrors applyToJobAction.ts exactly. Employer/admin sessions are
 * rejected here regardless of how the request was made.
 */
export async function saveJobAction(
  jobId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prevState: SaveJobActionState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData
): Promise<SaveJobActionState> {
  const user = await getSessionUser();
  if (!user || user.status !== "active") {
    redirect("/sign-in");
  }
  if (user.role !== "candidate") {
    return { error: "Only candidate accounts can save jobs." };
  }

  const result = await saveJob(user.id, jobId);
  if (!result.success) {
    return { error: result.error };
  }

  return { success: true };
}
