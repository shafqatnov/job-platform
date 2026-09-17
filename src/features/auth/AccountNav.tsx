"use client";

import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { getButtonClassName } from "@/components/Button";
import { SignOutButton } from "@/features/auth/SignOutButton";

/**
 * Session-aware account navigation. A small, isolated Client Component
 * so the surrounding public pages stay server-rendered (and, where
 * possible, statically generated) — only this fragment fetches session
 * state client-side, via Better Auth's useSession() hook.
 */
export function AccountNav() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    // Reserve roughly the same footprint as the signed-out state so the
    // header doesn't visibly shift once the session check resolves.
    return <div className="h-9 w-40" aria-hidden="true" />;
  }

  if (!session) {
    return (
      <div className="flex items-center gap-3">
        <Link href="/sign-in" className="text-sm font-medium text-muted-foreground hover:text-foreground">
          Sign in
        </Link>
        <Link href="/sign-up" className={getButtonClassName({ size: "sm", variant: "outline" })}>
          Create account
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {session.user.role === "employer" ? (
        <Link href="/employer" className="text-sm font-medium text-muted-foreground hover:text-foreground">
          Dashboard
        </Link>
      ) : null}
      <span className="hidden text-sm text-muted-foreground sm:inline">{session.user.name}</span>
      <SignOutButton />
    </div>
  );
}
