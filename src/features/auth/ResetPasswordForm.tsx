"use client";

import { useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";

export type ResetPasswordFormProps = {
  token: string;
};

/**
 * Real Better Auth password reset submission
 * (authClient.resetPassword) — the token is consumed exactly once by
 * Better Auth's own /reset-password endpoint (atomic single-use
 * lookup against the real Verification table); this component never
 * stores or re-derives a token itself. Server-side minimum-length
 * validation is Better Auth's own configured minPasswordLength — this
 * form's own required/minLength attributes only pre-empt an obviously
 * invalid submission for a better UX, never a substitute for it.
 */
export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const errorId = useId();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setStatus("submitting");
    const { error: resetError } = await authClient.resetPassword({ newPassword, token });
    setStatus("idle");

    if (resetError) {
      if (resetError.code === "INVALID_TOKEN") {
        setError("This reset link is invalid or has expired. Request a new one.");
      } else {
        setError(resetError.message || "We couldn't reset your password. Please try again.");
      }
      return;
    }

    setStatus("success");
  }

  if (status === "success") {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <p role="status" className="text-muted-foreground">
          Your password has been reset. You can now sign in with your new password.
        </p>
        <Link href="/sign-in" className="font-medium text-brand-600 hover:text-brand-700">
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <Input
        label="New password"
        name="newPassword"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        helperText="At least 8 characters."
        value={newPassword}
        onChange={(event) => setNewPassword(event.target.value)}
      />
      <Input
        label="Confirm new password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
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
        {status === "submitting" ? "Resetting..." : "Reset password"}
      </Button>
    </form>
  );
}
