import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Section } from "@/components/Section";
import { Card } from "@/components/Card";
import { CreateCompanyForm } from "@/features/employers/CreateCompanyForm";
import { getSessionUser } from "@/services/auth/getSessionUser";
import { getEmployerCompany } from "@/services/employers/getEmployerCompany";

export const metadata: Metadata = {
  title: "Set Up Your Company",
  robots: { index: false, follow: false },
};

export default async function CreateCompanyPage() {
  // The (dashboard)/employer layout above already guarantees a valid,
  // active employer session; user is only possibly null here to satisfy
  // TypeScript.
  const user = await getSessionUser();
  const existingCompany = user ? await getEmployerCompany(user.id) : null;

  if (existingCompany) {
    redirect("/employer/jobs/new");
  }

  return (
    <Section aria-labelledby="create-company-heading" containerClassName="max-w-xl">
      <h1 id="create-company-heading" className="mb-2 text-2xl font-semibold text-foreground sm:text-3xl">
        Set up your company
      </h1>
      <p className="mb-8 text-muted-foreground">
        We need your company name before you can post a job listing.
      </p>
      <Card padding="lg">
        <CreateCompanyForm />
      </Card>
    </Section>
  );
}
