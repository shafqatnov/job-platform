"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button, type ButtonProps } from "@/components/Button";

export type SignOutButtonProps = Omit<ButtonProps, "onClick" | "children">;

/** Real sign-out control — delegates entirely to Better Auth, no manual cookie/token handling. */
export function SignOutButton(props: SignOutButtonProps) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <Button variant="outline" size="sm" {...props} disabled={isSigningOut} onClick={handleSignOut}>
      {isSigningOut ? "Signing out..." : "Sign out"}
    </Button>
  );
}
