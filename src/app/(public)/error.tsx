"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Section } from "@/components/Section";
import { Button, getButtonClassName } from "@/components/Button";

/**
 * Shared error boundary for the public shell (keeps Header/Footer instead
 * of a bare crash page). Catches genuine failures — e.g. a database read
 * error from the jobs service — without ever showing the underlying
 * error message or stack trace to visitors; those are only logged
 * server-side for whoever operates this deployment.
 */
export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Section aria-labelledby="error-heading">
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
        <h1 id="error-heading" className="text-2xl font-semibold text-foreground sm:text-3xl">
          Something went wrong
        </h1>
        <p className="text-muted-foreground">
          We couldn&apos;t load this page right now. Please try again in a moment.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <Link href="/" className={getButtonClassName({ variant: "outline" })}>
            Back to homepage
          </Link>
        </div>
      </div>
    </Section>
  );
}
