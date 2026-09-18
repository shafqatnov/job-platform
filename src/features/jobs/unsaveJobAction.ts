"use server";

import { redirect } from "next/navigation";
import { getSessionUser } from "@/services/auth/getSessionUser";
import { unsaveJob } from "@/services/candidates/unsaveJob";

export type UnsaveJobActionState = { success?: boolean; error?: string };

/**
 * Re-derives the acting user and role from the session on every submit
 * — mirrors saveJobAction.ts exactly.
 */
export async function unsaveJobAction(
  jobId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prevState: UnsaveJobActionState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData
): Promise<UnsaveJobActionState> {
  const user = await getSessionUser();
  if (!user || user.status !== "active") {
    redirect("/sign-in");
  }
  if (user.role !== "candidate") {
    return { error: "Only candidate accounts can save jobs." };
  }

  const result = await unsaveJob(user.id, jobId);
  if (!result.success) {
    return { error: result.error };
  }

  return { success: true };
}
