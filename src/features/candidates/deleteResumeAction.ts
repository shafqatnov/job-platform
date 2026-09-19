"use server";

import { redirect } from "next/navigation";
import { getSessionUser } from "@/services/auth/getSessionUser";
import { removeResume } from "@/services/candidates/removeResume";

export type DeleteResumeActionState = {
  success?: boolean;
  error?: string;
};

/**
 * Re-derives the acting user from the session on every submit — the
 * client never supplies its own identity here, matching
 * updateCandidateProfileAction.ts exactly.
 */
export async function deleteResumeAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prevState: DeleteResumeActionState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData
): Promise<DeleteResumeActionState> {
  const user = await getSessionUser();
  if (!user || user.role !== "candidate" || user.status !== "active") {
    redirect("/sign-in");
  }

  const result = await removeResume(user.id);
  if (!result.success) {
    return { error: result.error };
  }

  return { success: true };
}
