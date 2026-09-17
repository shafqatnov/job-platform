"use client";

import { useActionState, useMemo, useState } from "react";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { Button } from "@/components/Button";
import { CURRENCY_OPTIONS } from "@/constants/currencies";
import { createJobAction, type CreateJobActionState } from "@/features/jobs/createJobAction";
import type { CategoryOption, CityOption, CountryOption } from "@/services/jobs/referenceData";

export type JobCreateFormProps = {
  companyName: string;
  countries: CountryOption[];
  categories: CategoryOption[];
  cities: CityOption[];
};

const APPLICATION_METHOD_OPTIONS = [
  { value: "on_platform", label: "On this platform" },
  { value: "external_url", label: "External link" },
];

const initialState: CreateJobActionState = {};

export function JobCreateForm({ companyName, countries, categories, cities }: JobCreateFormProps) {
  const [state, formAction, isPending] = useActionState(createJobAction, initialState);
  const [countrySlug, setCountrySlug] = useState(countries[0]?.slug ?? "");
  const [applicationMethod, setApplicationMethod] = useState("on_platform");

  const selectedCountry = countries.find((country) => country.slug === countrySlug);
  const citiesForCountry = useMemo(
    () => cities.filter((city) => city.countryId === selectedCountry?.id),
    [cities, selectedCountry]
  );

  const fieldErrors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <Input label="Company" value={companyName} disabled hideLabel={false} />

      <Input label="Job title" name="title" required maxLength={200} error={fieldErrors.title} />

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-foreground">Description</span>
        <textarea
          name="description"
          required
          rows={8}
          maxLength={10000}
          aria-invalid={Boolean(fieldErrors.description) || undefined}
          className="rounded-md border border-border bg-surface px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        />
        {fieldErrors.description ? (
          <p className="text-sm text-danger-600">{fieldErrors.description}</p>
        ) : null}
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Country"
          name="country"
          value={countrySlug}
          onChange={(event) => setCountrySlug(event.target.value)}
          options={countries.map((country) => ({ value: country.slug, label: country.name }))}
          error={fieldErrors.country}
        />
        <Select
          label="City"
          name="city"
          options={citiesForCountry.map((city) => ({ value: city.slug, label: city.name }))}
          placeholder={citiesForCountry.length === 0 ? "No cities available" : "Select a city"}
          disabled={citiesForCountry.length === 0}
          error={fieldErrors.city}
        />
      </div>

      <Select
        label="Category"
        name="category"
        placeholder="Select a category"
        options={categories.map((category) => ({ value: category.slug, label: category.name }))}
        error={fieldErrors.category}
      />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-foreground">Salary (optional)</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="Minimum" name="salaryMin" type="number" min={0} hideLabel />
          <Input label="Maximum" name="salaryMax" type="number" min={0} hideLabel />
          <Select
            label="Currency"
            name="currencyCode"
            placeholder="Currency"
            hideLabel
            options={CURRENCY_OPTIONS}
            error={fieldErrors.currency}
          />
        </div>
        {fieldErrors.salary ? <p className="text-sm text-danger-600">{fieldErrors.salary}</p> : null}
      </fieldset>

      <Select
        label="How should candidates apply?"
        name="applicationMethod"
        value={applicationMethod}
        onChange={(event) => setApplicationMethod(event.target.value)}
        options={APPLICATION_METHOD_OPTIONS}
        error={fieldErrors.applicationMethod}
      />

      {applicationMethod === "external_url" ? (
        <Input
          label="Application URL"
          name="externalApplicationUrl"
          type="url"
          placeholder="https://example.com/apply"
          error={fieldErrors.externalUrl}
        />
      ) : null}

      {state.formError ? (
        <p role="alert" className="text-sm text-danger-600">
          {state.formError}
        </p>
      ) : null}

      <Button type="submit" size="lg" fullWidth disabled={isPending}>
        {isPending ? "Submitting…" : "Submit for review"}
      </Button>
      <p className="text-sm text-muted-foreground">
        New listings are reviewed before they go live and won&apos;t appear publicly until approved.
      </p>
    </form>
  );
}
