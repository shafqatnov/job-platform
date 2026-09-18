"use client";

import { useActionState, useMemo, useState } from "react";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { Button } from "@/components/Button";
import {
  updateCandidateProfileAction,
  type UpdateCandidateProfileActionState,
} from "@/features/candidates/updateCandidateProfileAction";
import type { CityOption, CountryOption } from "@/services/jobs/referenceData";

export type EditCandidateProfileFormProps = {
  countries: CountryOption[];
  cities: CityOption[];
  initialFullName: string;
  initialHeadline: string;
  initialCountrySlug: string;
  initialCitySlug: string;
};

const initialState: UpdateCandidateProfileActionState = {};

/**
 * Mirrors CreateCandidateProfileForm.tsx's structure closely (same
 * country->city cascading select behavior) — this is an edit of the
 * same underlying fields plus one addition (headline), not a
 * redesign.
 */
export function EditCandidateProfileForm({
  countries,
  cities,
  initialFullName,
  initialHeadline,
  initialCountrySlug,
  initialCitySlug,
}: EditCandidateProfileFormProps) {
  const [state, formAction, isPending] = useActionState(updateCandidateProfileAction, initialState);
  const [countrySlug, setCountrySlug] = useState(initialCountrySlug);

  const selectedCountry = countries.find((country) => country.slug === countrySlug);
  const citiesForCountry = useMemo(
    () => cities.filter((city) => city.countryId === selectedCountry?.id),
    [cities, selectedCountry]
  );

  const fieldErrors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <Input
        label="Full name"
        name="fullName"
        required
        maxLength={200}
        defaultValue={initialFullName}
        error={fieldErrors.fullName}
      />

      <Input
        label="Headline (optional)"
        name="headline"
        maxLength={200}
        defaultValue={initialHeadline}
        helperText='A short professional tagline, e.g. "Senior Petroleum Engineer".'
        error={fieldErrors.headline}
      />

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
          label="City (optional)"
          name="city"
          defaultValue={initialCitySlug}
          placeholder={citiesForCountry.length === 0 ? "No cities available" : "Select a city"}
          disabled={citiesForCountry.length === 0}
          options={citiesForCountry.map((city) => ({ value: city.slug, label: city.name }))}
          error={fieldErrors.city}
        />
      </div>

      {state.formError ? (
        <p role="alert" className="text-sm text-danger-600">
          {state.formError}
        </p>
      ) : null}
      {state.success ? (
        <p
          role="status"
          className="rounded-md border border-brand-600 bg-brand-50 px-4 py-3 text-sm text-brand-700 dark:bg-brand-500/10 dark:text-brand-400"
        >
          Profile updated.
        </p>
      ) : null}

      <Button type="submit" size="lg" fullWidth disabled={isPending}>
        {isPending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
