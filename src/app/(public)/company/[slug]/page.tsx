import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicCompanyBySlug, getRelatedCompanies } from "@/services/jobs/getPublicCompanyBySlug";
import { getPublicJobs } from "@/services/jobs/getPublicJobs";
import { CompanyProfileView } from "@/features/companies/CompanyProfileView";
import { breadcrumbJsonLd, type BreadcrumbItem } from "@/components/Breadcrumbs";
import { getConfiguredSiteUrl } from "@/lib/siteUrl";

export async function generateMetadata({
  params,
}: PageProps<"/company/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const company = await getPublicCompanyBySlug(slug);

  if (!company) {
    return { title: "Company" };
  }

  const title = `${company.name} Jobs and Careers`;
  const description = company.description
    ? company.description.slice(0, 300)
    : `${company.openJobCount} open ${company.openJobCount === 1 ? "role" : "roles"} at ${company.name} on Jobnura.`;
  const siteUrl = getConfiguredSiteUrl();
  const path = `/company/${company.slug}`;

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

export default async function CompanyProfilePage({
  params,
}: PageProps<"/company/[slug]">) {
  const { slug } = await params;
  const company = await getPublicCompanyBySlug(slug);

  if (!company) {
    notFound();
  }

  const [openJobs, relatedCompanies] = await Promise.all([
    getPublicJobs({ companyId: company.id }),
    getRelatedCompanies(
      company.id,
      company.hiringCategories.map((c) => c.slug)
    ),
  ]);

  // "More jobs like this" — other companies' jobs in this company's own
  // most common category, mirroring JobDetailPage's own "More jobs in
  // {country}" pattern (fetch a broader set via the existing shared
  // query, then exclude what's already shown on this page).
  const primaryCategorySlug = company.hiringCategories[0]?.slug;
  const relatedJobsRaw = primaryCategorySlug ? await getPublicJobs({ categorySlug: primaryCategorySlug }) : [];
  const relatedJobs = relatedJobsRaw.filter((job) => !openJobs.some((openJob) => openJob.id === job.id)).slice(0, 3);

  const breadcrumbItems: BreadcrumbItem[] = [
    { label: "Home", href: "/" },
    { label: "Jobs", href: "/jobs" },
    { label: company.name },
  ];

  const siteUrl = getConfiguredSiteUrl();

  // Organization structured data — populated only from fields the
  // schema actually has and can vouch for as accurate (see
  // JobDetailPage's own JobPosting JSON-LD for the identical principle):
  // name is always real; url/logo/description are included only when
  // actually present on the row, never invented.
  const organizationJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: company.name,
    ...(company.websiteUrl ? { url: company.websiteUrl } : {}),
    ...(company.logoUrl ? { logo: company.logoUrl } : {}),
    ...(company.description ? { description: company.description } : {}),
  };

  const breadcrumbListJsonLd = breadcrumbJsonLd(breadcrumbItems, siteUrl);

  // Escape "<" so nothing in the company's own text (e.g. a
  // "</script>" sequence in a description) can break out of these
  // script tags — matching JobDetailPage's own defensive escaping.
  const organizationJsonLdString = JSON.stringify(organizationJsonLd).replace(/</g, "\\u003c");
  const breadcrumbJsonLdString = JSON.stringify(breadcrumbListJsonLd).replace(/</g, "\\u003c");

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: organizationJsonLdString }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLdString }} />
      <CompanyProfileView
        company={company}
        breadcrumbItems={breadcrumbItems}
        openJobs={openJobs}
        relatedJobs={relatedJobs}
        relatedCompanies={relatedCompanies}
      />
    </>
  );
}
