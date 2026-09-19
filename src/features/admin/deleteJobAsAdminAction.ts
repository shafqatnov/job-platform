"use server";

import { redirect } from "next/navigation";
import { getSessionUser } from "@/services/auth/getSessionUser";
import { deleteJobAsAdmin } from "@/services/admin/moderateJob";

export type DeleteJobAsAdminActionState = { success?: boolean; error?: string };

export async function deleteJobAsAdminAction(
  jobId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prevState: DeleteJobAsAdminActionState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData
): Promise<DeleteJobAsAdminActionState> {
  const user = await getSessionUser();
  if (!user || user.role !== "admin" || user.status !== "active") {
    redirect("/sign-in");
  }

  const result = await deleteJobAsAdmin(user.id, jobId);
  if (!result.success) {
    return { error: result.error };
  }

  redirect("/admin/jobs");
}
