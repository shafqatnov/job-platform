"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button, type ButtonProps } from "@/components/Button";

export type SignOutButtonProps = Omit<ButtonProps, "onClick" | "children">;

/** Real sign-out control — delegates entirely to Better Auth, no manual cookie/token handling. */
export function SignOutButton(props: SignOutButtonProps) {
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    await authClient.signOut();
    // A full navigation, not router.push/refresh: Next.js's client-side
    // Router Cache is an in-memory, per-browser-tab cache keyed by URL,
    // not by session. It's unaware of who's signed in, so a soft
    // navigation can leave another employer's already-rendered
    // /employer/... pages cached and replay them (e.g. via the
    // back/forward cache, which always trusts a cached entry regardless
    // of staleTimes) after a different account signs in in the same tab.
    // A hard navigation discards the whole cache with the JS runtime.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- intentional: see comment above
    window.location.href = "/";
  }

  return (
    <Button variant="outline" size="sm" {...props} disabled={isSigningOut} onClick={handleSignOut}>
      {isSigningOut ? "Signing out..." : "Sign out"}
    </Button>
  );
}
