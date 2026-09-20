import type { Metadata } from "next";
import { Section } from "@/components/Section";
import { Card } from "@/components/Card";
import { ImportedJobReviewsTable } from "@/features/admin/ImportedJobReviewsTable";
import { listPendingImportedJobReviews } from "@/services/admin/listImportedJobReviews";

export const metadata: Metadata = {
  title: "Imported Job Review",
  robots: { index: false, follow: false },
};

/**
 * The admin review queue for the imported-job publishing pipeline.
 * Protected by the (dashboard)/admin layout's existing admin-only guard
 * — no separate auth check is added here. Shows only jobs still in
 * "pending" status; published/rejected imports are already resolved.
 */
export default async function AdminImportedJobsPage() {
  const reviews = await listPendingImportedJobReviews();

  return (
    <Section aria-labelledby="imported-jobs-heading">
      <h1 id="imported-jobs-heading" className="mb-2 text-2xl font-semibold text-foreground sm:text-3xl">
        Imported Job Review
      </h1>
      <p className="mb-8 text-muted-foreground">
        Jobs imported from authorized sources that need a human decision before they can go live.
      </p>
      <Card padding="lg">
        <ImportedJobReviewsTable reviews={reviews} />
      </Card>
    </Section>
  );
}
