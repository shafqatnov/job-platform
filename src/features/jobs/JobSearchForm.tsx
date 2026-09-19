"use client";

import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { Button } from "@/components/Button";
import { SearchIcon, GlobeIcon, BriefcaseIcon } from "@/components/icons";
import { COUNTRIES } from "@/constants/countries";
import { JOB_CATEGORIES } from "@/constants/categories";

/**
 * Job search form. A plain HTML GET form to /jobs — submitting performs
 * a real browser navigation with each field's value as a query
 * parameter (?q=...&country=...&category=...), read by
 * src/app/(public)/jobs/page.tsx and applied via getPublicJobs(). No
 * client-side JS is needed for this; the native form submission already
 * does the right thing.
 */
export function JobSearchForm() {
  return (
    <form
      action="/jobs"
      method="get"
      className="grid gap-4 rounded-2xl border border-border bg-surface p-4 shadow-xl sm:p-6 sm:grid-cols-2 lg:grid-cols-[1.5fr_minmax(14rem,1fr)_minmax(14rem,1fr)_auto] lg:items-end"
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
        defaultValue=""
        icon={<GlobeIcon className="h-4 w-4" />}
        options={COUNTRIES.map((country) => ({ value: country.code, label: country.name }))}
      />
      <Select
        label="Category"
        name="category"
        placeholder="Any category"
        defaultValue=""
        icon={<BriefcaseIcon className="h-4 w-4" />}
        options={JOB_CATEGORIES.map((category) => ({ value: category.slug, label: category.name }))}
      />
      <Button type="submit" size="lg" className="w-full lg:w-auto">
        Search Jobs
      </Button>
    </form>
  );
}
