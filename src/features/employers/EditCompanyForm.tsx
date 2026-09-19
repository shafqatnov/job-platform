"use client";

import { useActionState } from "react";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { Button } from "@/components/Button";
import { updateCompanyAction, type UpdateCompanyActionState } from "@/features/employers/updateCompanyAction";
import type { CountryOption } from "@/services/jobs/referenceData";

export type EditCompanyFormProps = {
  countries: CountryOption[];
  initialName: string;
  initialWebsiteUrl: string;
  initialDescription: string;
  initialCountrySlug: string;
};

const initialState: UpdateCompanyActionState = {};

/** Mirrors EditCandidateProfileForm.tsx's structure — an edit of the employer's own company, not a redesign. */
export function EditCompanyForm({
  countries,
  initialName,
  initialWebsiteUrl,
  initialDescription,
  initialCountrySlug,
}: EditCompanyFormProps) {
  const [state, formAction, isPending] = useActionState(updateCompanyAction, initialState);
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <Input
        label="Company name"
        name="name"
        required
        maxLength={200}
        defaultValue={initialName}
        error={fieldErrors.name}
      />

      <Input
        label="Website (optional)"
        name="websiteUrl"
        type="url"
        placeholder="https://example.com"
        defaultValue={initialWebsiteUrl}
        error={fieldErrors.websiteUrl}
      />

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-foreground">Description (optional)</span>
        <textarea
          name="description"
          rows={6}
          maxLength={2000}
          defaultValue={initialDescription}
          aria-invalid={Boolean(fieldErrors.description) || undefined}
          className="rounded-md border border-border bg-surface px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        />
        {fieldErrors.description ? <p className="text-sm text-danger-600">{fieldErrors.description}</p> : null}
      </label>

      <Select
        label="Country (optional)"
        name="country"
        defaultValue={initialCountrySlug}
        placeholder="Select a country"
        options={countries.map((country) => ({ value: country.slug, label: country.name }))}
        error={fieldErrors.country}
      />

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
          Company updated.
        </p>
      ) : null}

      <Button type="submit" size="lg" fullWidth disabled={isPending}>
        {isPending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
