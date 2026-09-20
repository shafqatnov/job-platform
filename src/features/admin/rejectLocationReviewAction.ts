"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/services/auth/getSessionUser";
import { rejectLocationReview } from "@/services/admin/locationReviews";

export type RejectLocationReviewActionState = {
  error?: string;
};

/**
 * Re-derives the acting admin from the session on every submit —
 * matching resolveLocationReviewAction.ts / rejectImportedJobReviewAction.ts.
 */
export async function rejectLocationReviewAction(
  reviewId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prevState: RejectLocationReviewActionState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData
): Promise<RejectLocationReviewActionState> {
  const user = await getSessionUser();
  if (!user || user.role !== "admin" || user.status !== "active") {
    redirect("/sign-in");
  }

  const result = await rejectLocationReview(reviewId, user.id);
  if (!result.success) {
    return { error: result.error };
  }

  revalidatePath("/admin/unknown-locations");
  return {};
}
