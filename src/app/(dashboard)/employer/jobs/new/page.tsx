import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Section } from "@/components/Section";
import { Card } from "@/components/Card";
import { JobCreateForm } from "@/features/jobs/JobCreateForm";
import { getSessionUser } from "@/services/auth/getSessionUser";
import { getEmployerCompany } from "@/services/employers/getEmployerCompany";
import { listCategories, listCitiesForCountry, listCountries } from "@/services/jobs/referenceData";

export const metadata: Metadata = {
  title: "Post a Job",
  robots: { index: false, follow: false },
};

export default async function NewJobPage() {
  // The (dashboard)/employer layout above already guarantees a valid,
  // active employer session; user is only possibly null here to satisfy
  // TypeScript.
  const user = await getSessionUser();
  const employerCompany = user ? await getEmployerCompany(user.id) : null;

  if (!employerCompany) {
    redirect("/employer/company/new");
  }

  const [countries, categories] = await Promise.all([listCountries(), listCategories()]);
  // JobCreateForm defaults its country selector to countries[0] — fetch
  // only that one country's cities up front (never the full table); any
  // other country's cities load on demand as the employer picks one.
  const initialCities = countries[0] ? await listCitiesForCountry(countries[0].id) : [];

  return (
    <Section aria-labelledby="new-job-heading" containerClassName="max-w-2xl">
      <h1 id="new-job-heading" className="mb-2 text-2xl font-semibold text-foreground sm:text-3xl">
        Post a job
      </h1>
      <p className="mb-8 text-muted-foreground">
        Fill in the details below. Your listing will be reviewed before it goes live.
      </p>
      <Card padding="lg">
        <JobCreateForm
          companyName={employerCompany.companyName}
          countries={countries}
          categories={categories}
          initialCities={initialCities}
        />
      </Card>
    </Section>
  );
}
