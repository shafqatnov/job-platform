"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/Button";
import { saveJobAction, type SaveJobActionState } from "@/features/jobs/saveJobAction";
import { unsaveJobAction, type UnsaveJobActionState } from "@/features/jobs/unsaveJobAction";

export type SaveState = "hidden" | "signed_out" | "not_candidate" | "no_profile" | "saved" | "unsaved";

export type SaveJobButtonProps = {
  jobId: string;
  saveState: SaveState;
  /** Only used for the "no_profile" state. */
  createProfileHref?: string;
};

const initialSaveState: SaveJobActionState = {};
const initialUnsaveState: UnsaveJobActionState = {};

/**
 * Renders the correct Save/Unsave affordance for the current viewer,
 * mirroring ApplyButton.tsx's own per-viewer-state branching exactly.
 * This is UX only — the real authorization/eligibility checks happen
 * server-side in saveJobAction/unsaveJobAction regardless of which
 * branch rendered here, since saveState reflects the page load, not
 * the moment of submission.
 */
export function SaveJobButton({ jobId, saveState, createProfileHref }: SaveJobButtonProps) {
  const [isSaved, setIsSaved] = useState(saveState === "saved");
  const [saveActionState, saveFormAction, isSaving] = useActionState(
    saveJobAction.bind(null, jobId),
    initialSaveState
  );
  const [unsaveActionState, unsaveFormAction, isUnsaving] = useActionState(
    unsaveJobAction.bind(null, jobId),
    initialUnsaveState
  );

  // Derived-state-from-a-previous-render pattern (React's own recommended
  // alternative to an Effect for this exact case: reacting to a value
  // that changed since the last render) — a ref-like "previous state"
  // comparison performed directly during render, not inside useEffect,
  // so this never causes an extra commit-then-effect render pass.
  const [prevSaveActionState, setPrevSaveActionState] = useState(saveActionState);
  const [prevUnsaveActionState, setPrevUnsaveActionState] = useState(unsaveActionState);

  if (saveActionState !== prevSaveActionState) {
    setPrevSaveActionState(saveActionState);
    if (saveActionState.success) {
      setIsSaved(true);
    }
  }
  if (unsaveActionState !== prevUnsaveActionState) {
    setPrevUnsaveActionState(unsaveActionState);
    if (unsaveActionState.success) {
      setIsSaved(false);
    }
  }

  if (saveState === "hidden" || saveState === "not_candidate") {
    return null;
  }

  if (saveState === "signed_out") {
    return (
      <Link href="/sign-in" className="text-sm font-medium text-muted-foreground hover:text-foreground">
        Sign in to save
      </Link>
    );
  }

  if (saveState === "no_profile" && createProfileHref) {
    return (
      <Link href={createProfileHref} className="text-sm font-medium text-muted-foreground hover:text-foreground">
        Create profile to save jobs
      </Link>
    );
  }

  const error = saveActionState.error ?? unsaveActionState.error;

  return (
    <div className="flex flex-col gap-1">
      <form action={isSaved ? unsaveFormAction : saveFormAction}>
        <Button type="submit" variant="outline" size="sm" disabled={isSaving || isUnsaving} aria-pressed={isSaved}>
          {isSaving ? "Saving…" : isUnsaving ? "Removing…" : isSaved ? "Saved — remove" : "Save job"}
        </Button>
      </form>
      {error ? (
        <p role="alert" className="text-xs text-danger-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
