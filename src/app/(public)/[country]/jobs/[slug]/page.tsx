import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCountryBySlug } from "@/constants/countries";
import { getPublicJobBySlug } from "@/services/jobs/getPublicJobBySlug";
import { getPublicJobs } from "@/services/jobs/getPublicJobs";
import { JobDetailView } from "@/features/jobs/JobDetailView";
import { getSessionUser } from "@/services/auth/getSessionUser";
import { getCandidateProfile } from "@/services/candidates/getCandidateProfile";
import { hasApplied } from "@/services/applications/hasApplied";
import { isJobSaved } from "@/services/candidates/isJobSaved";
import type { ApplyState } from "@/features/jobs/ApplyButton";
import type { SaveState } from "@/features/jobs/SaveJobButton";
import { getConfiguredSiteUrl } from "@/lib/siteUrl";
import { breadcrumbJsonLd, type BreadcrumbItem } from "@/components/Breadcrumbs";
import type { PublicJobDetail } from "@/services/jobs/getPublicJobBySlug";

/**
 * Home -> {Country} Jobs -> {Category} -> {Job title}, mirroring
 * CompanyProfilePage's own breadcrumb construction exactly (same
 * Breadcrumbs component, same breadcrumbJsonLd helper). The country link
 * reuses the existing canonical /{country}/jobs page; the category link
 * points to the category's own canonical /category/{slug} landing page
 * (see src/app/(public)/category/[slug]/page.tsx) rather than the older
 * /{country}/jobs?category= query-parameter filter, per that page's own
 * "use canonical category URLs where a landing page exists" goal — the
 * query-parameter filter itself is untouched and still works. The
 * category breadcrumb is only included when genuinely present on this
 * job (categoryId is a required column, but this stays defensive rather
 * than assuming the type never lies). A pure function (no DB/request
 * access) so it can be unit tested directly.
 */
export function buildJobBreadcrumbItems(
  country: { slug: string; name: string },
  job: Pick<PublicJobDetail, "title" | "categorySlug" | "categoryName">
): BreadcrumbItem[] {
  return [
    { label: "Home", href: "/" },
    { label: `${country.name} Jobs`, href: `/${country.slug}/jobs` },
    ...(job.categorySlug && job.categoryName
      ? [{ label: job.categoryName, href: `/category/${job.categorySlug}` }]
      : []),
    { label: job.title },
  ];
}

export async function generateMetadata({
  params,
}: PageProps<"/[country]/jobs/[slug]">): Promise<Metadata> {
  const { country: countrySlug, slug } = await params;
  const country = getCountryBySlug(countrySlug);

  // Not calling notFound() here: metadata generation runs in a separate
  // phase from rendering and did not resolve to this segment's
  // not-found.tsx in earlier testing (see [country]/jobs/page.tsx). The
  // page component below is the single source of truth for the 404.
  if (!country) {
    return { title: "Job" };
  }

  const job = await getPublicJobBySlug({ countryUrlSlug: country.slug, jobSlug: slug });

  if (!job) {
    return { title: "Job" };
  }

  const title = `${job.title} at ${job.companyName}`;
  const description = `${job.title} at ${job.companyName} — a ${job.categoryName} role in ${job.city}, ${job.countryName}.`;
  const siteUrl = getConfiguredSiteUrl();
  // Only ever built from a job that has already been confirmed to
  // exist and be publicly visible above — never an invalid/guessed job
  // or country.
  const path = `/${country.slug}/jobs/${job.slug}`;

  return {
    title,
    description,
    ...(siteUrl ? { alternates: { canonical: `${siteUrl}${path}` } } : {}),
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

export default async function JobDetailPage({
  params,
}: PageProps<"/[country]/jobs/[slug]">) {
  const { country: countrySlug, slug } = await params;
  const country = getCountryBySlug(countrySlug);

  if (!country) {
    notFound();
  }

  const job = await getPublicJobBySlug({ countryUrlSlug: country.slug, jobSlug: slug });

  if (!job) {
    notFound();
  }

  const countryJobs = await getPublicJobs({ countryUrlSlug: country.slug });
  const relatedJobs = countryJobs.filter((otherJob) => otherJob.slug !== job.slug).slice(0, 3);

  const currentPath = `/${country.slug}/jobs/${slug}`;
  const createProfileHref = `/candidate/profile/create?redirectTo=${encodeURIComponent(currentPath)}`;

  const user = await getSessionUser();
  let applyState: ApplyState;
  let saveState: SaveState;
  if (!user) {
    applyState = "signed_out";
    saveState = "signed_out";
  } else if (user.role !== "candidate") {
    applyState = "not_candidate";
    saveState = "not_candidate";
  } else {
    const candidateProfile = await getCandidateProfile(user.id);
    if (!candidateProfile) {
      applyState = "no_profile";
      saveState = "no_profile";
    } else {
      applyState = (await hasApplied(candidateProfile.id, job.id)) ? "already_applied" : "can_apply";
      saveState = (await isJobSaved(candidateProfile.id, job.id)) ? "saved" : "unsaved";
    }
  }

  // JobPosting JSON-LD, populated only from fields the schema actually
  // has and can vouch for as accurate:
  // - title, description, datePosted, hiringOrganization, jobLocation
  //   (addressCountry uses the real ISO code) are all backed by real
  //   columns and are Google's required JobPosting properties.
  // - validThrough is included only when expiresAt is actually set.
  // - employmentType and baseSalary are deliberately OMITTED: Job has no
  //   employmentType column at all, and while salaryMin/salaryMax/
  //   currencyCode exist, there is no stored pay-period/unit (hourly,
  //   monthly, yearly), which schema.org's baseSalary requires — adding
  //   a guessed unitText would be inventing information not present in
  //   the schema, which this task explicitly forbids.
  const jobPostingJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.description,
    datePosted: job.postedAt,
    hiringOrganization: {
      "@type": "Organization",
      name: job.companyName,
      ...(job.companyWebsiteUrl ? { sameAs: job.companyWebsiteUrl } : {}),
    },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: job.city,
        addressCountry: job.countryCode,
      },
    },
  };
  if (job.expiresAt) {
    jobPostingJsonLd.validThrough = job.expiresAt;
  }

  // Escape "<" so nothing in the job's own text (e.g. a "</script>"
  // sequence) can break out of this script tag.
  const jobPostingJsonLdString = JSON.stringify(jobPostingJsonLd).replace(/</g, "\\u003c");

  const siteUrl = getConfiguredSiteUrl();
  const breadcrumbItems = buildJobBreadcrumbItems(country, job);
  const breadcrumbListJsonLd = breadcrumbJsonLd(breadcrumbItems, siteUrl);
  const breadcrumbJsonLdString = JSON.stringify(breadcrumbListJsonLd).replace(/</g, "\\u003c");

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jobPostingJsonLdString }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLdString }} />
      <JobDetailView
        job={job}
        breadcrumbItems={breadcrumbItems}
        relatedJobs={relatedJobs}
        applyState={applyState}
        saveState={saveState}
        createProfileHref={createProfileHref}
      />
    </>
  );
}
