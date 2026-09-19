"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/services/auth/getSessionUser";
import { setJobSourceEnabled } from "@/services/admin/jobSources";

export type SetJobSourceEnabledActionState = {
  error?: string;
};

/**
 * Re-derives the acting admin from the session on every submit — the
 * client never supplies its own identity or role here, matching
 * approveJobAction.ts/rejectJobAction.ts exactly.
 */
export async function setJobSourceEnabledAction(
  sourceId: string,
  enabled: boolean,
  // Required by useActionState's action signature even though this
  // action needs no prior state or form fields, matching
  // approveJobAction.ts's exact convention.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prevState: SetJobSourceEnabledActionState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData
): Promise<SetJobSourceEnabledActionState> {
  const user = await getSessionUser();
  if (!user || user.role !== "admin" || user.status !== "active") {
    redirect("/sign-in");
  }

  const result = await setJobSourceEnabled(sourceId, enabled);
  if (!result.success) {
    return { error: result.error };
  }

  revalidatePath("/admin/job-sources");
  return {};
}
