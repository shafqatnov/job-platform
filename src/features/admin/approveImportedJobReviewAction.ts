"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/services/auth/getSessionUser";
import { prisma } from "@/lib/prisma";
import { approveImportedJobReview } from "@/services/publishing/publishImportedJob";

export type ApproveImportedJobReviewActionState = {
  error?: string;
  /**
   * Set only when the review is still genuinely pending after this
   * approve attempt (publishReview's own "queued_for_review" outcome) —
   * never an error (the business logic intentionally treats this as a
   * valid intermediate state, not a failure), but the admin still needs
   * to know nothing was published.
   */
  info?: string;
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

  if (result.outcome === "queued_for_review") {
    // Not a failure — publishReview() itself decided this exact job still
    // isn't safely publishable and correctly left it "pending" rather
    // than forcing it through. Re-reading just the one field this
    // message needs, rather than threading a reason through
    // publishImportedJob.ts's own result type, keeps this fix scoped to
    // the admin action layer only.
    const review = await prisma.importedJobReview.findUnique({
      where: { id: reviewId },
      select: { locationReviewStatus: true },
    });
    if (review?.locationReviewStatus === "pending") {
      return {
        info: "Not published yet — this job's location still needs to be resolved. Resolve it under Unknown Locations, then approve again.",
      };
    }
    return {
      info: "Not published yet — some required information (e.g. category or company) still couldn't be resolved automatically.",
    };
  }

  return {};
}
