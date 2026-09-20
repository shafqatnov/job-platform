"use client";

import { useActionState, useMemo, useState } from "react";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Select } from "@/components/Select";
import {
  resolveLocationReviewAction,
  type ResolveLocationReviewActionState,
} from "@/features/admin/resolveLocationReviewAction";
import {
  rejectLocationReviewAction,
  type RejectLocationReviewActionState,
} from "@/features/admin/rejectLocationReviewAction";
import type { LocationReviewRow } from "@/services/admin/locationReviews";
import type { CityOption, CountryOption } from "@/services/jobs/referenceData";

const dateFormatter = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

const initialResolveState: ResolveLocationReviewActionState = {};
const initialRejectState: RejectLocationReviewActionState = {};

function LocationReviewCard({
  review,
  countries,
  cities,
}: {
  review: LocationReviewRow;
  countries: CountryOption[];
  cities: CityOption[];
}) {
  const [countryId, setCountryId] = useState("");
  const [cityId, setCityId] = useState("");

  const [resolveState, resolveFormAction, isResolving] = useActionState(
    resolveLocationReviewAction.bind(null, review.id),
    initialResolveState
  );
  const [rejectState, rejectFormAction, isRejecting] = useActionState(
    rejectLocationReviewAction.bind(null, review.id),
    initialRejectState
  );

  const citiesForCountry = useMemo(() => cities.filter((city) => city.countryId === countryId), [cities, countryId]);

  return (
    <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">{review.title}</span>
          <Badge variant="warning">Unknown location</Badge>
        </div>
        <span className="text-sm text-muted-foreground">
          Source: {review.importedSourceId} &middot; External ID: {review.importedExternalJobId}
        </span>
        <span className="text-sm text-muted-foreground">
          Original location text: <span className="font-medium text-foreground">{review.location ?? "(none provided)"}</span>
        </span>
        <span className="text-sm text-muted-foreground">
          AI suggestion — Country: {review.aiCountry ?? "Uncertain"} &middot; City: {review.aiCity ?? "Uncertain"}
        </span>
        <span className="text-sm text-muted-foreground">
          Reported {dateFormatter.format(new Date(review.createdAt))}
        </span>
      </div>

      <form action={resolveFormAction} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="countryId" value={countryId} />
        <input type="hidden" name="cityId" value={cityId} />
        <div className="w-56">
          <Select
            label="Country"
            options={countries.map((country) => ({ value: country.id, label: country.name }))}
            placeholder="Select a country"
            value={countryId}
            onChange={(event) => {
              setCountryId(event.target.value);
              setCityId("");
            }}
          />
        </div>
        <div className="w-56">
          <Select
            label="City"
            options={citiesForCountry.map((city) => ({ value: city.id, label: city.name }))}
            placeholder={!countryId ? "Select a country first" : citiesForCountry.length === 0 ? "No cities available" : "Select a city"}
            value={cityId}
            onChange={(event) => setCityId(event.target.value)}
            disabled={!countryId || citiesForCountry.length === 0}
          />
        </div>
        <Button type="submit" size="sm" disabled={isResolving || isRejecting || !countryId}>
          {isResolving ? "Saving…" : "Save / Approve Mapping"}
        </Button>
      </form>
      {resolveState.error ? (
        <p role="alert" className="text-sm text-danger-600">
          {resolveState.error}
        </p>
      ) : null}

      <form action={rejectFormAction}>
        <Button type="submit" variant="outline" size="sm" disabled={isResolving || isRejecting}>
          {isRejecting ? "Rejecting…" : "Reject / Ignore"}
        </Button>
      </form>
      {rejectState.error ? (
        <p role="alert" className="text-sm text-danger-600">
          {rejectState.error}
        </p>
      ) : null}
    </li>
  );
}

export type ImportedJobLocationReviewsTableProps = {
  reviews: LocationReviewRow[];
  countries: CountryOption[];
  cities: CityOption[];
};

export function ImportedJobLocationReviewsTable({ reviews, countries, cities }: ImportedJobLocationReviewsTableProps) {
  if (reviews.length === 0) {
    return (
      <EmptyState
        title="No unknown locations need review"
        description="Imported jobs whose location AI couldn't confidently map will appear here."
      />
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-border">
      {reviews.map((review) => (
        <LocationReviewCard key={review.id} review={review} countries={countries} cities={cities} />
      ))}
    </ul>
  );
}
