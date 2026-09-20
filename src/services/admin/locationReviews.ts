import { prisma } from "@/lib/prisma";
import { normalizeLocationText } from "@/services/jobs/referenceData";

/**
 * The admin-only "unknown location" review queue: imported jobs whose
 * source location text couldn't be confidently mapped to a real
 * Country/City row by AI. Separate from (but layered on top of) the
 * general ImportedJobReview publish queue in listImportedJobReviews.ts —
 * a job can be "pending" there while ALSO carrying a pending location
 * review here. AI never writes to Country/City directly anywhere in this
 * file; only an admin's explicit resolveLocationReview call can attach a
 * canonical countryId/cityId to a review or to the reusable
 * ResolvedLocationAlias table.
 */

export type LocationReviewRow = {
  id: string;
  importedSourceId: string;
  importedExternalJobId: string;
  title: string;
  location: string | null;
  aiCountry: string | null;
  aiCity: string | null;
  locationReviewStatus: "pending" | "resolved" | "rejected";
  resolvedCountryId: string | null;
  resolvedCityId: string | null;
  locationReviewedAt: string | null;
  createdAt: string;
};

/** Every review row still awaiting an admin's location decision, oldest first. */
export async function listPendingLocationReviews(): Promise<LocationReviewRow[]> {
  const reviews = await prisma.importedJobReview.findMany({
    where: { locationReviewStatus: "pending" },
    orderBy: { createdAt: "asc" },
  });

  return reviews.map((review) => ({
    id: review.id,
    importedSourceId: review.importedSourceId,
    importedExternalJobId: review.importedExternalJobId,
    title: review.title,
    location: review.location,
    aiCountry: review.country,
    aiCity: review.city,
    locationReviewStatus: review.locationReviewStatus as "pending" | "resolved" | "rejected",
    resolvedCountryId: review.resolvedCountryId,
    resolvedCityId: review.resolvedCityId,
    locationReviewedAt: review.locationReviewedAt?.toISOString() ?? null,
    createdAt: review.createdAt.toISOString(),
  }));
}

export type ResolveLocationReviewResult = { success: true } | { success: false; error: string };

/**
 * The one and only path by which an unknown-location review can attach
 * a canonical Country/City to an imported job — always an explicit,
 * human admin decision. Never invents a Country/City row, never accepts
 * free text: countryId/cityId must already reference real rows, and
 * cityId (when provided) must belong to the given country.
 *
 * Also upserts a ResolvedLocationAlias keyed on this review's own raw
 * source location text (when present), so any OTHER imported job whose
 * source location text is byte-for-byte identical (case/whitespace
 * aside) reuses this same mapping without a second review. The alias
 * table's unique `normalizedAlias` constraint is exactly what prevents
 * conflicting duplicate mappings: an upsert here always leaves at most
 * one row per normalized text, reflecting the latest admin decision.
 */
export async function resolveLocationReview(
  reviewId: string,
  countryId: string,
  cityId: string | null,
  adminUserId: string
): Promise<ResolveLocationReviewResult> {
  const review = await prisma.importedJobReview.findUnique({ where: { id: reviewId } });
  if (!review) {
    return { success: false, error: "Location review not found." };
  }
  if (review.locationReviewStatus !== "pending") {
    return { success: false, error: "This location review has already been resolved or rejected." };
  }

  const country = await prisma.country.findUnique({ where: { id: countryId }, select: { id: true, name: true } });
  if (!country) {
    return { success: false, error: "Select a valid country." };
  }

  if (cityId) {
    const city = await prisma.city.findUnique({ where: { id: cityId }, select: { id: true, countryId: true } });
    if (!city || city.countryId !== country.id) {
      return { success: false, error: "The selected city does not belong to the selected country." };
    }
  }

  const normalizedAlias = review.location ? normalizeLocationText(review.location) : "";

  await prisma.$transaction([
    prisma.importedJobReview.update({
      where: { id: review.id },
      data: {
        locationReviewStatus: "resolved",
        resolvedCountryId: country.id,
        resolvedCityId: cityId,
        locationReviewedAt: new Date(),
      },
    }),
    ...(normalizedAlias
      ? [
          prisma.resolvedLocationAlias.upsert({
            where: { normalizedAlias },
            create: { normalizedAlias, countryId: country.id, cityId },
            update: { countryId: country.id, cityId },
          }),
        ]
      : []),
    prisma.moderationAction.create({
      data: {
        adminUserId,
        targetJobId: null,
        action: "resolve_location_review",
        reason: `Resolved location "${review.location ?? "(none provided)"}" for imported job review ${review.id} to ${country.name}`,
      },
    }),
  ]);

  return { success: true };
}

export type RejectLocationReviewResult = { success: true } | { success: false; error: string };

/**
 * Marks an unknown-location review as ignored — the job simply remains
 * unable to publish (resolveCountryAndCity will keep returning null for
 * it) until someone resolves it properly. Idempotent: rejecting an
 * already-rejected review is a safe no-op.
 */
export async function rejectLocationReview(reviewId: string, adminUserId: string): Promise<RejectLocationReviewResult> {
  const review = await prisma.importedJobReview.findUnique({ where: { id: reviewId } });
  if (!review) {
    return { success: false, error: "Location review not found." };
  }
  if (review.locationReviewStatus === "rejected") {
    return { success: true };
  }
  if (review.locationReviewStatus === "resolved") {
    return { success: false, error: "This location review has already been resolved and cannot be rejected." };
  }

  await prisma.$transaction([
    prisma.importedJobReview.update({
      where: { id: review.id },
      data: { locationReviewStatus: "rejected", locationReviewedAt: new Date() },
    }),
    prisma.moderationAction.create({
      data: {
        adminUserId,
        targetJobId: null,
        action: "reject_location_review",
        reason: `Rejected location review ${review.id} ("${review.location ?? "(none provided)"}")`,
      },
    }),
  ]);

  return { success: true };
}
