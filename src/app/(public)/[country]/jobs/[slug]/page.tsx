import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCountryBySlug } from "@/constants/countries";
import { getPublicJobBySlug } from "@/services/jobs/getPublicJobBySlug";
import { getPublicJobs } from "@/services/jobs/getPublicJobs";
import { JobDetailView } from "@/features/jobs/JobDetailView";

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

  return {
    title: `${job.title} at ${job.companyName}`,
    description: `${job.title} at ${job.companyName} — a ${job.categoryName} role in ${job.city}, ${job.countryName}.`,
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

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jobPostingJsonLdString }}
      />
      <JobDetailView job={job} relatedJobs={relatedJobs} />
    </>
  );
}
