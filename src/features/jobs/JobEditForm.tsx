"use client";

import { useActionState, useState } from "react";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { Button } from "@/components/Button";
import { CURRENCY_OPTIONS } from "@/constants/currencies";
import { updateJobAction, type UpdateJobActionState } from "@/features/jobs/updateJobAction";
import type { CategoryOption, CityOption } from "@/services/jobs/referenceData";

export type JobEditFormProps = {
  jobId: string;
  companyName: string;
  citiesInCountry: CityOption[];
  categories: CategoryOption[];
  initialTitle: string;
  initialDescription: string;
  initialCitySlug: string;
  initialCategorySlug: string;
  initialSalaryMin: string;
  initialSalaryMax: string;
  initialCurrencyCode: string;
  initialApplicationMethod: string;
  initialExternalApplicationUrl: string;
};

const APPLICATION_METHOD_OPTIONS = [
  { value: "on_platform", label: "On this platform" },
  { value: "external_url", label: "External link" },
];

const initialState: UpdateJobActionState = {};

/**
 * Mirrors JobCreateForm.tsx's field set exactly, minus Country (a job's
 * country is not editable, see updateJob.ts) and minus Expiry date
 * (this task scopes the optional-expiry field to job CREATION only —
 * editing an existing expiry is a separate, undefined feature, not
 * built here).
 */
export function JobEditForm({
  jobId,
  companyName,
  citiesInCountry,
  categories,
  initialTitle,
  initialDescription,
  initialCitySlug,
  initialCategorySlug,
  initialSalaryMin,
  initialSalaryMax,
  initialCurrencyCode,
  initialApplicationMethod,
  initialExternalApplicationUrl,
}: JobEditFormProps) {
  const [state, formAction, isPending] = useActionState(updateJobAction.bind(null, jobId), initialState);
  const [applicationMethod, setApplicationMethod] = useState(initialApplicationMethod);

  const fieldErrors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <Input label="Company" value={companyName} disabled hideLabel={false} />

      <Input
        label="Job title"
        name="title"
        required
        maxLength={200}
        defaultValue={initialTitle}
        error={fieldErrors.title}
      />

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-foreground">Description</span>
        <textarea
          name="description"
          required
          rows={8}
          maxLength={10000}
          defaultValue={initialDescription}
          aria-invalid={Boolean(fieldErrors.description) || undefined}
          className="rounded-md border border-border bg-surface px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        />
        {fieldErrors.description ? <p className="text-sm text-danger-600">{fieldErrors.description}</p> : null}
      </label>

      <Select
        label="City"
        name="city"
        defaultValue={initialCitySlug}
        options={citiesInCountry.map((city) => ({ value: city.slug, label: city.name }))}
        error={fieldErrors.city}
      />

      <Select
        label="Category"
        name="category"
        defaultValue={initialCategorySlug}
        placeholder="Select a category"
        options={categories.map((category) => ({ value: category.slug, label: category.name }))}
        error={fieldErrors.category}
      />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-foreground">Salary (optional)</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="Minimum" name="salaryMin" type="number" min={0} hideLabel defaultValue={initialSalaryMin} />
          <Input label="Maximum" name="salaryMax" type="number" min={0} hideLabel defaultValue={initialSalaryMax} />
          <Select
            label="Currency"
            name="currencyCode"
            placeholder="Currency"
            hideLabel
            defaultValue={initialCurrencyCode}
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
          defaultValue={initialExternalApplicationUrl}
          error={fieldErrors.externalUrl}
        />
      ) : null}

      {state.formError ? (
        <p role="alert" className="text-sm text-danger-600">
          {state.formError}
        </p>
      ) : null}

      <Button type="submit" size="lg" fullWidth disabled={isPending}>
        {isPending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
