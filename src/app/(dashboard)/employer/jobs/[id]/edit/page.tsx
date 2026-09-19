import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Section } from "@/components/Section";
import { Card } from "@/components/Card";
import { JobEditForm } from "@/features/jobs/JobEditForm";
import { getSessionUser } from "@/services/auth/getSessionUser";
import { getEmployerCompany } from "@/services/employers/getEmployerCompany";
import { getEmployerJobForManage } from "@/services/jobs/getEmployerJobForManage";
import { listCategories, listCities } from "@/services/jobs/referenceData";

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

  const [categories, allCities] = await Promise.all([listCategories(), listCities()]);
  const citiesInCountry = allCities.filter((city) => {
    // Job.countrySlug isn't in the manage-detail shape; city rows are
    // already scoped to their own country id, so filtering by whichever
    // country this job's current city belongs to keeps the form to
    // exactly the cities valid for this job's (immutable) country.
    return allCities.find((c) => c.slug === job.citySlug)?.countryId === city.countryId;
  });

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
