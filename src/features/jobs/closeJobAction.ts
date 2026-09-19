"use server";

import { redirect } from "next/navigation";
import { getSessionUser } from "@/services/auth/getSessionUser";
import { closeJob } from "@/services/jobs/closeJob";

export type CloseJobActionState = { success?: boolean; error?: string };

/**
 * Re-derives the acting user from the session on every submit — mirrors
 * every other lifecycle action in this codebase (applyToJobAction,
 * saveJobAction, etc). Employer identity/ownership is never trusted
 * from the client.
 */
export async function closeJobAction(
  jobId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prevState: CloseJobActionState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData
): Promise<CloseJobActionState> {
  const user = await getSessionUser();
  if (!user || user.role !== "employer" || user.status !== "active") {
    redirect("/sign-in");
  }

  const result = await closeJob(user.id, jobId);
  if (!result.success) {
    return { error: result.error };
  }

  return { success: true };
}
