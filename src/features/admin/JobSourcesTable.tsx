"use client";

import { useActionState } from "react";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import {
  setJobSourceEnabledAction,
  type SetJobSourceEnabledActionState,
} from "@/features/admin/setJobSourceEnabledAction";
import {
  setJobSourceAuthorizationAction,
  type SetJobSourceAuthorizationActionState,
} from "@/features/admin/setJobSourceAuthorizationAction";
import { AdzunaSyncNowButton } from "@/features/admin/AdzunaSyncNowButton";
import type { JobSourceRow } from "@/services/admin/jobSources";

const dateFormatter = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

const SOURCE_TYPE_LABELS: Record<JobSourceRow["sourceType"], string> = {
  API: "API",
  FEED: "Feed",
  ATS: "ATS",
  OFFICIAL_CAREER_SOURCE: "Official Career Source",
};

const initialEnabledState: SetJobSourceEnabledActionState = {};
const initialAuthorizationState: SetJobSourceAuthorizationActionState = {};

function JobSourceListItem({ source }: { source: JobSourceRow }) {
  const isVerified = source.authorizationStatus === "verified";

  const [enabledState, enabledFormAction, isTogglingEnabled] = useActionState(
    setJobSourceEnabledAction.bind(null, source.id, !source.enabled),
    initialEnabledState
  );
  const [authState, authFormAction, isTogglingAuth] = useActionState(
    setJobSourceAuthorizationAction.bind(null, source.id, !isVerified),
    initialAuthorizationState
  );

  return (
    <li className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">{source.name}</span>
          <Badge variant="neutral">{SOURCE_TYPE_LABELS[source.sourceType]}</Badge>
          {source.provider !== "unknown" ? <Badge variant="brand">{source.provider}</Badge> : null}
          <Badge variant={isVerified ? "success" : "warning"}>
            Authorization: {isVerified ? "Verified" : "Unverified"}
          </Badge>
          <Badge variant={source.enabled ? "success" : "neutral"}>{source.enabled ? "Enabled" : "Disabled"}</Badge>
        </div>
        <span className="text-sm text-muted-foreground">
          {source.baseEndpoint ? "Endpoint configured" : "No endpoint configured"} &middot;{" "}
          {source.hasCredentialConfigured ? "Credential configured" : "No credential configured"} &middot; Attribution{" "}
          {source.attributionRequired ? "required" : "not required"}
        </span>
        <span className="text-sm text-muted-foreground">
          Status: {source.status} &middot; Updated {dateFormatter.format(new Date(source.updatedAt))}
        </span>
        {source.authorizationVerifiedAt ? (
          <span className="text-sm text-muted-foreground">
            Authorization verified {dateFormatter.format(new Date(source.authorizationVerifiedAt))}
            {source.authorizationReference ? ` — "${source.authorizationReference}"` : ""}
          </span>
        ) : null}
        {source.notes ? <span className="text-sm text-muted-foreground">{source.notes}</span> : null}
      </div>

      <div className="flex flex-col items-start gap-2 sm:items-end">
        <form action={authFormAction} className="flex flex-col items-start gap-1 sm:items-end">
          {!isVerified ? (
            <input
              type="text"
              name="authorizationReference"
              placeholder="Reference note (e.g. how authorization was obtained)"
              maxLength={500}
              className="h-9 w-64 rounded-md border border-border bg-surface px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            />
          ) : null}
          <Button type="submit" variant="outline" size="sm" disabled={isTogglingAuth}>
            {isTogglingAuth ? "Saving…" : isVerified ? "Mark Unverified" : "Mark Verified"}
          </Button>
          {authState.error ? (
            <p role="alert" className="text-sm text-danger-600">
              {authState.error}
            </p>
          ) : null}
        </form>

        <form action={enabledFormAction} className="flex flex-col items-start gap-1 sm:items-end">
          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={isTogglingEnabled || (!source.enabled && !isVerified)}
          >
            {isTogglingEnabled ? "Saving…" : source.enabled ? "Disable" : "Enable"}
          </Button>
          {!source.enabled && !isVerified ? (
            <p className="text-sm text-muted-foreground">Verify authorization before enabling.</p>
          ) : null}
          {enabledState.error ? (
            <p role="alert" className="text-sm text-danger-600">
              {enabledState.error}
            </p>
          ) : null}
        </form>

        {source.name === "Adzuna" ? <AdzunaSyncNowButton isEligible={isVerified && source.enabled} /> : null}
      </div>
    </li>
  );
}

export type JobSourcesTableProps = {
  sources: JobSourceRow[];
};

export function JobSourcesTable({ sources }: JobSourcesTableProps) {
  if (sources.length === 0) {
    return <EmptyState title="No job sources configured" description="Job sources will appear here once added." />;
  }

  return (
    <ul className="flex flex-col divide-y divide-border">
      {sources.map((source) => (
        <JobSourceListItem key={source.id} source={source} />
      ))}
    </ul>
  );
}
