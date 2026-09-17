"use server";

import { redirect } from "next/navigation";
import { getSessionUser } from "@/services/auth/getSessionUser";
import { rejectJob } from "@/services/admin/moderateJob";

export type RejectJobActionState = {
  error?: string;
};

/**
 * Re-derives the acting admin from the session on every submit — the
 * client never supplies its own identity or role here.
 */
export async function rejectJobAction(
  jobId: string,
  _prevState: RejectJobActionState,
  formData: FormData
): Promise<RejectJobActionState> {
  const user = await getSessionUser();
  if (!user || user.role !== "admin" || user.status !== "active") {
    redirect("/sign-in");
  }

  const reason = String(formData.get("reason") ?? "");
  const result = await rejectJob(user.id, jobId, reason);
  if (!result.success) {
    return { error: result.error };
  }

  redirect("/admin/jobs/pending");
}
