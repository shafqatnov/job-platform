import type { Metadata } from "next";
import { Section } from "@/components/Section";
import { Card } from "@/components/Card";
import { ImportedJobLocationReviewsTable } from "@/features/admin/ImportedJobLocationReviewsTable";
import { listPendingLocationReviews } from "@/services/admin/locationReviews";
import { listCountries, listCities } from "@/services/jobs/referenceData";

export const metadata: Metadata = {
  title: "Unknown Location Review",
  robots: { index: false, follow: false },
};

/**
 * The admin review queue for imported jobs whose source location text
 * AI couldn't confidently map to a real Country/City row. Protected by
 * the (dashboard)/admin layout's existing admin-only guard — no separate
 * auth check is added here (mirrors imported-jobs/page.tsx exactly).
 */
export default async function AdminUnknownLocationsPage() {
  const [reviews, countries, cities] = await Promise.all([listPendingLocationReviews(), listCountries(), listCities()]);

  return (
    <Section aria-labelledby="unknown-locations-heading">
      <h1 id="unknown-locations-heading" className="mb-2 text-2xl font-semibold text-foreground sm:text-3xl">
        Unknown Location Review
      </h1>
      <p className="mb-8 text-muted-foreground">
        Imported jobs whose location text couldn&apos;t be confidently matched to a country and city. Resolving one here
        also teaches Jobnura that mapping for any future job that reports the exact same location text.
      </p>
      <Card padding="lg">
        <ImportedJobLocationReviewsTable reviews={reviews} countries={countries} cities={cities} />
      </Card>
    </Section>
  );
}
