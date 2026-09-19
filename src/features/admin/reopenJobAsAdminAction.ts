"use server";

import { redirect } from "next/navigation";
import { getSessionUser } from "@/services/auth/getSessionUser";
import { reopenJobAsAdmin } from "@/services/admin/moderateJob";

export type ReopenJobAsAdminActionState = { success?: boolean; error?: string };

export async function reopenJobAsAdminAction(
  jobId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prevState: ReopenJobAsAdminActionState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData
): Promise<ReopenJobAsAdminActionState> {
  const user = await getSessionUser();
  if (!user || user.role !== "admin" || user.status !== "active") {
    redirect("/sign-in");
  }

  const result = await reopenJobAsAdmin(user.id, jobId);
  if (!result.success) {
    return { error: result.error };
  }

  return { success: true };
}
