"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { Button } from "@/components/Button";
import {
  createCandidateProfileAction,
  type CreateCandidateProfileActionState,
} from "@/features/candidates/createCandidateProfileAction";
import { getCitiesForCountryAction } from "@/features/jobs/getCitiesForCountryAction";
import type { CityOption, CountryOption } from "@/services/jobs/referenceData";

export type CreateCandidateProfileFormProps = {
  countries: CountryOption[];
  /** Cities for whichever country is initially selected (countries[0]) — never the full City table. */
  initialCities: CityOption[];
  /** Where to send the candidate after a successful profile creation, e.g. back to the job they were applying to. */
  redirectTo?: string;
};

const initialState: CreateCandidateProfileActionState = {};

export function CreateCandidateProfileForm({ countries, initialCities, redirectTo }: CreateCandidateProfileFormProps) {
  const [state, formAction, isPending] = useActionState(createCandidateProfileAction, initialState);
  const [countrySlug, setCountrySlug] = useState(countries[0]?.slug ?? "");

  const selectedCountry = countries.find((country) => country.slug === countrySlug);

  // Loaded fresh from the server for whichever country is selected —
  // never the full City table (see getCitiesForCountryAction).
  const [citiesForCountry, setCitiesForCountry] = useState<CityOption[]>(initialCities);
  const [isLoadingCities, setIsLoadingCities] = useState(false);
  const loadedForCountryId = useRef(selectedCountry?.id);

  useEffect(() => {
    if (!selectedCountry || loadedForCountryId.current === selectedCountry.id) {
      return;
    }
    let cancelled = false;
    setCitiesForCountry([]);
    setIsLoadingCities(true);
    getCitiesForCountryAction(selectedCountry.id).then((cities) => {
      if (!cancelled) {
        loadedForCountryId.current = selectedCountry.id;
        setCitiesForCountry(cities);
        setIsLoadingCities(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedCountry]);

  // selectedCountry can only be momentarily undefined (e.g. no countries
  // exist at all) — derived at render time rather than reset via effect.
  const effectiveCitiesForCountry = selectedCountry ? citiesForCountry : [];

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
          placeholder={isLoadingCities ? "Loading cities…" : effectiveCitiesForCountry.length === 0 ? "No cities available" : "Select a city"}
          disabled={isLoadingCities || effectiveCitiesForCountry.length === 0}
          options={effectiveCitiesForCountry.map((city) => ({ value: city.slug, label: city.name }))}
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
