"use server";

import { redirect } from "next/navigation";
import { getSessionUser } from "@/services/auth/getSessionUser";
import { approveJob } from "@/services/admin/moderateJob";

export type ApproveJobActionState = {
  error?: string;
};

/**
 * Re-derives the acting admin from the session on every submit — the
 * client never supplies its own identity or role here.
 */
export async function approveJobAction(
  jobId: string,
  // Required by useActionState's action signature (see JobReviewActions.tsx)
  // even though approving needs no prior state or form fields.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prevState: ApproveJobActionState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData
): Promise<ApproveJobActionState> {
  const user = await getSessionUser();
  if (!user || user.role !== "admin" || user.status !== "active") {
    redirect("/sign-in");
  }

  const result = await approveJob(user.id, jobId);
  if (!result.success) {
    return { error: result.error };
  }

  redirect("/admin/jobs/pending");
}
