import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Section } from "@/components/Section";
import { Card } from "@/components/Card";
import { CreateCandidateProfileForm } from "@/features/candidates/CreateCandidateProfileForm";
import { getSessionUser } from "@/services/auth/getSessionUser";
import { getCandidateProfile } from "@/services/candidates/getCandidateProfile";
import { listCountries, listCitiesForCountry } from "@/services/jobs/referenceData";

export const metadata: Metadata = {
  title: "Create Your Candidate Profile",
  robots: { index: false, follow: false },
};

function safeRedirectTarget(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string" && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return undefined;
}

export default async function CreateCandidateProfilePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // The (dashboard)/candidate layout above already guarantees a valid,
  // active candidate session; user is only possibly null here to
  // satisfy TypeScript.
  const user = await getSessionUser();
  const existingProfile = user ? await getCandidateProfile(user.id) : null;
  const redirectTo = safeRedirectTarget((await searchParams).redirectTo);

  if (existingProfile) {
    redirect(redirectTo ?? "/");
  }

  const countries = await listCountries();
  // This form defaults its country selector to countries[0] — fetch only
  // that one country's cities up front (never the full table); any other
  // country's cities load on demand as the candidate picks one.
  const initialCities = countries[0] ? await listCitiesForCountry(countries[0].id) : [];

  return (
    <Section aria-labelledby="create-profile-heading" containerClassName="max-w-xl">
      <h1 id="create-profile-heading" className="mb-2 text-2xl font-semibold text-foreground sm:text-3xl">
        Create your candidate profile
      </h1>
      <p className="mb-8 text-muted-foreground">
        We need a few details before you can apply to jobs.
      </p>
      <Card padding="lg">
        <CreateCandidateProfileForm countries={countries} initialCities={initialCities} redirectTo={redirectTo} />
      </Card>
    </Section>
  );
}
