import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/Section";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { getButtonClassName } from "@/components/Button";
import { EditCandidateProfileForm } from "@/features/candidates/EditCandidateProfileForm";
import { getSessionUser } from "@/services/auth/getSessionUser";
import { getCandidateProfile } from "@/services/candidates/getCandidateProfile";
import { listCountries, listCities } from "@/services/jobs/referenceData";

export const metadata: Metadata = {
  title: "Your Profile",
  robots: { index: false, follow: false },
};

export default async function CandidateProfilePage() {
  // The (dashboard)/candidate layout above already guarantees a valid,
  // active candidate session; user is only possibly null here to
  // satisfy TypeScript.
  const user = await getSessionUser();
  const profile = user ? await getCandidateProfile(user.id) : null;

  if (!profile) {
    return (
      <Section aria-labelledby="profile-heading" containerClassName="max-w-xl">
        <h1 id="profile-heading" className="mb-8 text-2xl font-semibold text-foreground sm:text-3xl">
          Your profile
        </h1>
        <Card padding="lg">
          <EmptyState
            title="You haven't created a profile yet"
            description="Create your candidate profile to apply to jobs and manage your details."
            action={
              <Link href="/candidate/profile/create" className={getButtonClassName({ size: "sm" })}>
                Create profile
              </Link>
            }
          />
        </Card>
      </Section>
    );
  }

  const [countries, cities] = await Promise.all([listCountries(), listCities()]);

  return (
    <Section aria-labelledby="profile-heading" containerClassName="max-w-xl">
      <h1 id="profile-heading" className="mb-8 text-2xl font-semibold text-foreground sm:text-3xl">
        Your profile
      </h1>
      <Card padding="lg">
        <EditCandidateProfileForm
          countries={countries}
          cities={cities}
          initialFullName={profile.fullName}
          initialHeadline={profile.headline ?? ""}
          initialCountrySlug={profile.countrySlug}
          initialCitySlug={profile.citySlug ?? ""}
        />
      </Card>
    </Section>
  );
}
