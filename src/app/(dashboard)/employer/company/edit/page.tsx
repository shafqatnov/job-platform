import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Section } from "@/components/Section";
import { Card } from "@/components/Card";
import { EditCompanyForm } from "@/features/employers/EditCompanyForm";
import { getSessionUser } from "@/services/auth/getSessionUser";
import { getEmployerCompany } from "@/services/employers/getEmployerCompany";
import { listCountries } from "@/services/jobs/referenceData";

export const metadata: Metadata = {
  title: "Edit Company",
  robots: { index: false, follow: false },
};

export default async function EditCompanyPage() {
  // The (dashboard)/employer layout above already guarantees a valid,
  // active employer session; user is only possibly null here to satisfy
  // TypeScript.
  const user = await getSessionUser();
  const employerCompany = user ? await getEmployerCompany(user.id) : null;

  if (!employerCompany) {
    redirect("/employer/company/new");
  }

  const countries = await listCountries();

  return (
    <Section aria-labelledby="edit-company-heading" containerClassName="max-w-xl">
      <h1 id="edit-company-heading" className="mb-8 text-2xl font-semibold text-foreground sm:text-3xl">
        Edit your company
      </h1>
      <Card padding="lg">
        <EditCompanyForm
          countries={countries}
          initialName={employerCompany.companyName}
          initialWebsiteUrl={employerCompany.websiteUrl ?? ""}
          initialDescription={employerCompany.description ?? ""}
          initialCountrySlug={employerCompany.countrySlug ?? ""}
        />
      </Card>
    </Section>
  );
}
