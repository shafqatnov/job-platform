import Link from "next/link";
import { Section } from "@/components/Section";
import { FEATURED_COUNTRY_SLUGS, getCountryBySlug } from "@/constants/countries";

const featuredCountries = FEATURED_COUNTRY_SLUGS.map(getCountryBySlug).filter(
  (country): country is NonNullable<typeof country> => Boolean(country)
);

export function PopularCountries() {
  return (
    <Section aria-labelledby="popular-countries-heading" className="bg-surface-muted">
      <div className="mb-8 flex flex-col gap-2">
        <h2 id="popular-countries-heading" className="text-2xl font-semibold text-foreground sm:text-3xl">
          Popular Countries
        </h2>
        <p className="text-muted-foreground">Search for jobs in these markets.</p>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {featuredCountries.map((country) => (
          <li key={country.code}>
            <Link
              href={`/${country.slug}/jobs`}
              className="block rounded-lg border border-border bg-surface px-4 py-3.5 text-sm font-medium text-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
            >
              {country.name}
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}
