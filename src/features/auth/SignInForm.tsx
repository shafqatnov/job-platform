"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";

/**
 * Real sign-in form using Better Auth's own client API
 * (authClient.signIn.email) — no manual credential/cookie handling.
 */
export function SignInForm() {
  const router = useRouter();
  const errorId = useId();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const { data, error: signInError } = await authClient.signIn.email({ email, password });

    setIsSubmitting(false);

    if (signInError) {
      // Deliberately generic — never confirms whether the email exists.
      setError("Incorrect email or password. Please try again.");
      return;
    }

    router.push(data?.user.role === "employer" ? "/employer" : "/");
    router.refresh();
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
      <Input
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-danger-600">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={isSubmitting} fullWidth aria-describedby={error ? errorId : undefined}>
        {isSubmitting ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
