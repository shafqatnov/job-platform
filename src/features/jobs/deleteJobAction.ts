"use server";

import { redirect } from "next/navigation";
import { getSessionUser } from "@/services/auth/getSessionUser";
import { deleteJob } from "@/services/jobs/deleteJob";

export type DeleteJobActionState = { success?: boolean; error?: string };

export async function deleteJobAction(
  jobId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prevState: DeleteJobActionState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData
): Promise<DeleteJobActionState> {
  const user = await getSessionUser();
  if (!user || user.role !== "employer" || user.status !== "active") {
    redirect("/sign-in");
  }

  const result = await deleteJob(user.id, jobId);
  if (!result.success) {
    return { error: result.error };
  }

  redirect("/employer");
}
