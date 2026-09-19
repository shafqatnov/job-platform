"use server";

import { redirect } from "next/navigation";
import { getSessionUser } from "@/services/auth/getSessionUser";
import { closeJobAsAdmin } from "@/services/admin/moderateJob";

export type CloseJobAsAdminActionState = { success?: boolean; error?: string };

/**
 * Re-derives the acting admin from the session on every submit — the
 * client never supplies its own identity or role here, mirroring
 * approveJobAction.ts/rejectJobAction.ts exactly.
 */
export async function closeJobAsAdminAction(
  jobId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prevState: CloseJobAsAdminActionState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData
): Promise<CloseJobAsAdminActionState> {
  const user = await getSessionUser();
  if (!user || user.role !== "admin" || user.status !== "active") {
    redirect("/sign-in");
  }

  const result = await closeJobAsAdmin(user.id, jobId);
  if (!result.success) {
    return { error: result.error };
  }

  return { success: true };
}
