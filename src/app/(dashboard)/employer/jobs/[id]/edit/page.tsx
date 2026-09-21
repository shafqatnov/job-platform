import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Section } from "@/components/Section";
import { Card } from "@/components/Card";
import { JobEditForm } from "@/features/jobs/JobEditForm";
import { getSessionUser } from "@/services/auth/getSessionUser";
import { getEmployerCompany } from "@/services/employers/getEmployerCompany";
import { getEmployerJobForManage } from "@/services/jobs/getEmployerJobForManage";
import { listCategories, listCitiesForCountry, findCountryBySlug } from "@/services/jobs/referenceData";

export const metadata: Metadata = {
  title: "Edit Job",
  robots: { index: false, follow: false },
};

export default async function EmployerJobEditPage({ params }: PageProps<"/employer/jobs/[id]/edit">) {
  // The (dashboard)/employer layout above already guarantees a valid,
  // active employer session; user is only possibly null here to
  // satisfy TypeScript.
  const user = await getSessionUser();
  const employerCompany = user ? await getEmployerCompany(user.id) : null;
  if (!employerCompany) {
    redirect("/employer/company/new");
  }

  const { id } = await params;
  const job = await getEmployerJobForManage(id, employerCompany.companyId);
  if (!job) {
    notFound();
  }
  if (job.status !== "pending_review" && job.status !== "active") {
    redirect(`/employer/jobs/${job.id}`);
  }

  // Country is not editable on this form (see updateJob.ts) — resolve the
  // job's existing country and fetch only its cities, never the full table.
  const [categories, jobCountry] = await Promise.all([listCategories(), findCountryBySlug(job.countrySlug)]);
  const citiesInCountry = jobCountry ? await listCitiesForCountry(jobCountry.id) : [];

  return (
    <Section aria-labelledby="edit-job-heading" containerClassName="max-w-2xl">
      <h1 id="edit-job-heading" className="mb-8 text-2xl font-semibold text-foreground sm:text-3xl">
        Edit job
      </h1>
      <Card padding="lg">
        <JobEditForm
          jobId={job.id}
          companyName={job.companyName}
          citiesInCountry={citiesInCountry}
          categories={categories}
          initialTitle={job.title}
          initialDescription={job.description}
          initialCitySlug={job.citySlug}
          initialCategorySlug={job.categorySlug}
          initialSalaryMin={job.salaryMin?.toString() ?? ""}
          initialSalaryMax={job.salaryMax?.toString() ?? ""}
          initialCurrencyCode={job.currencyCode ?? ""}
          initialApplicationMethod={job.applicationMethod}
          initialExternalApplicationUrl={job.externalApplicationUrl ?? ""}
        />
      </Card>
    </Section>
  );
}
