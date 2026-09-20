"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/services/auth/getSessionUser";
import { setJobSourceAuthorization } from "@/services/admin/jobSources";

export type SetJobSourceAuthorizationActionState = {
  error?: string;
};

const MAX_REFERENCE_LENGTH = 500;

/**
 * Re-derives the acting admin from the session on every submit — the
 * client never supplies its own identity or role here, matching
 * setJobSourceEnabledAction.ts exactly. This is a deliberate, explicit
 * human decision — nothing in this codebase calls
 * setJobSourceAuthorization automatically.
 */
export async function setJobSourceAuthorizationAction(
  sourceId: string,
  verified: boolean,
  // Required by useActionState's action signature, matching
  // approveJobAction.ts's own convention.
  _prevState: SetJobSourceAuthorizationActionState,
  formData: FormData
): Promise<SetJobSourceAuthorizationActionState> {
  const user = await getSessionUser();
  if (!user || user.role !== "admin" || user.status !== "active") {
    redirect("/sign-in");
  }

  const reference = String(formData.get("authorizationReference") ?? "").trim();
  if (reference.length > MAX_REFERENCE_LENGTH) {
    return { error: `Reference note must be ${MAX_REFERENCE_LENGTH} characters or fewer.` };
  }

  const result = await setJobSourceAuthorization(sourceId, verified, reference || null);
  if (!result.success) {
    return { error: result.error };
  }

  revalidatePath("/admin/job-sources");
  return {};
}
