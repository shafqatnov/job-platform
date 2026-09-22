import Link from "next/link";
import { Section } from "@/components/Section";
import { FEATURED_CATEGORY_SLUGS, getCategoryBySlug } from "@/constants/categories";

const featuredCategories = FEATURED_CATEGORY_SLUGS.map(getCategoryBySlug).filter(
  (category): category is NonNullable<typeof category> => Boolean(category)
);

export function PopularCategories() {
  return (
    <Section aria-labelledby="popular-categories-heading">
      <div className="mb-8 flex flex-col gap-2">
        <h2 id="popular-categories-heading" className="text-2xl font-semibold text-foreground sm:text-3xl">
          Popular Categories
        </h2>
        <p className="text-muted-foreground">Explore roles across industries, from technology to energy.</p>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {featuredCategories.map((category) => (
          <li key={category.slug}>
            <Link
              // The Oil & Gas grid item points at its own dedicated hub
              // (aggregating Oil & Gas, Petroleum, Drilling, and
              // Offshore, plus real hiring countries/companies) rather
              // than the single-category page every other item still
              // uses — see src/app/(public)/oil-and-gas/page.tsx.
              href={category.slug === "oil-gas" ? "/oil-and-gas" : `/category/${category.slug}`}
              className="block rounded-lg border border-border bg-surface px-4 py-3.5 text-sm font-medium text-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
            >
              {category.name}
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-6 text-center">
        <Link href="/jobs" className="text-sm font-medium text-brand-600 hover:text-brand-700">
          Browse all categories →
        </Link>
      </div>
    </Section>
  );
}
