"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { Button } from "@/components/Button";
import {
  updateCandidateProfileAction,
  type UpdateCandidateProfileActionState,
} from "@/features/candidates/updateCandidateProfileAction";
import { getCitiesForCountryAction } from "@/features/jobs/getCitiesForCountryAction";
import type { CityOption, CountryOption } from "@/services/jobs/referenceData";

export type EditCandidateProfileFormProps = {
  countries: CountryOption[];
  /** Cities for the profile's already-saved country — never the full City table. */
  initialCities: CityOption[];
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
  initialCities,
  initialFullName,
  initialHeadline,
  initialCountrySlug,
  initialCitySlug,
}: EditCandidateProfileFormProps) {
  const [state, formAction, isPending] = useActionState(updateCandidateProfileAction, initialState);
  const [countrySlug, setCountrySlug] = useState(initialCountrySlug);

  const selectedCountry = countries.find((country) => country.slug === countrySlug);

  // Loaded fresh from the server for whichever country is selected —
  // never the full City table (see getCitiesForCountryAction). Seeded
  // with initialCities (the profile's already-saved country) so the
  // saved city selection is already present as a selectable option on
  // first paint.
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
