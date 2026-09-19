"use server";

import { redirect } from "next/navigation";
import { getSessionUser } from "@/services/auth/getSessionUser";
import { reopenJob } from "@/services/jobs/reopenJob";

export type ReopenJobActionState = { success?: boolean; error?: string };

export async function reopenJobAction(
  jobId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prevState: ReopenJobActionState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData
): Promise<ReopenJobActionState> {
  const user = await getSessionUser();
  if (!user || user.role !== "employer" || user.status !== "active") {
    redirect("/sign-in");
  }

  const result = await reopenJob(user.id, jobId);
  if (!result.success) {
    return { error: result.error };
  }

  return { success: true };
}
