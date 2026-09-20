"use client";

import { useActionState } from "react";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import {
  setJobSourceEnabledAction,
  type SetJobSourceEnabledActionState,
} from "@/features/admin/setJobSourceEnabledAction";
import type { JobSourceRow } from "@/services/admin/jobSources";

const dateFormatter = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

const SOURCE_TYPE_LABELS: Record<JobSourceRow["sourceType"], string> = {
  API: "API",
  FEED: "Feed",
  ATS: "ATS",
  OFFICIAL_CAREER_SOURCE: "Official Career Source",
};

const initialActionState: SetJobSourceEnabledActionState = {};

function JobSourceListItem({ source }: { source: JobSourceRow }) {
  const [state, formAction, isPending] = useActionState(
    setJobSourceEnabledAction.bind(null, source.id, !source.enabled),
    initialActionState
  );

  return (
    <li className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">{source.name}</span>
          <Badge variant="neutral">{SOURCE_TYPE_LABELS[source.sourceType]}</Badge>
          {source.provider !== "unknown" ? <Badge variant="brand">{source.provider}</Badge> : null}
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
        {source.notes ? <span className="text-sm text-muted-foreground">{source.notes}</span> : null}
      </div>
      <form action={formAction} className="flex flex-col items-start gap-1 sm:items-end">
        <Button type="submit" variant="outline" size="sm" disabled={isPending}>
          {isPending ? "Saving…" : source.enabled ? "Disable" : "Enable"}
        </Button>
        {state.error ? (
          <p role="alert" className="text-sm text-danger-600">
            {state.error}
          </p>
        ) : null}
      </form>
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
