"use client";

import { useActionState, useMemo, useState } from "react";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { Button } from "@/components/Button";
import {
  createCandidateProfileAction,
  type CreateCandidateProfileActionState,
} from "@/features/candidates/createCandidateProfileAction";
import type { CityOption, CountryOption } from "@/services/jobs/referenceData";

export type CreateCandidateProfileFormProps = {
  countries: CountryOption[];
  cities: CityOption[];
  /** Where to send the candidate after a successful profile creation, e.g. back to the job they were applying to. */
  redirectTo?: string;
};

const initialState: CreateCandidateProfileActionState = {};

export function CreateCandidateProfileForm({ countries, cities, redirectTo }: CreateCandidateProfileFormProps) {
  const [state, formAction, isPending] = useActionState(createCandidateProfileAction, initialState);
  const [countrySlug, setCountrySlug] = useState(countries[0]?.slug ?? "");

  const selectedCountry = countries.find((country) => country.slug === countrySlug);
  const citiesForCountry = useMemo(
    () => cities.filter((city) => city.countryId === selectedCountry?.id),
    [cities, selectedCountry]
  );

  const fieldErrors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {redirectTo ? <input type="hidden" name="redirectTo" value={redirectTo} /> : null}

      <Input label="Full name" name="fullName" required maxLength={200} error={fieldErrors.fullName} />

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

      <Button type="submit" size="lg" fullWidth disabled={isPending}>
        {isPending ? "Saving…" : "Create profile"}
      </Button>
    </form>
  );
}
