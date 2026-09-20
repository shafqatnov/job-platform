"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/services/auth/getSessionUser";
import { resolveLocationReview } from "@/services/admin/locationReviews";

export type ResolveLocationReviewActionState = {
  error?: string;
};

/**
 * Re-derives the acting admin from the session on every submit — the
 * client never supplies its own identity or role here, matching
 * approveImportedJobReviewAction.ts exactly. countryId/cityId come from
 * the submitted <select> values, which only ever list real Country/City
 * rows (see ImportedJobLocationReviewsTable.tsx) — never free text.
 */
export async function resolveLocationReviewAction(
  reviewId: string,
  _prevState: ResolveLocationReviewActionState,
  formData: FormData
): Promise<ResolveLocationReviewActionState> {
  const user = await getSessionUser();
  if (!user || user.role !== "admin" || user.status !== "active") {
    redirect("/sign-in");
  }

  const countryId = String(formData.get("countryId") ?? "").trim();
  const cityId = String(formData.get("cityId") ?? "").trim();
  if (!countryId) {
    return { error: "Select a country before saving." };
  }

  const result = await resolveLocationReview(reviewId, countryId, cityId || null, user.id);
  if (!result.success) {
    return { error: result.error };
  }

  revalidatePath("/admin/unknown-locations");
  return {};
}
