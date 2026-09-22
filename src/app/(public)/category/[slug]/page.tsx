import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicCategoryBySlug, getOtherPopulatedCategories } from "@/services/jobs/getPublicCategoryBySlug";
import { getPublicJobs } from "@/services/jobs/getPublicJobs";
import { CategoryView } from "@/features/categories/CategoryView";
import { breadcrumbJsonLd, type BreadcrumbItem } from "@/components/Breadcrumbs";
import { getConfiguredSiteUrl } from "@/lib/siteUrl";
import type { PublicCategoryDetail } from "@/services/jobs/getPublicCategoryBySlug";

/**
 * Concise, factual description built only from real data already
 * resolved on this category (name + actual current counts) — never an
 * invented statistic, salary claim, or career fact, per this task's own
 * content-safety requirement. Shared between generateMetadata's meta
 * description and CategoryView's own on-page intro so both stay
 * consistent.
 */
export function buildCategoryDescription(category: Pick<PublicCategoryDetail, "name" | "openJobCount" | "hiringCountries">): string {
  const roleWord = category.openJobCount === 1 ? "role" : "roles";
  const countryClause =
    category.hiringCountries.length > 0
      ? ` across ${category.hiringCountries.length} ${category.hiringCountries.length === 1 ? "country" : "countries"}`
      : "";
  return `${category.openJobCount} open ${roleWord} in ${category.name}${countryClause} on Jobnura.`;
}

export async function generateMetadata({
  params,
}: PageProps<"/category/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const category = await getPublicCategoryBySlug(slug);

  // Not calling notFound() here: metadata generation runs in a separate
  // phase from rendering — see [country]/jobs/page.tsx's own precedent.
  // The page component below is the single source of truth for the 404.
  if (!category) {
    return { title: "Jobs" };
  }

  const title = `${category.name} Jobs`;
  const description = buildCategoryDescription(category);
  const siteUrl = getConfiguredSiteUrl();
  const path = `/category/${category.slug}`;

  return {
    title,
    description,
    ...(siteUrl ? { alternates: { canonical: `${siteUrl}${path}` } } : {}),
    // Evaluated fresh from the real current public-job count on every
    // request (never a hardcoded/cached list of "known empty"
    // categories) — mirrors [country]/jobs/page.tsx's own conditional
    // noindex exactly. A category automatically becomes indexable again
    // the instant it has its first real job, and automatically reverts
    // if it later has none.
    ...(category.openJobCount === 0 ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      title,
      description,
      type: "website",
      ...(siteUrl ? { url: `${siteUrl}${path}` } : {}),
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function CategoryPage({
  params,
}: PageProps<"/category/[slug]">) {
  const { slug } = await params;
  const category = await getPublicCategoryBySlug(slug);

  if (!category) {
    notFound();
  }

  const [jobs, otherCategories] = await Promise.all([
    getPublicJobs({ categorySlug: category.slug }),
    getOtherPopulatedCategories(category.id),
  ]);

  const breadcrumbItems: BreadcrumbItem[] = [
    { label: "Home", href: "/" },
    { label: "Jobs", href: "/jobs" },
    { label: `${category.name} Jobs` },
  ];

  const siteUrl = getConfiguredSiteUrl();
  const breadcrumbListJsonLd = breadcrumbJsonLd(breadcrumbItems, siteUrl);
  const breadcrumbJsonLdString = JSON.stringify(breadcrumbListJsonLd).replace(/</g, "\\u003c");

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLdString }} />
      <CategoryView category={category} breadcrumbItems={breadcrumbItems} jobs={jobs} otherCategories={otherCategories} />
    </>
  );
}
