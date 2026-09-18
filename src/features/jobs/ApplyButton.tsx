"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, getButtonClassName } from "@/components/Button";
import { applyToJobAction, type ApplyToJobActionState } from "@/features/jobs/applyToJobAction";

export type ApplyState = "signed_out" | "not_candidate" | "no_profile" | "already_applied" | "can_apply";

export type ApplyButtonProps = {
  jobId: string;
  applyState: ApplyState;
  /** Only used for the "no_profile" state — sends the candidate back here after creating their profile. */
  createProfileHref: string;
};

const initialState: ApplyToJobActionState = {};

/**
 * Renders the correct Apply affordance for the current viewer. This is
 * UX only — the real authorization/eligibility checks happen
 * server-side in applyToJobAction/applyToJob regardless of which branch
 * rendered here, since applyState reflects the page load, not the
 * moment of submission.
 */
export function ApplyButton({ jobId, applyState, createProfileHref }: ApplyButtonProps) {
  const [state, formAction, isPending] = useActionState(applyToJobAction.bind(null, jobId), initialState);

  if (state.success || applyState === "already_applied") {
    return (
      <Button type="button" disabled fullWidth>
        Applied &#10003;
      </Button>
    );
  }

  if (applyState === "signed_out") {
    return (
      <Link href="/sign-in" className={getButtonClassName({ fullWidth: true })}>
        Sign in to apply
      </Link>
    );
  }

  if (applyState === "not_candidate") {
    return (
      <>
        <Button type="button" disabled aria-describedby="apply-not-candidate" fullWidth className="cursor-not-allowed">
          Apply Now
        </Button>
        <p id="apply-not-candidate" className="text-sm text-muted-foreground">
          Only candidate accounts can apply for jobs.
        </p>
      </>
    );
  }

  if (applyState === "no_profile") {
    return (
      <Link href={createProfileHref} className={getButtonClassName({ fullWidth: true })}>
        Create profile to apply
      </Link>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="apply-cover-note" className="text-sm font-medium text-foreground">
          Cover note (optional)
        </label>
        <textarea
          id="apply-cover-note"
          name="coverNote"
          rows={4}
          maxLength={2000}
          placeholder="Introduce yourself or explain why you're a good fit (optional)."
          className="rounded-md border border-border bg-surface px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        />
      </div>
      <Button type="submit" fullWidth disabled={isPending}>
        {isPending ? "Applying…" : "Apply Now"}
      </Button>
      {state.error ? (
        <p role="alert" className="text-sm text-danger-600">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
