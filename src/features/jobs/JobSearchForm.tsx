"use client";

import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { Button } from "@/components/Button";
import { SearchIcon, GlobeIcon, BriefcaseIcon } from "@/components/icons";
import { COUNTRIES } from "@/constants/countries";
import { JOB_CATEGORIES } from "@/constants/categories";

/**
 * Visual-only job search form. Submitting only prevents a default page
 * reload — no search is performed. Kept as a single self-contained
 * component so wiring a real search service later means changing this
 * file's submit handling, not redesigning the homepage around it.
 */
export function JobSearchForm() {
  return (
    <form
      onSubmit={(event) => event.preventDefault()}
      className="grid gap-4 rounded-2xl border border-border bg-surface p-4 shadow-xl sm:p-6 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto] lg:items-end"
    >
      <Input
        label="Keywords"
        name="q"
        placeholder="Job title, skill, or company"
        autoComplete="off"
        icon={<SearchIcon className="h-4 w-4" />}
        className="sm:col-span-2 lg:col-span-1"
      />
      <Select
        label="Country"
        name="country"
        placeholder="Any country"
        icon={<GlobeIcon className="h-4 w-4" />}
        options={COUNTRIES.map((country) => ({ value: country.code, label: country.name }))}
      />
      <Select
        label="Category"
        name="category"
        placeholder="Any category"
        icon={<BriefcaseIcon className="h-4 w-4" />}
        options={JOB_CATEGORIES.map((category) => ({ value: category.slug, label: category.name }))}
      />
      <Button type="submit" size="lg" className="w-full lg:w-auto">
        Search Jobs
      </Button>
    </form>
  );
}
