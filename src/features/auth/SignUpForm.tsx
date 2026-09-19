"use client";

import { useId, useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { Button } from "@/components/Button";

// Only the two approved public account types — Admin is never offered
// here, per docs/06-user-boundaries.md. The real security boundary is
// server-side (src/lib/auth.ts's databaseHooks), not this list; this
// list only keeps the UI honest about what's actually offered.
const ACCOUNT_TYPE_OPTIONS = [
  { value: "candidate", label: "Candidate — I'm looking for a job" },
  { value: "employer", label: "Employer — I'm hiring" },
];

/**
 * Real sign-up form using Better Auth's own client API
 * (authClient.signUp.email) — no parallel/custom auth system.
 */
export function SignUpForm() {
  const errorId = useId();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("candidate");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    const { data, error: signUpError } = await authClient.signUp.email({
      name,
      email,
      password,
      role,
    });
    setIsSubmitting(false);

    if (signUpError) {
      setError(signUpError.message || "We couldn't create your account. Please try again.");
      return;
    }

    // Hard navigation for the same reason as SignInForm/SignOutButton:
    // avoids replaying a previous session's cached employer/candidate
    // pages from Next.js's URL-keyed, session-unaware Router Cache.
    window.location.href = data?.user.role === "employer" ? "/employer" : "/";
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <Select
        label="I am a..."
        name="role"
        value={role}
        onChange={(event) => setRole(event.target.value)}
        options={ACCOUNT_TYPE_OPTIONS}
      />
      <Input
        label="Full name"
        name="name"
        autoComplete="name"
        required
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <Input
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <Input
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        helperText="At least 8 characters."
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <Input
        label="Confirm password"
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
      <Button type="submit" size="lg" disabled={isSubmitting} fullWidth aria-describedby={error ? errorId : undefined}>
        {isSubmitting ? "Creating account..." : "Create account"}
      </Button>
    </form>
  );
}
