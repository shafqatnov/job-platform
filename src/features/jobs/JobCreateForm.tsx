"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { Button, getButtonClassName } from "@/components/Button";
import { CURRENCY_OPTIONS } from "@/constants/currencies";
import { createJobAction, type CreateJobActionState } from "@/features/jobs/createJobAction";
import { generateJobDescriptionAction } from "@/features/jobs/generateJobDescriptionAction";
import { getCitiesForCountryAction } from "@/features/jobs/getCitiesForCountryAction";
import type { CategoryOption, CityOption, CountryOption } from "@/services/jobs/referenceData";

export type JobCreateFormProps = {
  companyName: string;
  countries: CountryOption[];
  categories: CategoryOption[];
  /** Cities for whichever country is initially selected (countries[0]) — never the full City table. */
  initialCities: CityOption[];
};

const APPLICATION_METHOD_OPTIONS = [
  { value: "on_platform", label: "On this platform" },
  { value: "external_url", label: "External link" },
];

const initialState: CreateJobActionState = {};

export function JobCreateForm({ companyName, countries, categories, initialCities }: JobCreateFormProps) {
  const [state, formAction, isPending] = useActionState(createJobAction, initialState);
  const [countrySlug, setCountrySlug] = useState(countries[0]?.slug ?? "");
  const [applicationMethod, setApplicationMethod] = useState("on_platform");

  const formRef = useRef<HTMLFormElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  const selectedCountry = countries.find((country) => country.slug === countrySlug);

  // Loaded fresh from the server for whichever country is selected —
  // never the full City table (see getCitiesForCountryAction). Seeded
  // with initialCities so the default (first) country's list is already
  // correct on first paint, matching this form's previous behavior.
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

  // Reads the form's own CURRENT (unsaved) field values via FormData —
  // never a separate parallel state for every field — and asks the
  // server to draft a description from them. Generates into a preview
  // only; the real description field is never touched until the
  // employer explicitly clicks "Use this description" below, so an
  // in-progress manual draft is never silently overwritten.
  async function handleGenerateWithAi() {
    if (!formRef.current) return;
    setIsGenerating(true);
    setGenerationError(null);
    try {
      const formData = new FormData(formRef.current);
      // The Company field above is disabled and unnamed (never editable by
      // the employer), so it's never part of native form serialization —
      // set it explicitly so the AI still receives it as its top-priority input.
      formData.set("companyName", companyName);
      const result = await generateJobDescriptionAction(formData);
      if (!result.success) {
        setGenerationError(result.error);
        return;
      }
      setSuggestion(result.description);
    } catch {
      setGenerationError("We couldn't generate a description right now. Please try again or write one manually.");
    } finally {
      setIsGenerating(false);
    }
  }

  function handleUseSuggestion() {
    if (descriptionRef.current && suggestion) {
      descriptionRef.current.value = suggestion;
    }
    setSuggestion(null);
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-5">
      <div>
        <Input
          label="Company"
          value={companyName}
          disabled
          hideLabel={false}
          className="disabled:text-foreground disabled:opacity-100"
        />
        <Link
          href="/employer/company/edit"
          className={`${getButtonClassName({ size: "sm", variant: "outline" })} mt-2`}
        >
          Edit Company
        </Link>
      </div>

      <Input label="Job title" name="title" required maxLength={200} error={fieldErrors.title} />

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-foreground">Description</span>
        <textarea
          ref={descriptionRef}
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

      <div className="flex flex-col gap-2">
        <Button type="button" variant="outline" size="sm" disabled={isGenerating} onClick={handleGenerateWithAi}>
          {isGenerating ? "Generating…" : "Generate with AI"}
        </Button>
        <p className="text-sm text-muted-foreground">
          Uses the job details above to draft a starting description you can edit before posting.
        </p>
        {generationError ? (
          <p role="alert" className="text-sm text-danger-600">
            {generationError}
          </p>
        ) : null}
        {suggestion ? (
          <div className="flex flex-col gap-2 rounded-md border border-border bg-surface-muted p-3" role="status">
            <p className="text-sm font-medium text-foreground">AI-generated suggestion</p>
            <p className="whitespace-pre-wrap text-sm text-foreground">{suggestion}</p>
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={handleUseSuggestion}>
                Use this description
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setSuggestion(null)}>
                Dismiss
              </Button>
            </div>
          </div>
        ) : null}
      </div>

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
          options={effectiveCitiesForCountry.map((city) => ({ value: city.slug, label: city.name }))}
          placeholder={isLoadingCities ? "Loading cities…" : effectiveCitiesForCountry.length === 0 ? "No cities available" : "Select a city"}
          disabled={isLoadingCities || effectiveCitiesForCountry.length === 0}
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

      <Input
        label="Expiry date (optional)"
        name="expiryDate"
        type="datetime-local"
        helperText="Leave blank to use the standard listing duration."
        error={fieldErrors.expiryDate}
      />

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
