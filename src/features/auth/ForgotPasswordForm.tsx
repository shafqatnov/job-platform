"use client";

import { useId, useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";

/**
 * Real Better Auth password-reset request
 * (authClient.requestPasswordReset) — no custom token system. Always
 * shows the same generic confirmation regardless of whether the email
 * actually belongs to an account: Better Auth's own
 * /request-password-reset endpoint already returns an identical
 * generic response either way (see src/lib/auth.ts), so this form
 * never has enough information to say anything more specific, by
 * design.
 */
export function ForgotPasswordForm() {
  const errorId = useId();

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "submitted">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus("submitting");

    const { error: requestError } = await authClient.requestPasswordReset({
      email,
      redirectTo: "/reset-password",
    });

    if (requestError) {
      setStatus("idle");
      // Only reachable for a genuine request problem (e.g. malformed
      // email, rate limited) — never reveals whether an account exists.
      setError("We couldn't process that request right now. Please try again.");
      return;
    }

    setStatus("submitted");
  }

  if (status === "submitted") {
    return (
      <p role="status" className="text-center text-muted-foreground">
        If an account exists for that email address, we&apos;ve sent instructions to reset your
        password.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <Input
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-danger-600">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        size="lg"
        disabled={status === "submitting"}
        fullWidth
        aria-describedby={error ? errorId : undefined}
      >
        {status === "submitting" ? "Sending..." : "Send reset instructions"}
      </Button>
    </form>
  );
}
