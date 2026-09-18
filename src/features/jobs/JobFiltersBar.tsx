"use client";

import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { Button } from "@/components/Button";
import { SearchIcon, MapPinIcon, GlobeIcon, BriefcaseIcon } from "@/components/icons";
import { COUNTRIES, type CountryOption } from "@/constants/countries";
import { JOB_CATEGORIES } from "@/constants/categories";
import { WORK_MODES, EMPLOYMENT_TYPES } from "@/features/jobs/constants";

export type JobFiltersBarProps = {
  /** When set, the country field is locked to this country instead of editable. */
  lockedCountry?: CountryOption;
  /** Current keyword filter, if any — reflected back into the field after a search. */
  defaultKeywords?: string;
  /** Current category filter (slug), if any — reflected back into the field after a search. */
  defaultCategorySlug?: string;
};

/**
 * Real filter bar: a plain HTML GET form. Submitting navigates to /jobs
 * (or, when scoped to a country, /{country}/jobs) with each enabled
 * field's value as a query parameter, read by the corresponding page
 * and applied via getPublicJobs(). The country field is disabled when
 * the page is already scoped to one country via its URL segment — a
 * disabled field is never included in a form submission, which is
 * exactly correct here (the route segment already carries that scope).
 *
 * Work Mode and Employment Type remain present and still submit their
 * values into the URL, but are NOT applied as filters: there is no
 * workMode/employmentType column on Job in prisma/schema.prisma, and
 * adding one is a schema change out of scope for this change. Wiring
 * every other field is still a real, complete improvement over today's
 * fully non-functional form.
 */
export function JobFiltersBar({ lockedCountry, defaultKeywords, defaultCategorySlug }: JobFiltersBarProps) {
  return (
    <form
      action={lockedCountry ? `/${lockedCountry.slug}/jobs` : "/jobs"}
      method="get"
      className="grid gap-4 rounded-xl border border-border bg-surface p-4 shadow-md sm:grid-cols-2 sm:p-6 lg:grid-cols-3 xl:grid-cols-4"
    >
      <Input
        label="Keywords"
        name="q"
        placeholder="Job title, skill, or company"
        autoComplete="off"
        defaultValue={defaultKeywords ?? ""}
        icon={<SearchIcon className="h-4 w-4" />}
        className="sm:col-span-2 xl:col-span-2"
      />
      <Input
        label="Location"
        name="location"
        placeholder="City or region"
        autoComplete="off"
        icon={<MapPinIcon className="h-4 w-4" />}
      />
      <Select
        label="Country"
        name="country"
        placeholder="Any country"
        icon={<GlobeIcon className="h-4 w-4" />}
        disabled={Boolean(lockedCountry)}
        defaultValue={lockedCountry?.code ?? ""}
        helperText={lockedCountry ? `Locked to ${lockedCountry.name} for this page.` : undefined}
        options={COUNTRIES.map((country) => ({ value: country.code, label: country.name }))}
      />
      <Select
        label="Category"
        name="category"
        placeholder="Any category"
        icon={<BriefcaseIcon className="h-4 w-4" />}
        defaultValue={defaultCategorySlug ?? ""}
        options={JOB_CATEGORIES.map((category) => ({ value: category.slug, label: category.name }))}
      />
      <Select label="Work Mode" name="workMode" placeholder="Any work mode" options={WORK_MODES} />
      <Select
        label="Employment Type"
        name="employmentType"
        placeholder="Any employment type"
        options={EMPLOYMENT_TYPES}
      />
      <div className="flex items-end">
        <Button type="submit" size="lg" fullWidth>
          Search Jobs
        </Button>
      </div>
    </form>
  );
}
