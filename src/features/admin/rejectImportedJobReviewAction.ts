"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/services/auth/getSessionUser";
import { rejectImportedJobReview } from "@/services/publishing/publishImportedJob";

export type RejectImportedJobReviewActionState = {
  error?: string;
};

/**
 * Re-derives the acting admin from the session on every submit — the
 * client never supplies its own identity or role here, matching
 * rejectJobAction.ts exactly.
 */
export async function rejectImportedJobReviewAction(
  reviewId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prevState: RejectImportedJobReviewActionState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData
): Promise<RejectImportedJobReviewActionState> {
  const user = await getSessionUser();
  if (!user || user.role !== "admin" || user.status !== "active") {
    redirect("/sign-in");
  }

  const result = await rejectImportedJobReview(reviewId, user.id);
  if (!result.success) {
    return { error: result.error };
  }

  revalidatePath("/admin/imported-jobs");
  return {};
}
