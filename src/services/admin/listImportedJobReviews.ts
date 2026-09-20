import { prisma } from "@/lib/prisma";

export type ImportedJobReviewRow = {
  id: string;
  title: string;
  importedSourceId: string;
  importedExternalJobId: string;
  sourceUrl: string | null;
  companyIdentity: string | null;
  location: string | null;
  country: string | null;
  city: string | null;
  category: string | null;
  decision: string;
  reasons: string[];
  createdAt: string;
  updatedAt: string;
};

/**
 * Reads the admin review queue for the imported-job pipeline — every
 * ImportedJobReview row still in "pending" status (i.e. either
 * admin_review from the confidence-decision stage, or an auto_publish
 * that the publishing stage couldn't safely complete and routed to
 * review instead). Published and rejected rows are already resolved and
 * don't need admin attention, so they're excluded from this queue view.
 * Oldest first, matching listAdminJobs.ts's own pending-queue ordering.
 */
export async function listPendingImportedJobReviews(): Promise<ImportedJobReviewRow[]> {
  const reviews = await prisma.importedJobReview.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
  });

  return reviews.map((review) => ({
    id: review.id,
    title: review.title,
    importedSourceId: review.importedSourceId,
    importedExternalJobId: review.importedExternalJobId,
    sourceUrl: review.sourceUrl,
    companyIdentity: review.companyIdentity,
    location: review.location,
    country: review.country,
    city: review.city,
    category: review.category,
    decision: review.decision,
    reasons: review.reasons,
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
  }));
}
