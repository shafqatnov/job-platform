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
};

/**
 * Visual-only filter bar. Submitting only prevents a default page reload
 * — no filtering happens yet. The country field is disabled when the
 * page is already scoped to one country via its URL segment, since
 * changing it here would require real navigation this component doesn't
 * perform; every other field stays enabled but equally non-functional,
 * consistent with the homepage's search form.
 */
export function JobFiltersBar({ lockedCountry }: JobFiltersBarProps) {
  return (
    <form
      onSubmit={(event) => event.preventDefault()}
      className="grid gap-4 rounded-xl border border-border bg-surface p-4 shadow-md sm:grid-cols-2 sm:p-6 lg:grid-cols-3 xl:grid-cols-4"
    >
      <Input
        label="Keywords"
        name="q"
        placeholder="Job title, skill, or company"
        autoComplete="off"
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
