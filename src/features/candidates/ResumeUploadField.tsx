"use client";

import { useActionState, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { Button } from "@/components/Button";
import { deleteResumeAction, type DeleteResumeActionState } from "@/features/candidates/deleteResumeAction";
import { RESUME_PATHNAME, RESUME_CONTENT_TYPE, MAX_RESUME_SIZE_BYTES } from "@/services/candidates/resumeUploadConstants";

export type ResumeUploadFieldProps = {
  hasResume: boolean;
};

const initialDeleteState: DeleteResumeActionState = {};

/**
 * Uploads go directly from the browser to Blob (never through this
 * app's server) using a short-lived token issued by
 * /api/candidate/resume/upload after that route re-derives the
 * candidate's identity from their session — this component never knows
 * or sends its own candidateProfileId. `access: "private"` is hardcoded
 * here deliberately: this is the only code path in the app that calls
 * Blob's upload(), so there is no other entry point that could request
 * public access.
 */
export function ResumeUploadField({ hasResume: initialHasResume }: ResumeUploadFieldProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hasResume, setHasResume] = useState(initialHasResume);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [deleteState, deleteAction, isDeleting] = useActionState(deleteResumeAction, initialDeleteState);

  // Derived-state-from-a-previous-render pattern (React's own recommended
  // alternative to an Effect for reacting to a value that changed since
  // the last render) — reflects a successful removal immediately,
  // without waiting on a full page reload, and without an extra
  // commit-then-effect render pass. Mirrors SaveJobButton.tsx exactly.
  const [prevDeleteState, setPrevDeleteState] = useState(deleteState);
  if (deleteState !== prevDeleteState) {
    setPrevDeleteState(deleteState);
    if (deleteState.success) {
      setHasResume(false);
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-selecting the same file again later
    if (!file) {
      return;
    }

    setUploadError(null);
    setUploadSuccess(false);

    if (file.type !== RESUME_CONTENT_TYPE) {
      setUploadError("Please choose a PDF file.");
      return;
    }
    if (file.size > MAX_RESUME_SIZE_BYTES) {
      setUploadError("Your resume must be 5MB or smaller.");
      return;
    }

    setIsUploading(true);
    try {
      await upload(RESUME_PATHNAME, file, {
        access: "private",
        handleUploadUrl: "/api/candidate/resume/upload",
        contentType: RESUME_CONTENT_TYPE,
      });
      setHasResume(true);
      setUploadSuccess(true);
      router.refresh();
    } catch {
      setUploadError("We couldn't upload your resume right now. Please try again.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-foreground">Resume (optional)</span>
      <p id="resume-helper-text" className="text-sm text-muted-foreground">
        PDF only, up to 5MB.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handleFileChange}
          aria-describedby="resume-helper-text"
          aria-label="Upload resume"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {isUploading ? "Uploading…" : hasResume ? "Replace resume" : "Upload resume"}
        </Button>

        {hasResume ? (
          <a
            href="/api/candidate/resume/download"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-brand-700 hover:underline"
          >
            View current resume
          </a>
        ) : null}

        {hasResume ? (
          <form action={deleteAction}>
            <Button type="submit" variant="ghost" size="sm" disabled={isDeleting}>
              {isDeleting ? "Removing…" : "Remove"}
            </Button>
          </form>
        ) : null}
      </div>

      {uploadError ? (
        <p role="alert" className="text-sm text-danger-600">
          {uploadError}
        </p>
      ) : null}
      {uploadSuccess ? (
        <p role="status" className="text-sm text-brand-700">
          Resume uploaded.
        </p>
      ) : null}
      {deleteState.error ? (
        <p role="alert" className="text-sm text-danger-600">
          {deleteState.error}
        </p>
      ) : null}
    </div>
  );
}
