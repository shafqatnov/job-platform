"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/services/auth/getSessionUser";
import { approveImportedJobReview } from "@/services/publishing/publishImportedJob";

export type ApproveImportedJobReviewActionState = {
  error?: string;
};

/**
 * Re-derives the acting admin from the session on every submit — the
 * client never supplies its own identity or role here, matching
 * approveJobAction.ts exactly.
 */
export async function approveImportedJobReviewAction(
  reviewId: string,
  // Required by useActionState's action signature, matching
  // approveJobAction.ts's own convention.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prevState: ApproveImportedJobReviewActionState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData
): Promise<ApproveImportedJobReviewActionState> {
  const user = await getSessionUser();
  if (!user || user.role !== "admin" || user.status !== "active") {
    redirect("/sign-in");
  }

  const result = await approveImportedJobReview(reviewId, user.id);
  if (result.outcome === "failed") {
    return { error: result.error };
  }

  revalidatePath("/admin/imported-jobs");
  return {};
}
